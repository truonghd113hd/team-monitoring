import { google } from 'googleapis';
import path from 'path';
import File from '../models/File';
import Issue from '../models/Issue';
import Notification from '../models/Notification';
import '../config/database';

/**
 * Parse Google Sheet ID and sheet name from URL
 */
const parseGoogleSheetUrl = (url: string): { spreadsheetId: string | null; sheetName: string | null } => {
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = idMatch ? idMatch[1] : null;
  
  // Extract sheet name from URL hash (e.g., #gid=0&range=Sheet1)
  const sheetMatch = url.match(/range=([^&]+)/);
  const sheetName = sheetMatch ? decodeURIComponent(sheetMatch[1]) : null;
  
  return { spreadsheetId, sheetName };
};

/**
 * Initialize Google Sheets API with service account
 */
const getGoogleSheetsClient = () => {
  const credentialsPath = path.join(__dirname, '../../credentials.json');
  
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
};

/**
 * Smart header mapping to identify column purposes
 */
const mapHeaders = (headers: string[]) => {
  const headerMap: {
    idColumn: number | null;
    nameColumn: number | null;
    descriptionColumn: number | null;
    statusColumn: number | null;
    assigneeColumn: number | null;
    severityColumn: number | null;
    lineColumn: number | null;
  } = {
    idColumn: null,
    nameColumn: null,
    descriptionColumn: null,
    statusColumn: null,
    assigneeColumn: null,
    severityColumn: null,
    lineColumn: null,
  };

  headers.forEach((header, index) => {
    const h = header.toLowerCase().trim();
    
    if (!headerMap.idColumn && (h === 'id' || h === 'stt' || h === 'no' || h === 'number' || h === 'issue id' || h === 'issueid' || h === 'no.' || h === '#')) {
      headerMap.idColumn = index;
    }
    else if (!headerMap.nameColumn && (h.includes('feature') || h === 'name' || h === 'title' || h === 'issue' || h === 'task' || h === 'summary')) {
      headerMap.nameColumn = index;
    }
    else if (!headerMap.descriptionColumn && (h.includes('feedback') || h.includes('description') || h.includes('detail') || h.includes('note') || h === 'desc' || h === 'mô tả' || h === 'chi tiết')) {
      headerMap.descriptionColumn = index;
    }
    else if (!headerMap.statusColumn && (h.includes('status') || h === 'state' || h.includes('trạng thái') || h.includes('tình trạng'))) {
      headerMap.statusColumn = index;
    }
    else if (!headerMap.assigneeColumn && (h.includes('assignee') || h.includes('assigned') || h === 'owner' || h.includes('người xử lý') || h.includes('người thực hiện'))) {
      headerMap.assigneeColumn = index;
    }
    else if (!headerMap.severityColumn && (h.includes('severity') || h.includes('priority') || h.includes('độ ưu tiên') || h.includes('mức độ'))) {
      headerMap.severityColumn = index;
    }
    else if (!headerMap.lineColumn && (h.includes('line') || h === 'dòng' || h === 'row')) {
      headerMap.lineColumn = index;
    }
  });

  return headerMap;
};

/**
 * Check if value is a valid ID
 */
const isValidId = (value: string): boolean => {
  return value.trim().length > 0;
};

/**
 * Fetch data from Google Sheets
 */
const fetchGoogleSheetData = async (
  spreadsheetId: string,
  sheetName: string
): Promise<Record<string, string>[]> => {
  const sheets = getGoogleSheetsClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });

  const rows = response.data.values || [];
  
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(h => String(h).trim());
  const headerMap = mapHeaders(headers);
  
  if (headerMap.idColumn === null) {
    console.warn('[SYNC_JOB] Warning: No ID column found in sheet headers');
    return [];
  }
  
  const data: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    const idValue = headerMap.idColumn !== null && row[headerMap.idColumn] 
      ? String(row[headerMap.idColumn]).trim() 
      : '';
    
    if (!idValue || !isValidId(idValue)) {
      continue;
    }
    
    const mappedRow: Record<string, string> = {
      id: idValue,
      name: headerMap.nameColumn !== null && row[headerMap.nameColumn] ? String(row[headerMap.nameColumn]).trim() : '',
      description: headerMap.descriptionColumn !== null && row[headerMap.descriptionColumn] ? String(row[headerMap.descriptionColumn]).trim() : '',
      status: headerMap.statusColumn !== null && row[headerMap.statusColumn] ? String(row[headerMap.statusColumn]).trim() : 'open',
      assignee: headerMap.assigneeColumn !== null && row[headerMap.assigneeColumn] ? String(row[headerMap.assigneeColumn]).trim() : '',
      severity: headerMap.severityColumn !== null && row[headerMap.severityColumn] ? String(row[headerMap.severityColumn]).trim() : 'medium',
      line: headerMap.lineColumn !== null && row[headerMap.lineColumn] ? String(row[headerMap.lineColumn]).trim() : '',
    };
    
    if (mappedRow.name || mappedRow.description) {
      data.push(mappedRow);
    }
  }

  return data;
};

/**
 * Compare two issues to detect changes
 */
const hasIssueChanged = (existingIssue: any, newData: Record<string, string>): boolean => {
  return (
    existingIssue.title !== newData.name ||
    existingIssue.description !== newData.description ||
    existingIssue.status !== newData.status ||
    existingIssue.assignee !== newData.assignee ||
    existingIssue.severity !== newData.severity.toLowerCase() ||
    (existingIssue.lineNumber || null) !== (parseInt(newData.line) || null)
  );
};

/**
 * Main sync job - syncs all files from Google Sheets
 */
export const syncAllFilesJob = async () => {
  console.log('[SYNC_ALL_JOB] Starting sync all files job...');
  
  try {
    const files = await File.find({}).populate('projectId');
    console.log(`[SYNC_ALL_JOB] Found ${files.length} files to sync`);
    
    let totalNewIssues = 0;
    let totalUpdatedIssues = 0;
    let totalErrors = 0;
    
    for (const file of files) {
      try {
        console.log(`[SYNC_ALL_JOB] Syncing file: ${file.fileName}`);
        
        if (!file.sheetUrl) {
          console.log(`[SYNC_ALL_JOB] Skipping ${file.fileName} - no sheet URL`);
          continue;
        }
        
        // Parse Google Sheet URL
        const { spreadsheetId, sheetName } = parseGoogleSheetUrl(file.sheetUrl);
        
        if (!spreadsheetId || !sheetName) {
          console.error(`[SYNC_ALL_JOB] Invalid sheet URL for ${file.fileName}`);
          continue;
        }
        
        // Fetch fresh data from Google Sheets
        const sheetData = await fetchGoogleSheetData(spreadsheetId, sheetName);
        console.log(`[SYNC_ALL_JOB] Fetched ${sheetData.length} rows from sheet`);
        
        // Get existing issues for this file
        const existingIssues = await Issue.find({
          projectId: file.projectId,
          fileId: file._id,
          sheetName: file.sheetName
        });
        
        const existingIssueMap = new Map(
          existingIssues.map(issue => [issue.issueId, issue])
        );
        
        let newIssuesCount = 0;
        let updatedIssuesCount = 0;
        
        // Process each row from sheet
        for (const row of sheetData) {
          const issueId = row.id;
          const existingIssue = existingIssueMap.get(issueId);
          
          if (!existingIssue) {
            // New issue - add it
            const newIssue = new Issue({
              projectId: file.projectId,
              projectName: file.projectName,
              sheetName: file.sheetName,
              fileId: file._id,
              issueId: issueId,
              title: row.name || 'Untitled Issue',
              description: row.description || '',
              severity: row.severity.toLowerCase() || 'medium',
              status: row.status || 'open',
              systemStatus: 'open',
              assignee: row.assignee || '',
              lineNumber: parseInt(row.line) || null
            });
            
            await newIssue.save();
            newIssuesCount++;
            console.log(`[SYNC_ALL_JOB] Added new issue: ${issueId}`);
          } else {
            // Check if issue has changed
            if (hasIssueChanged(existingIssue, row)) {
              // Issue changed - update data and mark as 'update'
              existingIssue.title = row.name || existingIssue.title;
              existingIssue.description = row.description || existingIssue.description;
              existingIssue.status = row.status || existingIssue.status;
              existingIssue.assignee = row.assignee || existingIssue.assignee;
              const newSeverity = row.severity.toLowerCase();
              if (newSeverity === 'low' || newSeverity === 'medium' || newSeverity === 'high' || newSeverity === 'critical') {
                existingIssue.severity = newSeverity;
              }
              existingIssue.lineNumber = parseInt(row.line) || existingIssue.lineNumber;
              
              // Mark as 'update' only if not already completed
              if (existingIssue.systemStatus !== 'completed') {
                existingIssue.systemStatus = 'update';
              }
              
              existingIssue.updatedAt = new Date();
              await existingIssue.save();
              updatedIssuesCount++;
              console.log(`[SYNC_ALL_JOB] Updated issue: ${issueId} - marked as 'update'`);
            }
          }
        }
        
        // Update file statistics
        const fileIssues = await Issue.find({ fileId: file._id });
        const totalIssues = fileIssues.length;
        const openIssues = fileIssues.filter(i => i.systemStatus === 'open' || i.systemStatus === 'update').length;
        const progressIssues = fileIssues.filter(i => i.systemStatus === 'progress').length;
        const completedIssues = fileIssues.filter(i => i.systemStatus === 'completed').length;
        const pendingIssues = openIssues + progressIssues;
        
        file.totalIssues = totalIssues;
        file.pendingIssues = pendingIssues;
        file.resolvedIssues = completedIssues;
        file.progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;
        file.status = pendingIssues === 0 ? 'completed' : 'in-progress';
        file.lastUpdated = new Date();
        await file.save();
        
        totalNewIssues += newIssuesCount;
        totalUpdatedIssues += updatedIssuesCount;
        
        console.log(`[SYNC_ALL_JOB] File ${file.fileName} synced: ${newIssuesCount} new, ${updatedIssuesCount} updated`);
      } catch (error) {
        console.error(`[SYNC_ALL_JOB] Error syncing file ${file.fileName}:`, error);
        totalErrors++;
      }
    }
    
    console.log(`[SYNC_ALL_JOB] Sync completed: ${totalNewIssues} new issues, ${totalUpdatedIssues} updated issues, ${totalErrors} errors`);
    
    // Create notification
    await Notification.create({
      type: 'success',
      title: 'Auto-sync hoàn tất',
      message: `Đã đồng bộ ${files.length} files: ${totalNewIssues} issues mới, ${totalUpdatedIssues} issues cập nhật`,
      metadata: {
        filesCount: files.length,
        newIssues: totalNewIssues,
        updatedIssues: totalUpdatedIssues,
        errors: totalErrors
      }
    });
    
  } catch (error) {
    console.error('[SYNC_ALL_JOB] Fatal error:', error);
    
    // Create error notification
    await Notification.create({
      type: 'error',
      title: 'Auto-sync thất bại',
      message: `Lỗi khi đồng bộ: ${(error as Error).message}`
    });
    
    throw error;
  }
};

/**
 * Run the job (for direct execution)
 */
const runJob = async () => {
  try {
    await syncAllFilesJob();
    console.log('[SYNC_ALL_JOB] Job finished successfully');
    process.exit(0);
  } catch (error) {
    console.error('[SYNC_ALL_JOB] Job failed:', error);
    process.exit(1);
  }
};

// If this file is run directly
if (require.main === module) {
  runJob();
}

import { Request, Response } from 'express';
import { google } from 'googleapis';
import path from 'path';
import File from '../models/File';
import Issue from '../models/Issue';
import Notification from '../models/Notification';
import Project from '../models/Project';

interface SyncRequest {
  projectName: string;
  googleSheetUrl: string;
  sheetName?: string; // Optional: specific sheet name/tab
}

/**
 * Parse Google Sheet ID from URL
 */
const parseGoogleSheetId = (url: string): string | null => {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
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
    fileColumn: number | null;
    lineColumn: number | null;
  } = {
    idColumn: null,
    nameColumn: null,
    descriptionColumn: null,
    statusColumn: null,
    assigneeColumn: null,
    severityColumn: null,
    fileColumn: null,
    lineColumn: null,
  };

  headers.forEach((header, index) => {
    const h = header.toLowerCase().trim();
    
    // ID column: id, stt, no, number
    if (!headerMap.idColumn && (h === 'id' || h === 'stt' || h === 'no' || h === 'number' || h === 'issue id' || h === 'issueid' || h === 'no.' || h === '#')) {
      headerMap.idColumn = index;
    }
    
    // Name/Title column: feature, name, title, issue, task
    else if (!headerMap.nameColumn && (h.includes('feature') || h === 'name' || h === 'title' || h === 'issue' || h === 'task' || h === 'summary')) {
      headerMap.nameColumn = index;
    }
    
    // Description column: feedback, description, detail, note
    else if (!headerMap.descriptionColumn && (h.includes('feedback') || h.includes('description') || h.includes('detail') || h.includes('note') || h === 'desc' || h === 'mô tả' || h === 'chi tiết')) {
      headerMap.descriptionColumn = index;
    }
    
    // Status column: status, state, trạng thái, tình trạng
    else if (!headerMap.statusColumn && (h.includes('status') || h === 'state' || h.includes('trạng thái') || h.includes('tình trạng'))) {
      headerMap.statusColumn = index;
    }
    
    // Assignee column
    else if (!headerMap.assigneeColumn && (h.includes('assignee') || h.includes('assigned') || h === 'owner' || h.includes('người xử lý') || h.includes('người thực hiện'))) {
      headerMap.assigneeColumn = index;
    }
    
    // Severity column
    else if (!headerMap.severityColumn && (h.includes('severity') || h.includes('priority') || h.includes('độ ưu tiên') || h.includes('mức độ'))) {
      headerMap.severityColumn = index;
    }
    
    // File column
    else if (!headerMap.fileColumn && (h.includes('file') || h === 'filename' || h.includes('tệp'))) {
      headerMap.fileColumn = index;
    }
    
    // Line number column
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
 * Fetch data from Google Sheets using API
 */
const fetchGoogleSheetData = async (
  spreadsheetId: string,
  projectName: string,
  sheetName?: string
): Promise<{ data: Record<string, string>[]; actualSheetName: string }> => {
  const sheets = getGoogleSheetsClient();
  
  // Get sheet metadata to find the first sheet if no name provided
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const targetSheet = sheetName || metadata.data.sheets?.[0]?.properties?.title || 'Sheet1';
  
  // Fetch data from the sheet
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: targetSheet,
  });

  const rows = response.data.values || [];
  
  if (rows.length === 0) {
    return { data: [], actualSheetName: targetSheet };
  }

  // First row is headers
  const headers = rows[0].map(h => String(h).trim());
  const headerMap = mapHeaders(headers);
  console.log('[SYNC] Detected headers:', headers);
  console.log('[SYNC] Mapped columns:', headerMap);
  
  if (headerMap.idColumn === null) {
    console.warn('[SYNC] Warning: No ID column found in sheet headers');
  }
  
  const data: Record<string, string>[] = [];

  // Process remaining rows - only rows where column A (idColumn) is a number
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Check if ID column exists and is numeric
    const idValue = headerMap.idColumn !== null && row[headerMap.idColumn] 
      ? String(row[headerMap.idColumn]).trim() 
      : '';
    
    if (!idValue || !isValidId(idValue)) {
      continue; // Skip rows without valid ID
    }
    
    // Map data using smart header mapping
    const mappedRow: Record<string, string> = {
      id: idValue,
      name: headerMap.nameColumn !== null && row[headerMap.nameColumn] ? String(row[headerMap.nameColumn]).trim() : '',
      description: headerMap.descriptionColumn !== null && row[headerMap.descriptionColumn] ? String(row[headerMap.descriptionColumn]).trim() : '',
      status: headerMap.statusColumn !== null && row[headerMap.statusColumn] ? String(row[headerMap.statusColumn]).trim() : 'open',
      assignee: headerMap.assigneeColumn !== null && row[headerMap.assigneeColumn] ? String(row[headerMap.assigneeColumn]).trim() : '',
      severity: headerMap.severityColumn !== null && row[headerMap.severityColumn] ? String(row[headerMap.severityColumn]).trim() : 'medium',
      file: `${projectName} - ${targetSheet}`,
      line: headerMap.lineColumn !== null && row[headerMap.lineColumn] ? String(row[headerMap.lineColumn]).trim() : '',
    };
    
    // Skip empty rows
    if (mappedRow.name || mappedRow.description) {
      data.push(mappedRow);
    }
  }

  return { data, actualSheetName: targetSheet };
};

/**
 * Sync data from Google Sheets
 */
export const syncFromGoogleSheets = async (req: Request<{}, {}, SyncRequest>, res: Response): Promise<void> => {
  try {
    const { projectName, googleSheetUrl, sheetName } = req.body;
    console.log('[SYNC] Starting sync:', { projectName, googleSheetUrl, sheetName });

    if (!projectName || !googleSheetUrl) {
      res.status(400).json({
        success: false,
        message: 'Project name and Google Sheet URL are required'
      });
      return;
    }

    // Parse sheet ID from URL
    const spreadsheetId = parseGoogleSheetId(googleSheetUrl);
    console.log('[SYNC] Parsed spreadsheet ID:', spreadsheetId);
    
    if (!spreadsheetId) {
      res.status(400).json({
        success: false,
        message: 'Invalid Google Sheets URL'
      });
      return;
    }

    // Find or create project
    let project = await Project.findOne({ name: projectName });
    if (!project) {
      project = new Project({
        name: projectName,
        googleSheetUrl,
        status: 'active'
      });
      await project.save();
      console.log('[SYNC] Created new project:', project._id);
    } else {
      project.googleSheetUrl = googleSheetUrl;
      console.log('[SYNC] Found existing project:', project._id);
    }

    // Fetch data from Google Sheets using API
    const result = await fetchGoogleSheetData(spreadsheetId, projectName, sheetName);
    const data = result.data;
    const actualSheetName = result.actualSheetName;
    console.log('[SYNC] Fetched data from sheet:', { actualSheetName, rowCount: data.length });

    // Get existing issues to check for duplicates (using composite key)
    const existingIssues = await Issue.find({ 
      projectId: project._id,
      sheetName: actualSheetName 
    });
    const existingIssueIds = new Set(existingIssues.map(issue => issue.issueId));
    console.log('[SYNC] Found existing issues:', existingIssues.length);

    // Process data
    const fileMap = new Map<string, { totalIssues: number; pendingIssues: number; resolvedIssues: number }>();
    const issues: Array<{
      fileName: string;
      issueId: string;
      title: string;
      severity: string;
      status: string;
      description: string;
      assignee: string;
      lineNumber: number | null;
    }> = [];

    let skippedDuplicates = 0;

    data.forEach((row) => {
      const fileName = row.file || 'general.txt';
      const issueId = row.id;
      const title = row.name || 'Untitled Issue';
      const severity = row.severity ? row.severity.toLowerCase() : 'medium';
      const status = row.status ? row.status.toLowerCase() : 'open';

      // Skip duplicate issues (already in database)
      if (existingIssueIds.has(issueId)) {
        skippedDuplicates++;
        return;
      }

      // Track file
      if (!fileMap.has(fileName)) {
        fileMap.set(fileName, {
          totalIssues: 0,
          pendingIssues: 0,
          resolvedIssues: 0
        });
      }

      const fileData = fileMap.get(fileName)!;
      fileData.totalIssues++;
      // New issues default to systemStatus='pending'
      fileData.pendingIssues++;

      issues.push({
        fileName,
        issueId,
        title,
        severity,
        status,
        description: row.description || '',
        assignee: row.assignee || '',
        lineNumber: parseInt(row.line) || null
      });
    });

    console.log('[SYNC] Processed issues:', { 
      totalIssues: issues.length, 
      skippedDuplicates,
      uniqueFiles: fileMap.size 
    });

    // Save files to database
    const savedFiles = [];
    for (const [fileName, fileData] of fileMap) {
      let file = await File.findOne({ 
        projectId: project._id, 
        projectName: project.name,
        sheetName: actualSheetName,
        fileName 
      });
      
      // Generate Google Sheets URL with specific sheet
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0&range=${encodeURIComponent(actualSheetName)}`;
      
      if (!file) {
        file = new File({
          projectId: project._id,
          projectName: project.name,
          sheetName: actualSheetName,
          fileName,
          sheetUrl,
          totalIssues: fileData.totalIssues,
          pendingIssues: fileData.pendingIssues,
          resolvedIssues: fileData.resolvedIssues,
          progress: fileData.totalIssues > 0 
            ? Math.round((fileData.resolvedIssues / fileData.totalIssues) * 100) 
            : 0,
          status: fileData.pendingIssues === 0 ? 'completed' : 'in-progress'
        });
      } else {
        file.sheetUrl = sheetUrl;
        file.totalIssues = fileData.totalIssues;
        file.pendingIssues = fileData.pendingIssues;
        file.resolvedIssues = fileData.resolvedIssues;
        file.progress = fileData.totalIssues > 0 
          ? Math.round((fileData.resolvedIssues / fileData.totalIssues) * 100) 
          : 0;
        file.status = fileData.pendingIssues === 0 ? 'completed' : 'in-progress';
        file.lastUpdated = new Date();
      }
      
      await file.save();
      savedFiles.push(file);
    }
    
    console.log('[SYNC] Saved files to database:', savedFiles.length);

    // Save issues to database
    const savedIssues = [];
    for (const issueData of issues) {
      const file = savedFiles.find(f => f.fileName === issueData.fileName);
      if (!file) continue;

      let issue = await Issue.findOne({ 
        projectId: project._id,
        sheetName: actualSheetName,
        issueId: issueData.issueId 
      });

      if (!issue) {
        issue = new Issue({
          projectId: project._id,
          projectName: project.name,
          sheetName: actualSheetName,
          fileId: file._id,
          issueId: issueData.issueId,
          title: issueData.title,
          description: issueData.description,
          severity: issueData.severity as any,
          status: issueData.status,
          assignee: issueData.assignee,
          lineNumber: issueData.lineNumber
        });
      } else {
        issue.title = issueData.title;
        issue.description = issueData.description;
        issue.severity = issueData.severity as any;
        issue.status = issueData.status;
        issue.assignee = issueData.assignee;
        issue.lineNumber = issueData.lineNumber;
      }

      await issue.save();
      savedIssues.push(issue);
    }
    
    console.log('[SYNC] Saved issues to database:', savedIssues.length);

    // Update project last sync time
    project.lastSyncAt = new Date();
    await project.save();
    
    console.log('[SYNC] Sync completed successfully');

    // Create notification
    await Notification.create({
      projectId: project._id,
      type: 'success',
      title: 'Đồng bộ thành công',
      message: `Đã đồng bộ ${savedIssues.length} issues mới từ ${savedFiles.length} files cho dự án ${projectName}${skippedDuplicates > 0 ? ` (Bỏ qua ${skippedDuplicates} issues trùng lặp)` : ''}`,
      metadata: {
        filesCount: savedFiles.length,
        issuesCount: savedIssues.length,
        skippedDuplicates
      }
    });

    res.json({
      success: true,
      message: 'Sync completed successfully',
      data: {
        project: {
          id: project._id,
          name: project.name
        },
        filesCount: savedFiles.length,
        issuesCount: savedIssues.length,
        skippedDuplicates
      }
    });

  } catch (error) {
    console.error('[SYNC] Error occurred:', {
      message: (error as Error).message,
      stack: (error as Error).stack
    });
    
    // Create error notification
    if (req.body.projectName) {
      const project = await Project.findOne({ name: req.body.projectName });
      if (project) {
        await Notification.create({
          projectId: project._id,
          type: 'error',
          title: 'Lỗi đồng bộ',
          message: `Không thể đồng bộ dữ liệu: ${(error as Error).message}`
        });
      }
    }

    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Sync failed'
    });
  }
};

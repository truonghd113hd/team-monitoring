import { google } from 'googleapis';
import path from 'path';
import mongoose from 'mongoose';
import TrackerProject from '../models/TrackerProject';
import TrackerIssue, { IssueStatus, IssuePriority, IssueType } from '../models/TrackerIssue';
import { emit } from './wsService';

// ── Auth ──────────────────────────────────────────────────────────────────────

const getSheetsClient = () => {
  const credPath = path.join(__dirname, '../../credentials.json');
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const parseSpreadsheetId = (url: string): string | null => {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
};

// 0-based column index → A1 letter notation
function colLetter(n: number): string {
  let s = '';
  n = n + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ── Priority mappings ─────────────────────────────────────────────────────────

// Bug freeform text → enum
function mapPriority(s: string): IssuePriority {
  const l = s.toLowerCase().trim();
  if (l.includes('critical') || l.includes('blocker') || l.includes('p0')) return 'critical';
  if (l.includes('high') || l.includes('p1')) return 'high';
  if (l.includes('low') || l.includes('p3')) return 'low';
  return 'medium';
}

// Testcase/Issue sheet value → enum  (Highest / High / Medium / Low)
function mapTcPriority(s: string): IssuePriority {
  const l = s.toLowerCase().trim();
  if (l === 'highest') return 'critical';
  if (l === 'high') return 'high';
  if (l === 'low') return 'low';
  return 'medium';
}

// Enum → testcase/issue sheet display value
function tcPriorityDisplay(p: string): string {
  if (p === 'critical') return 'Highest';
  if (p === 'high') return 'High';
  if (p === 'low') return 'Low';
  return 'Medium';
}

// ── Status helpers ────────────────────────────────────────────────────────────

function mapBugStatus(s: string): IssueStatus {
  const l = s.toLowerCase().trim();
  if (l.includes('progress') || l.includes('doing') || l.includes('wip')) return 'inprogress';
  if (l.includes('review') || l.includes('testing') || l.includes('qa')) return 'review';
  if (l.includes('done') || l.includes('close') || l.includes('complet') || l.includes('merged')) return 'done';
  return 'todo';
}

// Derives internal status from statusDev
export function mapIssueInternalStatus(statusDev: string): IssueStatus {
  const l = statusDev.toLowerCase().trim();
  if (l === 'done' || l === 'close') return 'done';
  if (l === 'in progress' || l === 'inprogress') return 'inprogress';
  return 'todo';
}

// Derives testcase status from iOS + Android results
export function deriveTestcaseStatus(ios: string | null | undefined, android: string | null | undefined): IssueStatus {
  if (ios === 'Pass' && android === 'Pass') return 'done';
  if (ios === 'Failed' || android === 'Failed') return 'inprogress';
  return 'todo';
}

function mapStatusTest(s: string): string | null {
  const l = s.toLowerCase().trim();
  if (l === 'passed') return 'Passed';
  if (l === 'wait') return 'Wait';
  if (l === 'close') return 'Close';
  if (l === 'reopen') return 'Reopen';
  return null;
}

function mapStatusDev(s: string): string | null {
  const l = s.toLowerCase().trim();
  if (l === 'done') return 'Done';
  if (l === 'reopen') return 'Reopen';
  if (l === 'close') return 'Close';
  if (l === 'in progress' || l === 'inprogress') return 'In progress';
  return null;
}

function mapDevice(s: string): string | null {
  const l = s.toLowerCase().trim();
  if (l === 'ios') return 'IOS';
  if (l === 'android') return 'Android';
  if (l === 'all') return 'All';
  return null;
}

// Test result normalisation (testcase iOS/Android columns)
function mapTestResult(s: string): string | null {
  const l = s.toLowerCase().trim();
  if (l === 'pass' || l === 'passed') return 'Pass';
  if (l === 'fail' || l === 'failed') return 'Failed';
  if (l === 'n/a') return 'N/A';
  if (l === 'untested') return 'Untested';
  return null;
}

// ── Bug header detection (freeform) ───────────────────────────────────────────

function detectColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const l = h.toLowerCase().trim();
    if (!('id' in map) && (l === 'id' || l === 'stt' || l === 'no' || l === 'no.' || l === '#' || l === 'number' || l === 'issue id')) map.id = i;
    else if (!('title' in map) && (l === 'title' || l === 'name' || l === 'task' || l === 'issue' || l === 'summary' || l.includes('feature'))) map.title = i;
    else if (!('description' in map) && (l.includes('desc') || l.includes('feedback') || l.includes('detail') || l.includes('note') || l === 'mô tả')) map.description = i;
    else if (!('status' in map) && (l.includes('status') || l.includes('state') || l.includes('trạng thái'))) map.status = i;
    else if (!('priority' in map) && (l.includes('priority') || l.includes('severity') || l.includes('mức độ'))) map.priority = i;
    else if (!('assignees' in map) && (l.includes('assignee') || l.includes('assigned') || l === 'owner' || l.includes('người'))) map.assignees = i;
  });
  return map;
}

// ── Fixed column maps ─────────────────────────────────────────────────────────

// Testcase: columns A–L
const TC_COL = {
  id: 0,            // A
  description: 1,   // B
  priority: 2,          // C
  initialCondition: 3,     // D
  testData: 4, // E
  testStep: 5,      // F
  expectedResult: 6,      // G
  actualResult: 7, // H
  ios: 8,  // I
  android: 9,           // J
  version: 10,       // K
} as const;

// Issue: columns A–U (I, K, Q, R skipped)
const ISSUE_COL = {
  id: 0,            // A – bug id
  title: 1,         // B
  module: 2,        // C
  description: 3,   // D
  precondition: 4,  // E
  stepsToReproduce: 5, // F
  expectedResult: 6, // G
  actualResult: 7,  // H
  // I (8) skipped
  evidence: 9,      // J
  // K (10) skipped
  priority: 11,     // L
  severity: 12,     // M
  statusTest: 13,   // N
  statusDev: 14,    // O
  device: 15,       // P
  // Q (16), R (17) skipped
  note: 18,         // S
  issueDate: 19,    // T
  assigned: 20,     // U
} as const;

const PRIORITIES = new Set(['low', 'medium', 'high', 'highest']);

// cspell:disable-next-line
const isPriorityKeyword = (s: string) => // cspell:disable-line
  s.includes('priority') || s.includes('prior') || s.includes('mức') || s.includes('ưu tiên'); // cspell:disable-line

/**
 * Scans raw rows to find the index of the column-header row (the row that has
 * "priority" in col D for testcase sheets, or col L for issue sheets).
 * Returns { headerIdx, type } or null if not found.
 */
function findHeaderRow(raw: any[][]): { headerIdx: number; type: IssueType } | null {
  const str = (v: any) => (v != null ? String(v).trim().toLowerCase() : '');
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] || [];
    if (isPriorityKeyword(str(row[11]))) return { headerIdx: i, type: 'issue' };
    if (isPriorityKeyword(str(row[2]))) return { headerIdx: i, type: 'testcase' };
  }
  return null;
}

// ── Format validation ─────────────────────────────────────────────────────────

export async function validateSheetFormat(
  spreadsheetId: string,
  sheetName: string,
  expectedType: 'testcase' | 'issue'
): Promise<{ valid: boolean; reason?: string }> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A1:U10`,
  });

  const raw: any[][] = response.data.values || [];
  if (raw.length < 2) {
    return { valid: false, reason: 'Sheet has no data rows (need at least 2 rows)' };
  }

  // Scan rows to find a data row (column A non-empty)
  let dataRow: any[] = raw[1]; // default to row 2
  for (let i = 1; i < raw.length; i++) {
    if (raw[i][0] != null && String(raw[i][0]).trim() !== '') {
      dataRow = raw[i];
      break;
    }
  }

  if (expectedType === 'testcase') {
    // Distinguishing check: priority must be in column C (index 2), NOT in column L (index 11)
    const colC = dataRow[2] != null ? String(dataRow[2]).trim().toLowerCase() : '';
    const colL = dataRow[11] != null ? String(dataRow[11]).trim().toLowerCase() : '';

    if (colL && PRIORITIES.has(colL)) {
      return {
        valid: false,
        reason: `Wrong format: priority found in column L ("${dataRow[11]}"). This looks like an Issue sheet. Testcase format expects priority in column C.`,
      };
    }
    if (colC && !PRIORITIES.has(colC)) {
      return {
        valid: false,
        reason: `Wrong format: column C should be priority (Low/Medium/High/Highest), got "${dataRow[2]}".`,
      };
    }
    return { valid: true };
  }

  if (expectedType === 'issue') {
    // Distinguishing check: priority must be in column L (index 11), NOT in column C (index 2)
    const colL = dataRow[11] != null ? String(dataRow[11]).trim().toLowerCase() : '';
    const colC = dataRow[2] != null ? String(dataRow[2]).trim().toLowerCase() : '';
    const colN = dataRow[13] != null ? String(dataRow[13]).trim().toLowerCase() : '';

    if (colC && PRIORITIES.has(colC)) {
      return {
        valid: false,
        reason: `Wrong format: priority found in column C ("${dataRow[2]}"). This looks like a Testcase sheet. Issue format expects priority in column L.`,
      };
    }
    if (colL && !PRIORITIES.has(colL)) {
      return {
        valid: false,
        reason: `Wrong format: column L should be priority (Low/Medium/High/Highest), got "${dataRow[11]}".`,
      };
    }
    const STATUS_TEST = new Set(['passed', 'wait', 'close', 'reopen', '']);
    if (colN && !STATUS_TEST.has(colN)) {
      return {
        valid: false,
        reason: `Wrong format: column N should be test status (Passed/Wait/Close/Reopen), got "${dataRow[13]}".`,
      };
    }
    return { valid: true };
  }

  return { valid: true };
}

// ── Row type ──────────────────────────────────────────────────────────────────

export interface SheetRow {
  rowIndex: number;
  sheetIssueId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignees: string[];
  type: IssueType;
  // shared (testcase + issue)
  initialCondition?: string;
  testStep?: string;
  expectedResult?: string;
  actualResult?: string | null;
  // testcase-only
  testData?: string;
  iosStatus?: string | null;
  androidStatus?: string | null;
  version?: string | null;
  // issue-only
  module?: string;
  evidence?: string | null;
  severity?: string | null;
  statusTest?: string | null;
  statusDev?: string | null;
  device?: string | null;
  note?: string | null;
  issueDate?: string | null;
}

// ── Read sheet ────────────────────────────────────────────────────────────────

export async function getSheetTabs(spreadsheetId: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
}

export async function getSheetTabsWithIds(spreadsheetId: string): Promise<Array<{ name: string; sheetId: number }>> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets || [])
    .filter((s: any) => s.properties?.title)
    .map((s: any) => ({ name: s.properties.title as string, sheetId: s.properties.sheetId as number }));
}

export async function readSheetRows(
  spreadsheetId: string,
  sheetName: string,
  issueType: IssueType = 'bug'
): Promise<{ rows: SheetRow[]; colMap: Record<string, number> }> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });

  const raw: any[][] = response.data.values || [];
  if (raw.length < 2) return { rows: [], colMap: {} };

  const str = (v: any) => (v != null ? String(v).trim() : '');

  // ── Testcase (fixed A–L) ──────────────────────────────────────────────────
  if (issueType === 'testcase') {
    const found = findHeaderRow(raw);
    const dataStart = found ? found.headerIdx + 1 : 1;
    const rows: SheetRow[] = [];
    for (let i = dataStart; i < raw.length; i++) {
      try {
        const row = raw[i];
        const idVal = str(row[TC_COL.id]);
        if (!idVal) continue;
        const desc = str(row[TC_COL.description]);
        const ios = mapTestResult(str(row[TC_COL.ios]));
        const android = mapTestResult(str(row[TC_COL.android]));
        rows.push({
          rowIndex: i + 1,
          sheetIssueId: idVal,
          title: desc,
          description: desc,
          status: deriveTestcaseStatus(ios, android),
          priority: mapTcPriority(str(row[TC_COL.priority])),
          assignees: [],
          type: 'testcase',
          initialCondition: str(row[TC_COL.initialCondition]),
          testData: str(row[TC_COL.testData]),
          testStep: str(row[TC_COL.testStep]),
          expectedResult: str(row[TC_COL.expectedResult]),
          actualResult: mapTestResult(str(row[TC_COL.actualResult])),
          iosStatus: ios,
          androidStatus: android,
          version: str(row[TC_COL.version]) || null,
        });
      } catch (err) {
        console.warn(`[SHEET_SYNC] Skipping testcase row ${i + 1}:`, (err as Error).message);
      }
    }
    return { rows, colMap: TC_COL as unknown as Record<string, number> };
  }

  // ── Issue (fixed A–U) ─────────────────────────────────────────────────────
  if (issueType === 'issue') {
    const found = findHeaderRow(raw);
    const dataStart = found ? found.headerIdx + 1 : 1;
    const rows: SheetRow[] = [];
    for (let i = dataStart; i < raw.length; i++) {
      try {
        const row = raw[i];
        const idVal = str(row[ISSUE_COL.id]);
        if (!idVal) continue;
        const statusDevRaw = str(row[ISSUE_COL.statusDev]);
        const assignedRaw = str(row[ISSUE_COL.assigned]);
        rows.push({
          rowIndex: i + 1,
          sheetIssueId: idVal,
          title: str(row[ISSUE_COL.title]),
          description: str(row[ISSUE_COL.description]),
          status: mapIssueInternalStatus(statusDevRaw),
          priority: mapTcPriority(str(row[ISSUE_COL.priority])),
          assignees: assignedRaw ? [assignedRaw] : [],
          type: 'issue',
          module: str(row[ISSUE_COL.module]) || undefined,
          initialCondition: str(row[ISSUE_COL.precondition]) || undefined,
          testStep: str(row[ISSUE_COL.stepsToReproduce]) || undefined,
          expectedResult: str(row[ISSUE_COL.expectedResult]) || undefined,
          actualResult: str(row[ISSUE_COL.actualResult]) || null,
          evidence: str(row[ISSUE_COL.evidence]) || null,
          severity: str(row[ISSUE_COL.severity]) || null,
          statusTest: mapStatusTest(str(row[ISSUE_COL.statusTest])),
          statusDev: mapStatusDev(statusDevRaw),
          device: mapDevice(str(row[ISSUE_COL.device])),
          note: str(row[ISSUE_COL.note]) || null,
          issueDate: str(row[ISSUE_COL.issueDate]) || null,
        });
      } catch (err) {
        console.warn(`[SHEET_SYNC] Skipping issue row ${i + 1}:`, (err as Error).message);
      }
    }
    return { rows, colMap: ISSUE_COL as unknown as Record<string, number> };
  }

  // ── Bug (detected columns) ────────────────────────────────────────────────
  const headers = raw[0].map((h: any) => String(h ?? ''));
  const colMap = detectColumns(headers);
  if (!('id' in colMap)) return { rows: [], colMap };

  const rows: SheetRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    try {
      const row = raw[i];
      const idVal = row[colMap.id] != null ? str(row[colMap.id]) : '';
      if (!idVal) continue;
      rows.push({
        rowIndex: i + 1,
        sheetIssueId: idVal,
        title: colMap.title != null ? str(row[colMap.title]) : '',
        description: colMap.description != null ? str(row[colMap.description]) : '',
        status: mapBugStatus(colMap.status != null ? str(row[colMap.status]) : ''),
        priority: mapPriority(colMap.priority != null ? str(row[colMap.priority]) : ''),
        assignees: colMap.assignees != null
          ? str(row[colMap.assignees]).split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
        type: 'bug',
      });
    } catch (err) {
      console.warn(`[SHEET_SYNC] Skipping bug row ${i + 1}:`, (err as Error).message);
    }
  }
  return { rows, colMap };
}

// ── Write back to sheet ───────────────────────────────────────────────────────

export async function writeIssueToSheet(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  colMap: Record<string, number>,
  issueType: IssueType,
  patch: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assignees?: string[];
    // testcase
    initialCondition?: string;
    testData?: string;
    testStep?: string;
    expectedResult?: string;
    actualResult?: string | null;
    iosStatus?: string | null;
    androidStatus?: string | null;
    version?: string | null;
    // issue
    module?: string;
    evidence?: string | null;
    severity?: string | null;
    statusTest?: string | null;
    statusDev?: string | null;
    device?: string | null;
    note?: string | null;
    issueDate?: string | null;
  }
): Promise<void> {
  const data: Array<{ range: string; values: string[][] }> = [];
  const q = sheetName.includes("'") ? `"${sheetName}"` : `'${sheetName}'`;

  const add = (col: string, val: string | null | undefined) => {
    if (val === undefined) return;
    data.push({ range: `${q}!${col}${rowIndex}`, values: [[val ?? '']] });
  };

  if (issueType === 'testcase') {
    add('B', patch.description || patch.title);
    if (patch.priority !== undefined) add('C', tcPriorityDisplay(patch.priority));
    add('D', patch.initialCondition);
    add('E', patch.testData);
    add('F', patch.testStep);
    add('G', patch.expectedResult);
    add('H', patch.actualResult);
    add('I', patch.iosStatus);
    add('J', patch.androidStatus);
    add('K', patch.version);
  } else if (issueType === 'issue') {
    add('B', patch.title);
    add('D', patch.description);
    add('H', patch.actualResult);
    add('J', patch.evidence);
    if (patch.priority !== undefined) add('L', tcPriorityDisplay(patch.priority));
    add('N', patch.statusTest);
    add('O', patch.statusDev);
    add('S', patch.note);
  } else {
    // Bug: use detected colMap
    const cell = (col: string) => `${q}!${colLetter(colMap[col])}${rowIndex}`;
    if (patch.title !== undefined && colMap.title != null) data.push({ range: cell('title'), values: [[patch.title]] });
    if (patch.description !== undefined && colMap.description != null) data.push({ range: cell('description'), values: [[patch.description]] });
    if (patch.status !== undefined && colMap.status != null) data.push({ range: cell('status'), values: [[patch.status]] });
    if (patch.priority !== undefined && colMap.priority != null) data.push({ range: cell('priority'), values: [[patch.priority]] });
    if (patch.assignees !== undefined && colMap.assignees != null) data.push({ range: cell('assignees'), values: [[patch.assignees.join(', ')]] });
  }

  if (data.length === 0) return;

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
}

// ── Append a new row to a GS sheet ───────────────────────────────────────────

function generateNextSheetId(existingIds: string[]): string {
  if (existingIds.length === 0) return '1';
  const last = existingIds[existingIds.length - 1];
  if (/^\d+$/.test(last)) return String(parseInt(last, 10) + 1);
  const m = last.match(/^([A-Za-z\-_]+?)(\d+)$/);
  if (m) return `${m[1]}${String(parseInt(m[2], 10) + 1).padStart(m[2].length, '0')}`;
  return String(existingIds.length + 1);
}

export async function appendIssueToSheet(
  spreadsheetId: string,
  sheetName: string,
  issueType: IssueType,
  data: {
    tcName?: string | null;
    title?: string;
    description?: string;
    priority?: string;
    initialCondition?: string;
    testData?: string;
    testStep?: string;
    expectedResult?: string;
    actualResult?: string | null;
    iosStatus?: string | null;
    androidStatus?: string | null;
    version?: string | null;
    module?: string;
    evidence?: string | null;
    severity?: string | null;
    statusTest?: string | null;
    statusDev?: string | null;
    device?: string | null;
    note?: string | null;
    issueDate?: string | null;
    assignee?: string | null;
  }
): Promise<{ sheetIssueId: string; sheetRowIndex: number }> {
  const sheets = getSheetsClient();
  const q = sheetName.includes("'") ? `"${sheetName}"` : `'${sheetName}'`;

  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
  const raw: any[][] = response.data.values || [];
  const str = (v: any) => (v != null ? String(v).trim() : '');

  const found = findHeaderRow(raw);
  const dataStart = found ? found.headerIdx + 1 : 1;

  const existingIds: string[] = [];
  for (let i = dataStart; i < raw.length; i++) {
    const id = str(raw[i]?.[0]);
    if (id) existingIds.push(id);
  }
  const nextId = (data.tcName && data.tcName.trim()) ? data.tcName.trim() : generateNextSheetId(existingIds);

  const s = (v: string | null | undefined) => v ?? '';
  let rowValues: string[];

  if (issueType === 'testcase') {
    rowValues = [
      nextId,
      s(data.description || data.title),
      data.priority ? tcPriorityDisplay(data.priority) : '',
      s(data.initialCondition),
      s(data.testData),
      s(data.testStep),
      s(data.expectedResult),
      s(data.actualResult),
      s(data.iosStatus),
      s(data.androidStatus),
      s(data.version),
    ];
  } else if (issueType === 'issue') {
    rowValues = new Array(21).fill('');
    rowValues[0]  = nextId;
    rowValues[1]  = s(data.title);
    rowValues[2]  = s(data.module);
    rowValues[3]  = s(data.description);
    rowValues[4]  = s(data.initialCondition);
    rowValues[5]  = s(data.testStep);
    rowValues[6]  = s(data.expectedResult);
    rowValues[7]  = s(data.actualResult);
    rowValues[9]  = s(data.evidence);
    rowValues[11] = data.priority ? tcPriorityDisplay(data.priority) : '';
    rowValues[12] = s(data.severity);
    rowValues[13] = s(data.statusTest);
    rowValues[14] = s(data.statusDev);
    rowValues[15] = s(data.device);
    rowValues[18] = s(data.note);
    rowValues[19] = s(data.issueDate);
    rowValues[20] = s(data.assignee);
  } else {
    rowValues = [nextId, s(data.title), s(data.description)];
  }

  const appendResp = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${q}`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowValues] },
  });

  const updatedRange = appendResp.data.updates?.updatedRange ?? '';
  const rowMatch = updatedRange.match(/:.*?(\d+)$/);
  const sheetRowIndex = rowMatch ? parseInt(rowMatch[1], 10) : raw.length + 1;

  return { sheetIssueId: nextId, sheetRowIndex };
}

// ── Sync one sheet tab ────────────────────────────────────────────────────────

async function syncSheetTab(
  project: any,
  sheetName: string,
  issueType: IssueType,
  isInitial: boolean,
  stats: { newIssues: number; updatedIssues: number }
): Promise<Record<string, number>> {
  const projectId = project._id as mongoose.Types.ObjectId;

  let rows: SheetRow[];
  let colMap: Record<string, number>;

  try {
    ({ rows, colMap } = await readSheetRows(project.googleSheetId, sheetName, issueType));
  } catch (err: any) {
    if (err?.response?.status === 429) {
      console.warn('[SHEET_SYNC] Rate limited — waiting 60s');
      await sleep(60_000);
      ({ rows, colMap } = await readSheetRows(project.googleSheetId, sheetName, issueType));
    } else {
      throw err;
    }
  }

  for (const row of rows) {
    const existing = await TrackerIssue.findOne({ projectId, sheetIssueId: row.sheetIssueId, type: issueType });

    if (!existing) {
      const last = await TrackerIssue.findOne({ projectId }).sort({ number: -1 }).lean();
      const number = (last?.number ?? 0) + 1;

      const tcFields = issueType === 'testcase' ? {
        initialCondition: row.initialCondition ?? null,
        testData: row.testData ?? null,
        testStep: row.testStep ?? null,
        expectedResult: row.expectedResult ?? null,
        actualResult: row.actualResult ?? null,
        iosStatus: row.iosStatus ?? null,
        androidStatus: row.androidStatus ?? null,
        version: row.version ?? null,
      } : {};

      const issueFields = issueType === 'issue' ? {
        module: row.module ?? null,
        initialCondition: row.initialCondition ?? null,
        testStep: row.testStep ?? null,
        expectedResult: row.expectedResult ?? null,
        actualResult: row.actualResult ?? null,
        evidence: row.evidence ?? null,
        severity: row.severity ?? null,
        statusTest: row.statusTest ?? null,
        statusDev: row.statusDev ?? null,
        device: row.device ?? null,
        note: row.note ?? null,
        issueDate: row.issueDate ?? null,
      } : {};

      const created = await TrackerIssue.create({
        projectId, number,
        title: row.title || `${issueType === 'testcase' ? 'Test Case' : issueType === 'issue' ? 'Issue' : 'Bug'} ${row.sheetIssueId}`,
        description: row.description,
        status: row.status,
        priority: row.priority,
        type: issueType,
        assignees: row.assignees,
        closedAt: row.status === 'done' ? new Date() : null,
        sheetIssueId: row.sheetIssueId,
        sheetRowIndex: row.rowIndex,
        sheetName,
        ...tcFields,
        ...issueFields,
      });

      if (!isInitial) {
        emit('tracker:issue:new', {
          _id: String(created._id),
          projectId: String(projectId),
          number: created.number,
          title: created.title,
          status: created.status,
          priority: created.priority,
          type: created.type,
          assignees: created.assignees,
          createdAt: created.createdAt,
          updatedAt: created.createdAt,
        });
      }
      stats.newIssues++;
    } else {
      const baseChanged =
        existing.title !== row.title ||
        existing.description !== row.description ||
        existing.status !== row.status ||
        existing.priority !== row.priority ||
        JSON.stringify(existing.assignees) !== JSON.stringify(row.assignees);

      const tcChanged = issueType === 'testcase' && (
        existing.initialCondition !== (row.initialCondition ?? null) ||
        existing.testData !== (row.testData ?? null) ||
        existing.testStep !== (row.testStep ?? null) ||
        existing.expectedResult !== (row.expectedResult ?? null) ||
        existing.actualResult !== (row.actualResult ?? null) ||
        existing.iosStatus !== (row.iosStatus ?? null) ||
        existing.androidStatus !== (row.androidStatus ?? null) ||
        existing.version !== (row.version ?? null)
      );

      const issueChanged = issueType === 'issue' && (
        existing.module !== (row.module ?? null) ||
        existing.initialCondition !== (row.initialCondition ?? null) ||
        existing.testStep !== (row.testStep ?? null) ||
        existing.expectedResult !== (row.expectedResult ?? null) ||
        existing.actualResult !== (row.actualResult ?? null) ||
        existing.evidence !== (row.evidence ?? null) ||
        existing.severity !== (row.severity ?? null) ||
        existing.statusTest !== (row.statusTest ?? null) ||
        existing.statusDev !== (row.statusDev ?? null) ||
        existing.device !== (row.device ?? null) ||
        existing.note !== (row.note ?? null) ||
        existing.issueDate !== (row.issueDate ?? null)
      );

      if (baseChanged || tcChanged || issueChanged) {
        const closedAt = row.status === 'done' ? (existing.closedAt ?? new Date()) : null;
        const updateSet: Record<string, unknown> = {
          title: row.title,
          description: row.description,
          status: row.status,
          priority: row.priority,
          assignees: row.assignees,
          closedAt,
          sheetRowIndex: row.rowIndex,
          sheetName,
        };

        if (issueType === 'testcase') {
          Object.assign(updateSet, {
            initialCondition: row.initialCondition ?? null,
            testData: row.testData ?? null,
            testStep: row.testStep ?? null,
            expectedResult: row.expectedResult ?? null,
            actualResult: row.actualResult ?? null,
            iosStatus: row.iosStatus ?? null,
            androidStatus: row.androidStatus ?? null,
            version: row.version ?? null,
          });
        } else if (issueType === 'issue') {
          Object.assign(updateSet, {
            module: row.module ?? null,
            initialCondition: row.initialCondition ?? null,
            testStep: row.testStep ?? null,
            expectedResult: row.expectedResult ?? null,
            actualResult: row.actualResult ?? null,
            evidence: row.evidence ?? null,
            severity: row.severity ?? null,
            statusTest: row.statusTest ?? null,
            statusDev: row.statusDev ?? null,
            device: row.device ?? null,
            note: row.note ?? null,
            issueDate: row.issueDate ?? null,
          });
        }

        await TrackerIssue.updateOne({ _id: existing._id }, { $set: updateSet });
        emit('tracker:issue:updated', {
          _id: String(existing._id),
          projectId: String(projectId),
          title: row.title,
          status: row.status,
          priority: row.priority,
          type: issueType,
          assignees: row.assignees,
          closedAt,
          ...(issueType === 'testcase' ? { iosStatus: row.iosStatus ?? null, androidStatus: row.androidStatus ?? null, version: row.version ?? null } : {}),
          ...(issueType === 'issue' ? { statusTest: row.statusTest ?? null, statusDev: row.statusDev ?? null, device: row.device ?? null } : {}),
        });
        stats.updatedIssues++;
      } else if (existing.sheetRowIndex !== row.rowIndex || !existing.sheetName) {
        await TrackerIssue.updateOne({ _id: existing._id }, { $set: { sheetRowIndex: row.rowIndex, sheetName } });
      }
    }
  }

  return colMap;
}

// ── Auto-detect sheet tab format ──────────────────────────────────────────────

async function autoDetectTabType(spreadsheetId: string, sheetName: string): Promise<IssueType | null> {
  const sheets = getSheetsClient();
  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A1:U20`,
    });
  } catch {
    return null;
  }

  const raw: any[][] = response.data.values || [];
  if (raw.length < 2) return null;

  const found = findHeaderRow(raw);
  return found ? found.type : null;
}

// ── Sync one project (all sheet tabs) ─────────────────────────────────────────

export async function syncSheetForProject(project: any): Promise<{ newIssues: number; updatedIssues: number }> {
  if (!project.googleSheetId) return { newIssues: 0, updatedIssues: 0 };

  const projectId = project._id as mongoose.Types.ObjectId;
  const existingCount = await TrackerIssue.countDocuments({ projectId });
  const isInitial = existingCount === 0;
  const stats = { newIssues: 0, updatedIssues: 0 };

  let allTabs: string[];
  try {
    const tabsWithIds = await getSheetTabsWithIds(project.googleSheetId);
    allTabs = tabsWithIds.map(t => t.name);
    // Persist tab→gid mapping so frontend can build tab-specific URLs
    await TrackerProject.updateOne({ _id: project._id }, { $set: { googleSheetTabs: tabsWithIds } });
  } catch (err) {
    console.error('[SHEET_SYNC] Failed to get sheet tabs:', (err as Error).message);
    return stats;
  }

  let lastColMap: Record<string, number> = {};

  for (const tabName of allTabs) {
    try {
      const detectedType = await autoDetectTabType(project.googleSheetId, tabName);
      if (!detectedType) {
        console.log(`[SHEET_SYNC] Tab "${tabName}" — not a recognized testcase/issue sheet, skipping`);
        continue;
      }
      console.log(`[SHEET_SYNC] Tab "${tabName}" detected as: ${detectedType}`);
      const colMap = await syncSheetTab(project, tabName, detectedType, isInitial, stats);
      void colMap; // colMap retained per-tab but no longer merged for bug type
      await sleep(1000);
    } catch (err) {
      console.error(`[SHEET_SYNC] Error syncing tab "${tabName}":`, (err as Error).message);
    }
  }

  const lastSync = new Date();
  await TrackerProject.updateOne(
    { _id: project._id },
    { $set: { googleSheetLastSync: lastSync } }
  );

  // Notify client: initial bulk import or incremental sync complete
  if (isInitial && stats.newIssues > 0) {
    emit('tracker:sheet:imported', { projectId: String(projectId), count: stats.newIssues });
  }
  emit('tracker:project:synced', {
    projectId: String(projectId),
    source: 'sheet',
    newIssues: stats.newIssues,
    updatedIssues: stats.updatedIssues,
    lastSync,
  });

  return stats;
}

// ── Scan all sheet-linked projects ────────────────────────────────────────────

export async function runSheetSync(): Promise<void> {
  const projects = await TrackerProject.find({
    googleSheetId: { $exists: true, $ne: null, $gt: '' },
  });

  if (projects.length === 0) return;

  console.log(`[SHEET_SYNC] Syncing ${projects.length} project(s) at ${new Date().toISOString()}`);

  for (const project of projects) {
    try {
      const { newIssues, updatedIssues } = await syncSheetForProject(project);
      console.log(`[SHEET_SYNC] "${project.name}": +${newIssues} new, ${updatedIssues} updated`);
      await sleep(2000);
    } catch (err) {
      console.error(`[SHEET_SYNC] Error for "${project.name}":`, (err as Error).message);
    }
  }

  console.log('[SHEET_SYNC] Done');
}

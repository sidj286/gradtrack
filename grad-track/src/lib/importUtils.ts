// src/lib/importUtils.ts
import * as XLSX from 'xlsx';

export interface MasterListRecord {
  student_id: string;
  full_name: string;
  email: string;
  course: string;
  batch_year: number;
  department: string;
  gender?: string | null;
  verified: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  inserted: number;
  skipped: number;
  errors: string[];
}

export const REQUIRED_COLUMNS = ['student_id', 'full_name', 'email', 'course', 'batch_year', 'department'];

// ============================================================
// DEPARTMENT MAPPING
// ============================================================

export const DEPARTMENT_MAPPING: Record<string, string> = {
  'BS Information Technology': 'CCS',
  'BSIT': 'CCS',
  'BS Computer Science': 'CCS',
  'BSCS': 'CCS',
  'BS Accountancy': 'CBE',
  'BSA': 'CBE',
  'BSBA Financial Management': 'CBE',
  'BSBA-FM': 'CBE',
  'BSBA Marketing Management': 'CBE',
  'BSBA-MM': 'CBE',
  'BSBA Human Resource Management': 'CBE',
  'BSBA-HRM': 'CBE',
  'BSBA Operations Management': 'CBE',
  'BSBA-OM': 'CBE',
  'BS Hospitality Management': 'CBE',
  'BSHM': 'CBE',
  'BS Tourism Management': 'CBE',
  'BS-TM': 'CBE',
  'BSTM': 'CBE',
  'BS Psychology': 'PSY',
  'BSPsych': 'PSY',
  'BS Criminology': 'CCJE',
  'BSCRIM': 'CCJE',
  'Bachelor of Elementary Education': 'CTE',
  'BEED': 'CTE',
  'BEEd': 'CTE',
  'Bachelor of Secondary Education': 'CTE',
  'BSED': 'CTE',
  'BSEd': 'CTE',
  // BSED Majors
  'Bachelor of Secondary Education - English': 'CTE',
  'Bachelor of Secondary Education - Math': 'CTE',
  'Bachelor of Secondary Education - Science': 'CTE',
  'Bachelor of Secondary Education - Social Studies': 'CTE',
  'Bachelor of Secondary Education - Filipino': 'CTE',
  'Bachelor of Secondary Education - MAPEH': 'CTE',
  'Bachelor of Secondary Education - Values Education': 'CTE',
  'Bachelor of Secondary Education - TLE': 'CTE',
  'BSED - English': 'CTE',
  'BSED - Math': 'CTE',
  'BSED - Science': 'CTE',
  'BSED - Social Studies': 'CTE',
  'BSED - Filipino': 'CTE',
  'BSED - MAPEH': 'CTE',
  'BSED - Values Education': 'CTE',
  'BSED - TLE': 'CTE',
  'BS Social Work': 'PSY',
  'BSSW': 'PSY',
  // Master of Arts in Education (MAED) Programs
  'Master of Arts in Education': 'CTE',
  'Master of Arts in Education - Educational Management': 'CTE',
  'MAED - Educational Management': 'CTE',
  'MAED-EM': 'CTE',
  'MAED EM': 'CTE',
  'Master of Arts in Education - Language Teaching': 'CTE',
  'MAED-LT': 'CTE',
  'MAED LT': 'CTE',
  'Master of Arts in Education - Mathematics': 'CTE',
  'MAED-MATH': 'CTE',
  'MAED MATH': 'CTE',
  'Master of Arts in Education - Guidance and Counseling': 'CTE',
  'MAED-GC': 'CTE',
  'MAED GC': 'CTE',
  'Master of Arts in Education - Physical Education': 'CTE',
  'MAED-PE': 'CTE',
  'MAED PE': 'CTE',
  'Master of Arts in Education - General Science': 'CTE',
  'MAED-SCIENCE': 'CTE',
  'MAED SCIENCE': 'CTE',
  'Master of Arts in Education - Social Studies': 'CTE',
  'MAED-SS': 'CTE',
  'MAED SS': 'CTE',
  'Master of Arts in Education - Early Childhood Education': 'CTE',
  'MAED-ECED': 'CTE',
  'MAED ECED': 'CTE',
  'Master of Arts in Education - Special Education': 'CTE',
  'MAED-SPED': 'CTE',
  'MAED SPED': 'CTE',
  'Master of Arts in Education - Administration and Supervision': 'CTE',
  'MAED-ADMIN': 'CTE',
  'MAED ADMIN': 'CTE',
  'Master of Arts in Education - Filipino': 'CTE',
  'MAED-FIL': 'CTE',
  'Master of Arts in Education - English': 'CTE',
  'MAED-ENG': 'CTE',
  'MAED': 'CTE',
};

// ============================================================
// FORMAT COURSE WITH MAJOR SPECIFICATION
// ============================================================

export const formatCourseWithMajor = (baseCourse: string, majorStr: string): string => {
  if (!majorStr || !majorStr.trim()) return baseCourse;
  const m = majorStr.trim();
  const base = baseCourse.trim();

  // If baseCourse already has a major specified (contains "-"), return base
  if (base.includes(' - ') || base.includes(' Major')) return base;

  const mUpper = m.toUpperCase();
  const baseUpper = base.toUpperCase();

  if (baseUpper.includes('SECONDARY EDUCATION') || baseUpper === 'BSED' || baseUpper === 'BSED') {
    if (/ENG|ENGLISH/i.test(mUpper)) return 'Bachelor of Secondary Education - English';
    if (/MATH/i.test(mUpper)) return 'Bachelor of Secondary Education - Math';
    if (/SCI|SCIENCE/i.test(mUpper)) return 'Bachelor of Secondary Education - Science';
    if (/SS|SOCIAL/i.test(mUpper)) return 'Bachelor of Secondary Education - Social Studies';
    if (/FIL|FILIPINO/i.test(mUpper)) return 'Bachelor of Secondary Education - Filipino';
    if (/MAPEH/i.test(mUpper)) return 'Bachelor of Secondary Education - MAPEH';
    if (/VE|VALUES/i.test(mUpper)) return 'Bachelor of Secondary Education - Values Education';
    if (/TLE|TECH/i.test(mUpper)) return 'Bachelor of Secondary Education - TLE';
  }

  if (baseUpper.includes('ARTS IN EDUCATION') || baseUpper === 'MAED') {
    if (/EM|ED.*MAN|EDUCATIONAL/i.test(mUpper)) return 'Master of Arts in Education - Educational Management';
    if (/LT|LANG/i.test(mUpper)) return 'Master of Arts in Education - Language Teaching';
    if (/MATH/i.test(mUpper)) return 'Master of Arts in Education - Mathematics';
    if (/GC|GUIDANCE/i.test(mUpper)) return 'Master of Arts in Education - Guidance and Counseling';
    if (/PE|PHYSICAL/i.test(mUpper)) return 'Master of Arts in Education - Physical Education';
    if (/SCI|SCIENCE/i.test(mUpper)) return 'Master of Arts in Education - General Science';
    if (/SS|SOCIAL/i.test(mUpper)) return 'Master of Arts in Education - Social Studies';
    if (/ECED|EARLY/i.test(mUpper)) return 'Master of Arts in Education - Early Childhood Education';
    if (/SPED|SPECIAL/i.test(mUpper)) return 'Master of Arts in Education - Special Education';
    if (/ADMIN/i.test(mUpper)) return 'Master of Arts in Education - Administration and Supervision';
    if (/FIL/i.test(mUpper)) return 'Master of Arts in Education - Filipino';
    if (/ENG/i.test(mUpper)) return 'Master of Arts in Education - English';
  }

  if (baseUpper.includes('BSBA') || baseUpper.includes('BUSINESS ADMINISTRATION')) {
    if (/FINANCIAL|FM/i.test(mUpper)) return 'BSBA Financial Management';
    if (/MARKETING|MM/i.test(mUpper)) return 'BSBA Marketing Management';
    if (/HUMAN|HR/i.test(mUpper)) return 'BSBA Human Resource Management';
    if (/OPERATIONS|OM/i.test(mUpper)) return 'BSBA Operations Management';
  }

  return `${base} - ${m}`;
};

// ============================================================
// EXTRACT COURSE AND BATCH YEAR FROM THE TITLE BLOCK (~A10)
// ============================================================

// Some registrar sheets are named/titled after just a MAJOR (e.g. a BSED
// sub-list titled only "FILIPINO", "MATH", "SCIENCE", "SOCIAL STUDIES")
// without ever repeating "BSED" or "Secondary Education" in the title block.
// These generic subject words are only consulted as a LAST-RESORT fallback.
const BSED_MAJOR_FALLBACK: { pattern: RegExp; value: string }[] = [
  { pattern: /\bFILIPINO\b/i, value: 'Bachelor of Secondary Education - Filipino' },
  { pattern: /\bMATH(?:EMATICS)?\b/i, value: 'Bachelor of Secondary Education - Math' },
  { pattern: /\bSCIENCE\b/i, value: 'Bachelor of Secondary Education - Science' },
  { pattern: /\bSOCIAL\s*STUDIES\b/i, value: 'Bachelor of Secondary Education - Social Studies' },
  { pattern: /\bVALUES\s*EDUCATION\b/i, value: 'Bachelor of Secondary Education - Values Education' },
  { pattern: /\bMAPEH\b/i, value: 'Bachelor of Secondary Education - MAPEH' },
  { pattern: /\bT\.?\s*L\.?\s*E\.?\b/i, value: 'Bachelor of Secondary Education - TLE' },
  { pattern: /\bENGLISH\b/i, value: 'Bachelor of Secondary Education - English' },
];

export const extractCourseFromSheet = (rawData: any[][], sheetName: string = ''): { course: string; batchYear: string; department: string } => {
  let extractedCourse = '';
  let extractedBatchYear = '';
  let extractedDepartment = '';

  const titleCandidates: string[] = [];
  if (sheetName) titleCandidates.push(sheetName);
  for (let i = 0; i < Math.min(rawData.length, 15); i++) {
    const row = rawData[i];
    if (!row) continue;
    for (const cell of row) {
      const v = cell?.toString().trim();
      if (v) titleCandidates.push(v);
    }
  }
  const combinedTitle = titleCandidates.join(' | ');
  console.log(`📌 Title block candidates: "${combinedTitle}"`);

  const coursePatterns = [
    // MAED (Master of Arts in Education) Programs & Majors
    { pattern: /\bMAED[\s\-_/()]*(?:EM|ED\s*MAN|EDUCATIONAL\s*MANAGEMENT)\b/i, value: 'Master of Arts in Education - Educational Management' },
    { pattern: /EDUCATIONAL\s*MANAGEMENT/i, value: 'Master of Arts in Education - Educational Management' },

    { pattern: /\bMAED[\s\-_/()]*(?:LT|LANG(?:UAGE)?\s*TEACHING)\b/i, value: 'Master of Arts in Education - Language Teaching' },
    { pattern: /LANGUAGE\s*TEACHING/i, value: 'Master of Arts in Education - Language Teaching' },

    { pattern: /\bMAED[\s\-_/()]*(?:MATH|MATHEMATICS)\b/i, value: 'Master of Arts in Education - Mathematics' },

    { pattern: /\bMAED[\s\-_/()]*(?:GC|GUIDANCE(?:\s*(?:AND|&)?\s*COUNSELING)?)\b/i, value: 'Master of Arts in Education - Guidance and Counseling' },
    { pattern: /GUIDANCE\s*(?:AND|&)?\s*COUNSELING/i, value: 'Master of Arts in Education - Guidance and Counseling' },

    { pattern: /\bMAED[\s\-_/()]*(?:PE|PHYSICAL\s*EDUCATION)\b/i, value: 'Master of Arts in Education - Physical Education' },

    { pattern: /\bMAED[\s\-_/()]*(?:SCI|SCIENCE|GEN(?:ERAL)?\s*SCI(?:ENCE)?)\b/i, value: 'Master of Arts in Education - General Science' },

    { pattern: /\bMAED[\s\-_/()]*(?:SS|SOCIAL\s*STUDIES)\b/i, value: 'Master of Arts in Education - Social Studies' },

    { pattern: /\bMAED[\s\-_/()]*(?:ECED|EARLY\s*CHILDHOOD(?:\s*EDUCATION)?)\b/i, value: 'Master of Arts in Education - Early Childhood Education' },

    { pattern: /\bMAED[\s\-_/()]*(?:SPED|SE|SPECIAL\s*EDUCATION)\b/i, value: 'Master of Arts in Education - Special Education' },

    { pattern: /\bMAED[\s\-_/()]*(?:ADMIN(?:ISTRATION)?(?:\s*(?:AND|&)?\s*SUPERVISION)?)\b/i, value: 'Master of Arts in Education - Administration and Supervision' },

    { pattern: /\bMAED[\s\-_/()]*(?:FIL|FILIPINO)\b/i, value: 'Master of Arts in Education - Filipino' },
    { pattern: /\bMAED[\s\-_/()]*(?:ENG|ENGLISH)\b/i, value: 'Master of Arts in Education - English' },

    { pattern: /\bMAED\b/i, value: 'Master of Arts in Education' },
    { pattern: /MASTER\s*OF\s*ARTS\s*IN\s*EDUCATION/i, value: 'Master of Arts in Education' },

    // BSED Programs with Specific Majors
    { pattern: /\bBSED[\s\-_/()]*(?:ENG|ENGLISH)\b/i, value: 'Bachelor of Secondary Education - English' },
    { pattern: /\bSECONDARY\s*EDUCATION[\s\-_/()]*(?:ENG|ENGLISH)\b/i, value: 'Bachelor of Secondary Education - English' },

    { pattern: /\bBSED[\s\-_/()]*(?:MATH|MATHEMATICS)\b/i, value: 'Bachelor of Secondary Education - Math' },
    { pattern: /\bSECONDARY\s*EDUCATION[\s\-_/()]*(?:MATH|MATHEMATICS)\b/i, value: 'Bachelor of Secondary Education - Math' },

    { pattern: /\bBSED[\s\-_/()]*(?:SCI|SCIENCE|GEN(?:ERAL)?\s*SCI(?:ENCE)?)\b/i, value: 'Bachelor of Secondary Education - Science' },
    { pattern: /\bSECONDARY\s*EDUCATION[\s\-_/()]*(?:SCI|SCIENCE|GEN(?:ERAL)?\s*SCI(?:ENCE)?)\b/i, value: 'Bachelor of Secondary Education - Science' },

    { pattern: /\bBSED[\s\-_/()]*(?:SS|SOCIAL\s*STUDIES)\b/i, value: 'Bachelor of Secondary Education - Social Studies' },
    { pattern: /\bSECONDARY\s*EDUCATION[\s\-_/()]*(?:SS|SOCIAL\s*STUDIES)\b/i, value: 'Bachelor of Secondary Education - Social Studies' },

    { pattern: /\bBSED[\s\-_/()]*(?:FIL|FILIPINO)\b/i, value: 'Bachelor of Secondary Education - Filipino' },
    { pattern: /\bSECONDARY\s*EDUCATION[\s\-_/()]*(?:FIL|FILIPINO)\b/i, value: 'Bachelor of Secondary Education - Filipino' },

    { pattern: /\bBSED[\s\-_/()]*(?:MAPEH|PE|PHYSICAL)\b/i, value: 'Bachelor of Secondary Education - MAPEH' },
    { pattern: /\bBSED[\s\-_/()]*(?:VE|VALUES(?:\s*ED(?:UCATION)?)?)\b/i, value: 'Bachelor of Secondary Education - Values Education' },
    { pattern: /\bBSED[\s\-_/()]*(?:TLE|TECH(?:NOLOGY)?)\b/i, value: 'Bachelor of Secondary Education - TLE' },

    // BSBA Programs with Specific Majors
    { pattern: /FINANCIAL\s*MANAGEMENT/i, value: 'BSBA Financial Management' },
    { pattern: /BSBA[\s-]*FM/i, value: 'BSBA Financial Management' },
    { pattern: /MARKETING\s*MANAGEMENT/i, value: 'BSBA Marketing Management' },
    { pattern: /BSBA[\s-]*MM/i, value: 'BSBA Marketing Management' },
    { pattern: /HUMAN\s*RESOURCE(?:\s*MANAGEMENT)?/i, value: 'BSBA Human Resource Management' },
    { pattern: /BSBA[\s-]*HRM?/i, value: 'BSBA Human Resource Management' },
    { pattern: /OPERATIONS\s*MANAGEMENT/i, value: 'BSBA Operations Management' },
    { pattern: /BSBA[\s-]*OM/i, value: 'BSBA Operations Management' },

    // Generic Undergraduate Programs
    { pattern: /INFORMATION\s*TECHNOLOGY/i, value: 'BS Information Technology' },
    { pattern: /BSIT/i, value: 'BS Information Technology' },
    { pattern: /COMPUTER\s*SCIENCE/i, value: 'BS Computer Science' },
    { pattern: /BSCS/i, value: 'BS Computer Science' },
    { pattern: /ACCOUNTANCY/i, value: 'BS Accountancy' },
    { pattern: /BSA\b/i, value: 'BS Accountancy' },
    { pattern: /HOSPITALITY\s*MANAGEMENT/i, value: 'BS Hospitality Management' },
    { pattern: /BSHM/i, value: 'BS Hospitality Management' },
    { pattern: /TOURISM\s*MANAGEMENT/i, value: 'BS Tourism Management' },
    { pattern: /BS[\s-]*TM/i, value: 'BS Tourism Management' },
    { pattern: /BSTM/i, value: 'BS Tourism Management' },
    { pattern: /PSYCHOLOGY/i, value: 'BS Psychology' },
    { pattern: /BSPsych/i, value: 'BS Psychology' },
    { pattern: /CRIMINOLOGY/i, value: 'BS Criminology' },
    { pattern: /BSCRIM/i, value: 'BS Criminology' },
    { pattern: /ELEMENTARY\s*EDUCATION/i, value: 'Bachelor of Elementary Education' },
    { pattern: /BEED/i, value: 'Bachelor of Elementary Education' },
    { pattern: /BEEd/i, value: 'Bachelor of Elementary Education' },
    { pattern: /SECONDARY\s*EDUCATION/i, value: 'Bachelor of Secondary Education' },
    { pattern: /BSED/i, value: 'Bachelor of Secondary Education' },
    { pattern: /BSEd/i, value: 'Bachelor of Secondary Education' },
    { pattern: /SOCIAL\s*WORK/i, value: 'BS Social Work' },
    { pattern: /BSSW/i, value: 'BS Social Work' },
  ];

  for (const cp of coursePatterns) {
    if (cp.pattern.test(combinedTitle)) {
      extractedCourse = cp.value;
      extractedDepartment = DEPARTMENT_MAPPING[extractedCourse] || DEPARTMENT_MAPPING[sheetName.trim()] || '';
      console.log(`✅ Extracted course: "${extractedCourse}"`);
      break;
    }
  }

  // Last resort: generic BSED major-subject words (Filipino, Math, Science, etc.)
  if (!extractedCourse) {
    for (const bp of BSED_MAJOR_FALLBACK) {
      if (bp.pattern.test(combinedTitle)) {
        extractedCourse = bp.value;
        extractedDepartment = DEPARTMENT_MAPPING[extractedCourse] || '';
        console.log(`✅ Extracted course via BSED-major fallback: "${extractedCourse}" (matched "${bp.pattern}")`);
        break;
      }
    }
  }

  // Fallback for generic MAED / Master of Arts in Education if no specific pattern matched
  if (!extractedCourse && (/\bMAED\b/i.test(combinedTitle) || /MASTER\s*OF\s*ARTS\s*IN\s*EDUCATION/i.test(combinedTitle))) {
    extractedCourse = 'Master of Arts in Education';
    extractedDepartment = 'CTE';
  }

  // Guarantee that ANY MAED sheet is assigned to CTE (College of Teacher Education)
  if (!extractedDepartment && (/\bMAED\b/i.test(combinedTitle) || /Master of Arts in Education/i.test(combinedTitle) || /MAED/i.test(extractedCourse))) {
    extractedDepartment = 'CTE';
  }

  if (!extractedCourse) {
    console.log(`❌ Could not determine course/department from title or sheet name: "${combinedTitle}". This sheet will need a manual override.`);
  }

  // ------------------------------------------------------------
  // Batch year: prefer a "YYYY-YY" or "YYYY-YYYY" school-year range
  // (e.g. "School Year 2025-26") and use the END year, since that's
  // the actual graduating/batch year. Fall back to a bare 4-digit year.
  // ------------------------------------------------------------
  const rangeMatch = combinedTitle.match(/\b(20\d{2})\s*[-–]\s*(\d{2,4})\b/);
  if (rangeMatch) {
    const startYear = parseInt(rangeMatch[1], 10);
    const endPart = rangeMatch[2];
    let endYear: number;
    if (endPart.length === 2) {
      const century = Math.floor(startYear / 100) * 100;
      endYear = century + parseInt(endPart, 10);
      if (endYear <= startYear) endYear += 100; // safety for century wrap
    } else {
      endYear = parseInt(endPart, 10);
    }
    extractedBatchYear = endYear.toString();
    console.log(`✅ Extracted batch year from range "${rangeMatch[0]}": "${extractedBatchYear}"`);
  } else {
    const yearMatch = combinedTitle.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      extractedBatchYear = yearMatch[1];
      console.log(`✅ Extracted batch year (single): "${extractedBatchYear}"`);
    }
  }

  return { course: extractedCourse, batchYear: extractedBatchYear, department: extractedDepartment };
};

// ============================================================
// SMART COLUMN DETECTION — by header text, not fixed position
// ============================================================

export interface DetectedColumns {
  student_id: number;
  surname: number;
  first_name: number;
  middle_name: number;
  gender: number;
  major?: number;
}

export const detectColumns = (headers: string[]): DetectedColumns => {
  const norm = headers.map(h => (h || '').toString().toLowerCase().trim());

  const findExact = (candidates: string[]) => norm.findIndex(h => candidates.includes(h));
  const findIncludes = (needle: string, exclude?: string) =>
    norm.findIndex(h => h.includes(needle) && (!exclude || !h.includes(exclude)));

  let student_id = findExact(['student id', 'student no', 'student no.', 'student number', 'student']);
  if (student_id === -1) student_id = findIncludes('student', 'name');

  let surname = findExact(['surname', 'last name', 'lastname']);
  if (surname === -1) surname = findIncludes('surname');
  if (surname === -1) surname = findIncludes('last name');

  let first_name = findExact(['first name', 'firstname']);
  if (first_name === -1) first_name = findIncludes('first name');

  let middle_name = findExact(['middle name', 'middle', 'middlename']);
  if (middle_name === -1) middle_name = findIncludes('middle');

  let gender = findExact(['gender', 'sex']);
  if (gender === -1) gender = findIncludes('gender');
  if (gender === -1) gender = findIncludes('sex');

  let major = findExact(['major', 'specialization', 'major program', 'program major', 'concentration', 'track', 'course major']);
  if (major === -1) major = findIncludes('major', 'name');
  if (major === -1) major = findIncludes('specialization');

  return { student_id, surname, first_name, middle_name, gender, major: major !== -1 ? major : undefined };
};

const REQUIRED_DETECTED = ['student_id', 'surname', 'first_name'] as const;

const isUsableColumnSet = (cols: DetectedColumns): boolean =>
  REQUIRED_DETECTED.every(key => cols[key] !== -1);

// ------------------------------------------------------------
// COLUMN RANGES — handles merged header cells
// ------------------------------------------------------------
// A header like "STUDENT ID" is often merged across several columns for
// display (e.g. columns C:F). sheet_to_json anchors that label at the FIRST
// column of the merge (C), but the actual value typed for each student row
// can end up in ANY cell within that merged width — not necessarily the
// anchor column. If we only ever read the anchor index, we can read an
// empty cell right next to the real data (this is exactly what caused
// "Skipping empty student_id" for every row even though the header was
// detected correctly).
//
// The fix: for each field, build a range from its detected column up to
// (but not including) the next detected field's column, and scan that whole
// range for the first non-empty cell.
type ColumnKey = keyof DetectedColumns;
export type ColumnRanges = Record<ColumnKey, [number, number]>;

const buildColumnRanges = (cols: DetectedColumns, totalCols: number): ColumnRanges => {
  const entries = (Object.entries(cols) as [ColumnKey, number][])
    .filter(([, idx]) => idx !== -1)
    .sort((a, b) => a[1] - b[1]);

  const ranges = {} as ColumnRanges;
  for (let i = 0; i < entries.length; i++) {
    const [key, idx] = entries[i];
    const nextIdx = i + 1 < entries.length ? entries[i + 1][1] : totalCols;
    ranges[key] = [idx, Math.max(idx, nextIdx - 1)];
  }
  return ranges;
};

const firstNonEmptyInRange = (row: any[], range?: [number, number]): string => {
  if (!range) return '';
  const [start, end] = range;
  for (let c = start; c <= end; c++) {
    const v = row[c];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
};

// ============================================================
// FIND HEADER ROW — try row 13 first, then scan for header keywords
// ============================================================

export const findHeaderRow = (rawData: any[][]): { headerRowIndex: number; headers: string[] } => {
  const targetRowIndex = 12; // row 13, the common registrar layout

  if (rawData.length > targetRowIndex) {
    const row = rawData[targetRowIndex];
    if (row && row.some(v => v && String(v).trim())) {
      const headers = row.map(v => (v ? String(v).trim() : ''));
      if (isUsableColumnSet(detectColumns(headers))) {
        console.log(`✅ Using row 13 (index ${targetRowIndex}) as header row:`, headers);
        return { headerRowIndex: targetRowIndex, headers };
      }
      console.log(`⚠️ Row 13 didn't look like a usable header row, scanning other rows...`);
    }
  }

  // Fallback: scan rows for something that looks like a header
  for (let i = 0; i < Math.min(rawData.length, 25); i++) {
    const row = rawData[i];
    if (!row) continue;
    const headers = row.map(v => (v ? String(v).trim() : ''));
    if (headers.every(h => !h)) continue;
    if (isUsableColumnSet(detectColumns(headers))) {
      console.log(`✅ Found usable header row at index ${i}:`, headers);
      return { headerRowIndex: i, headers };
    }
  }

  return { headerRowIndex: 0, headers: [] };
};

// ============================================================
// PARSE ALL SHEETS — SMART COLUMN DETECTION
// ============================================================

export const parseExcelAllSheets = (file: File): Promise<SheetData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetDataList: SheetData[] = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 }) as any[][];
          if (rawData.length === 0) continue;

          console.log(`\n📋 Processing sheet: "${sheetName}"`);
          const { course, batchYear, department } = extractCourseFromSheet(rawData, sheetName);
          const { headerRowIndex, headers } = findHeaderRow(rawData);
          if (headers.length === 0) {
            console.log(`⚠️ No headers found in sheet "${sheetName}", skipping`);
            continue;
          }

          const columns = detectColumns(headers);
          if (!isUsableColumnSet(columns)) {
            console.log(`⚠️ Sheet "${sheetName}": could not detect student_id/surname/first_name columns, skipping.`, columns, headers);
            continue;
          }
          console.log(`📌 Detected columns for "${sheetName}":`, columns, {
            student_id: headers[columns.student_id],
            surname: headers[columns.surname],
            first_name: headers[columns.first_name],
            middle_name: columns.middle_name !== -1 ? headers[columns.middle_name] : '(not found)',
            gender: columns.gender !== -1 ? headers[columns.gender] : '(not found)',
          });

          const columnRanges = buildColumnRanges(columns, headers.length);
          console.log(`📌 Column ranges for "${sheetName}" (handles merged headers):`, columnRanges);

          // Build data rows
          const jsonData: any[] = [];
          let skippedSmall = 0;
          let skippedEmpty = 0;
          let skippedName = 0;

          for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.every(v => !v || String(v).trim() === '')) continue;

            const studentId = firstNonEmptyInRange(row, columnRanges.student_id);
            const surname = firstNonEmptyInRange(row, columnRanges.surname);
            const firstName = firstNonEmptyInRange(row, columnRanges.first_name);
            const middleName = firstNonEmptyInRange(row, columnRanges.middle_name);
            const gender = firstNonEmptyInRange(row, columnRanges.gender);
            const major = columnRanges.major ? firstNonEmptyInRange(row, columnRanges.major) : '';

            // 1) Skip plain sequence numbers (1–999) that sometimes leak into a column
            const isSeq = /^\d+$/.test(studentId) && parseInt(studentId, 10) < 1000;
            if (isSeq) {
              console.log(`⏭️ Skipping small sequence number: "${studentId}"`);
              skippedSmall++;
              continue;
            }

            // 2) Skip empty student ID
            if (!studentId) {
              console.log(`⏭️ Skipping empty student_id`);
              skippedEmpty++;
              continue;
            }

            // 3) Skip rows without a name
            if (!surname && !firstName) {
              console.log(`⏭️ Skipping row with no name`);
              skippedName++;
              continue;
            }

            jsonData.push({
              student_id: studentId,
              surname,
              first_name: firstName,
              middle_name: middleName,
              gender,
              major,
            });
          }

          console.log(`📊 Sheet "${sheetName}": ${jsonData.length} valid rows, skipped: ${skippedSmall} (seq), ${skippedEmpty} (empty ID), ${skippedName} (no name)`);

          if (jsonData.length > 0) {
            sheetDataList.push({
              name: sheetName,
              data: jsonData,
              headers,
              course,
              batchYear,
              department,
              rowCount: jsonData.length,
              columnMap: columns as unknown as Record<string, number>,
            });
          }
        }

        console.log(`\n📊 Total sheets with data: ${sheetDataList.length}`);
        resolve(sheetDataList);
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

export interface SheetData {
  name: string;
  data: any[];
  headers: string[];
  course: string;
  batchYear: string;
  department: string;
  rowCount: number;
  columnMap?: Record<string, number>;
}

// ============================================================
// CSV PARSER (unchanged)
// ============================================================

export const parseCSV = (file: File): Promise<{ data: any[]; headers: string[]; metadata: any }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
          reject(new Error('File is empty'));
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim());
            const row: any = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] || '';
            });
            data.push(row);
          }
        }
        resolve({ data, headers, metadata: { course: '', batchYear: '', department: '' } });
      } catch (error) {
        reject(new Error('Failed to parse CSV file: ' + (error as Error).message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// ============================================================
// TRANSFORM AND VALIDATE
// ============================================================

export const transformData = (row: any, metadata: any = {}): any => {
  const result: any = {};
  let studentId = row.student_id?.toString().trim() || '';
  if (!studentId) return null;
  result.student_id = studentId;

  const surname = row.surname?.toString().trim() || '';
  const firstName = row.first_name?.toString().trim() || '';
  const middleName = row.middle_name?.toString().trim() || '';

  let fullName = '';
  if (surname) fullName += surname;
  if (firstName) fullName += (fullName ? ', ' : '') + firstName;
  if (middleName && middleName.trim()) fullName += ' ' + middleName;
  result.full_name = fullName.trim() || studentId;

  let gender: string | null = null;
  if (row.gender) {
    const g = row.gender.toString().trim().toLowerCase();
    if (g === 'male' || g === 'm' || g === 'man') gender = 'Male';
    else if (g === 'female' || g === 'f' || g === 'woman') gender = 'Female';
    else gender = null; // database schema constraint requires NULL (not empty string "") if not Male or Female
  }
  result.gender = gender;

  let rawCourse = metadata.course || 'Unknown';
  let rowMajor = row.major?.toString().trim() || '';
  result.course = rowMajor ? formatCourseWithMajor(rawCourse, rowMajor) : rawCourse;
  result.batch_year = metadata.batchYear ? parseInt(metadata.batchYear) : new Date().getFullYear();
  // IMPORTANT: no silent default here. If the course/department couldn't be
  // detected from the sheet, leave department blank rather than guessing
  // 'CCS' — a wrong-but-confident label is worse than an empty one, because
  // it hides the problem instead of surfacing it. validateAndTransformData
  // will flag blank departments as a warning so they're easy to spot and fix.
  result.department = metadata.department || '';
  result.email = `${studentId}@crmc.edu.ph`;

  return result;
};

export const validateAndTransformData = (rawData: any[], metadata: any = {}): { valid: MasterListRecord[]; errors: string[] } => {
  const valid: MasterListRecord[] = [];
  const errors: string[] = [];
  if (!rawData || rawData.length === 0) {
    errors.push('No data found in file');
    return { valid, errors };
  }

  const seenIds = new Set<string>();

  rawData.forEach((row, index) => {
    const rowNum = index + 14;
    try {
      const transformed = transformData(row, metadata);
      if (!transformed) return;

      const batchYearValue = typeof transformed.batch_year === 'number' ? transformed.batch_year : parseInt(transformed.batch_year);
      if (isNaN(batchYearValue) || batchYearValue < 1900 || batchYearValue > 2100) {
        errors.push(`Row ${rowNum}: Invalid batch_year: ${batchYearValue}`);
        return;
      }

      const validDepts = ['CCS', 'CTE', 'CCJE', 'CBE', 'PSY'];
      let dept = transformed.department?.toUpperCase().trim() || '';
      const courseName = transformed.course.toString().trim();

      if (!dept || !validDepts.includes(dept)) {
        for (const [key, value] of Object.entries(DEPARTMENT_MAPPING)) {
          if (courseName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(courseName.toLowerCase())) {
            dept = value;
            break;
          }
        }
        // Specific fallback for any MAED or Education degree -> CTE
        if (!dept && /MAED|Master of Arts in Education|Education/i.test(courseName)) {
          dept = 'CTE';
        }
      }

      if (!dept || !validDepts.includes(dept)) {
        // Do NOT silently stamp this as 'CCS' — that hides a detection
        // failure behind a confident-looking (but wrong) label. Leave it
        // blank and surface a warning so it's obvious this row needs a
        // manual look, instead of quietly polluting the CCS department.
        errors.push(`Row ${rowNum}: Could not determine department for course "${transformed.course}" — left blank, please verify manually`);
        dept = '';
      }

      const studentId = transformed.student_id.trim();

      // Guard against duplicate student_id WITHIN the same import batch —
      // the DB unique constraint will reject the whole batch insert otherwise.
      if (seenIds.has(studentId)) {
        errors.push(`Row ${rowNum}: Duplicate student_id "${studentId}" within this import, skipped`);
        return;
      }
      seenIds.add(studentId);

      const record: MasterListRecord = {
        student_id: studentId,
        full_name: transformed.full_name.trim(),
        email: transformed.email.trim().toLowerCase(),
        course: transformed.course.trim(),
        batch_year: batchYearValue,
        department: dept,
        gender: (transformed.gender === 'Male' || transformed.gender === 'Female') ? transformed.gender : null,
        verified: true,
      };
      if (!record.email.includes('@')) record.email = `${record.student_id}@crmc.edu.ph`;
      valid.push(record);
    } catch (error) {
      errors.push(`Row ${rowNum}: ${(error as Error).message}`);
    }
  });

  console.log(`✅ Validated ${valid.length} records, ${errors.length} errors`);
  return { valid, errors };
};

export const getPreviewData = (data: any[], limit: number = 5) => data.slice(0, limit);

// ============================================================
// EXPORTS FOR MODAL
// ============================================================

export const parseExcelAllSheetsWrapper = parseExcelAllSheets;

export const detectColumnMapping = (headers: string[]): Record<string, string> => {
  const cols = detectColumns(headers);
  const mapping: Record<string, string> = {};
  if (cols.student_id !== -1) mapping['student_id'] = headers[cols.student_id] || 'STUDENT ID';
  if (cols.surname !== -1) mapping['surname'] = headers[cols.surname] || 'SURNAME';
  if (cols.first_name !== -1) mapping['first_name'] = headers[cols.first_name] || 'FIRST NAME';
  if (cols.middle_name !== -1) mapping['middle_name'] = headers[cols.middle_name] || 'MIDDLE';
  if (cols.gender !== -1) mapping['gender'] = headers[cols.gender] || 'GENDER';
  return mapping;
};

export const detectFormatTypeWrapper = (headers: string[]): 'standard' | 'registrar' => {
  const cols = detectColumns(headers);
  const hasSurname = cols.surname !== -1;
  const hasFirstName = cols.first_name !== -1;
  const hasGender = cols.gender !== -1;
  return (hasSurname && hasFirstName && hasGender) ? 'registrar' : 'standard';
};
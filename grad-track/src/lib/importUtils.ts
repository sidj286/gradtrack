// src/lib/importUtils.ts - CSV ONLY (No Excel dependency)

export interface MasterListRecord {
  student_id: string;
  full_name: string;
  email: string;
  course: string;
  batch_year: number;
  verified: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  inserted: number;
  skipped: number;
  errors: string[];
}

// ALL columns are required
export const REQUIRED_COLUMNS = ['student_id', 'full_name', 'email', 'course', 'batch_year'];

// Parse CSV file only
export const parseCSV = (file: File): Promise<{ data: any[]; headers: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        reject(new Error('File is empty'));
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
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
      resolve({ data, headers });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// Auto-detect and parse file (CSV only for now)
export const parseFile = async (file: File): Promise<{ data: any[]; headers: string[] }> => {
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  
  if (fileExt === 'csv') {
    return await parseCSV(file);
  } else {
    throw new Error('Please upload CSV files only. Excel files are not supported at this time.');
  }
};

// Validate and transform imported data - ALL fields required
export const validateAndTransformData = (rawData: any[]): { valid: MasterListRecord[]; errors: string[] } => {
  const valid: MasterListRecord[] = [];
  const errors: string[] = [];
  
  rawData.forEach((row, index) => {
    const rowNum = index + 2; // +2 because header is row 1
    
    // Check ALL required fields
    if (!row.student_id) {
      errors.push(`Row ${rowNum}: Missing student_id`);
      return;
    }
    if (!row.full_name) {
      errors.push(`Row ${rowNum}: Missing full_name`);
      return;
    }
    if (!row.email) {
      errors.push(`Row ${rowNum}: Missing email`);
      return;
    }
    if (!row.course) {
      errors.push(`Row ${rowNum}: Missing course`);
      return;
    }
    if (!row.batch_year) {
      errors.push(`Row ${rowNum}: Missing batch_year`);
      return;
    }
    
    // Validate email format
    const emailValue = row.email.toString().trim().toLowerCase();
    if (!emailValue.includes('@')) {
      errors.push(`Row ${rowNum}: Invalid email format`);
      return;
    }
    
    // Validate batch_year is a number
    const batchYearValue = parseInt(row.batch_year);
    if (isNaN(batchYearValue)) {
      errors.push(`Row ${rowNum}: Invalid batch_year (must be a number)`);
      return;
    }
    if (batchYearValue < 1900 || batchYearValue > 2100) {
      errors.push(`Row ${rowNum}: Invalid batch_year (must be between 1900-2100)`);
      return;
    }
    
    valid.push({
      student_id: row.student_id.toString().trim(),
      full_name: row.full_name.toString().trim(),
      email: emailValue,
      course: row.course.toString().trim(),
      batch_year: batchYearValue,
      verified: true,
    });
  });
  
  return { valid, errors };
};

// Preview data (first 5 rows)
export const getPreviewData = (data: any[], limit: number = 5) => {
  return data.slice(0, limit);
};
// src/lib/careerClassifier.ts
import { callGeminiForClassification } from './gemini';

export interface CareerAlignmentResult {
  alignment_status: string;  // 'In-Field', 'Out-of-Field', or 'Pending'
  confidence_score: number;
  reasoning: string;
  matched_skills: string[];
  source: 'gemini' | 'keyword' | 'cache' | 'fallback';
}

// Cache for already-classified job titles
const classificationCache = new Map<string, CareerAlignmentResult>();

// ============================================================
// COMPLETE PROGRAM LIST FOR CRMC (Based on your dropdown)
// ============================================================

// CCS Programs
const CCS_PROGRAMS = [
  'BS Information Technology',
  'BSIT',
  'Information Technology',
  'BS Computer Science',
  'Computer Science',
  'IT',
  'ComSci'
];

// CTE Programs (Teacher Education & Graduate Studies)
const CTE_PROGRAMS = [
  'Bachelor of Elementary Education',
  'Bachelor of Elementary Education (BEED)',
  'BEED',
  'Bachelor of Secondary Education',
  'Bachelor of Secondary Education - English',
  'Bachelor of Secondary Education - Math',
  'Bachelor of Secondary Education - Science',
  'Bachelor of Secondary Education - Social Studies',
  'Bachelor of Secondary Education - Filipino',
  'BSED English',
  'BSED Math',
  'BSED Science',
  'BSED Social Studies',
  'BSED Filipino',
  'Secondary Education',
  'Elementary Education',
  'Education',
  'Master of Arts in Education',
  'Master of Arts in Education - Educational Management',
  'Master of Arts in Education - Language Teaching',
  'Master of Arts in Education - Mathematics',
  'Master of Arts in Education - Guidance and Counseling',
  'Master of Arts in Education - Physical Education',
  'Master of Arts in Education - General Science',
  'Master of Arts in Education - Social Studies',
  'Master of Arts in Education - Early Childhood Education',
  'Master of Arts in Education - Special Education',
  'Master of Arts in Education - Administration and Supervision',
  'Master of Arts in Education - Filipino',
  'Master of Arts in Education - English',
  'MAED',
  'MAED-EM',
  'MAED EM',
  'MAED-LT',
  'MAED-MATH',
  'MAED-GC',
  'MAED-PE',
  'MAED-SCIENCE',
  'MAED-SS',
  'MAED-ECED',
  'MAED-SPED',
  'MAED-ADMIN'
];

// CCJE Programs (Criminal Justice)
const CCJE_PROGRAMS = [
  'BS Criminology',
  'Criminology',
  'BS Criminal Justice',
  'Criminal Justice'
];

// CBE Programs (Business Education)
const CBE_PROGRAMS = [
  'BS Accountancy',
  'Accountancy',
  'BSBA Financial Management',
  'BSBA',
  'Financial Management',
  'BS Hospitality Management',
  'BS Hospitality Management (BSHM)',
  'BSHM',
  'Hospitality Management',
  'BS Tourism Management',
  'BS Tourism Management (BSTM)',
  'BSTM',
  'Tourism Management',
  'Business Administration',
  'Business',
  'Accountancy',
  'Accounting'
];

// PSY Programs (Psychology)
const PSY_PROGRAMS = [
  'BS Psychology',
  'Psychology',
  'BS Psych',
  'Psych'
];

// ============================================================
// KEYWORD DATABASE for CRMC Programs (FALLBACK)
// ============================================================

const careerKeywords: Record<string, {
  inField: string[];
  outOfField: string[];
  programs: string[];
}> = {
  'CCS': {
    programs: CCS_PROGRAMS,
    inField: [
      'software', 'developer', 'programmer', 'coding', 'programming',
      'web', 'app', 'mobile', 'application', 'frontend', 'backend',
      'full stack', 'fullstack', 'devops', 'qa', 'quality assurance',
      'software engineer', 'software developer', 'web developer',
      'it', 'tech', 'technical', 'support', 'help desk', 'service desk',
      'it support', 'technical support', 'system admin', 'database admin',
      'network admin', 'system administrator', 'network engineer',
      'it administrator', 'it manager', 'it consultant',
      'data', 'analytics', 'database', 'data analyst', 'data scientist',
      'data engineer', 'business intelligence', 'bi',
      'cyber', 'security', 'cybersecurity', 'cloud', 'aws', 'azure',
      'devops', 'infrastructure', 'network', 'system',
      'engineer', 'computer', 'hardware', 'it engineer',
      'it staff', 'it officer', 'it specialist', 'computer technician',
      'it technician', 'tech support', 'it coordinator'
    ],
    outOfField: [
      'cashier', 'driver', 'warehouse', 'construction', 'factory', 
      'sales', 'security guard', 'janitor', 'laborer', 'farm', 
      'helper', 'delivery', 'cook', 'waiter', 'waitress',
      'barista', 'retail', 'merchandiser', 'sales clerk',
      'sales associate', 'customer service representative', 'call center agent',
      'bpo', 'virtual assistant', 'va', 'administrative assistant',
      'secretary', 'receptionist', 'encoder', 'data entry'
    ]
  },
  'CTE': {
    programs: CTE_PROGRAMS,
    inField: [
      'teacher', 'instructor', 'professor', 'educator', 'trainer',
      'faculty', 'teaching', 'lecturer', 'tutor', 'mentor', 'coach',
      'principal', 'school head', 'department head', 'academic coordinator',
      'curriculum developer', 'guidance counselor', 'school counselor',
      'librarian', 'school librarian',
      'english teacher', 'math teacher', 'science teacher', 'social studies teacher',
      'filipino teacher', 'elementary teacher', 'secondary teacher',
      'high school teacher', 'grade school teacher', 'preschool teacher',
      'kindergarten teacher', 'special education teacher', 'sped teacher',
      'academic', 'education', 'instructional', 'curriculum',
      'training officer', 'corporate trainer', 'learning specialist',
      'instructional designer', 'education specialist'
    ],
    outOfField: [
      'cashier', 'driver', 'warehouse', 'construction', 'factory', 
      'call center', 'bpo', 'sales', 'security guard', 'janitor',
      'cook', 'waiter', 'waitress', 'barista', 'retail',
      'programmer', 'software engineer', 'accountant', 'nurse',
      'police', 'criminology', 'psychologist'
    ]
  },
  'CCJE': {
    programs: CCJE_PROGRAMS,
    inField: [
      'police', 'law enforcement', 'pnp', 'policeman', 'policewoman',
      'patrol', 'sheriff', 'marshal', 'constable',
      'security', 'security guard', 'security officer', 'safety officer',
      'security supervisor', 'security manager', 'corporate security',
      'investigator', 'detective', 'private investigator', 'nbi', 'fbi',
      'criminal investigator', 'forensic', 'forensic investigator',
      'correctional', 'probation', 'parole', 'jail', 'prison',
      'correctional officer', 'jail officer', 'probation officer',
      'parole officer', 'court', 'prosecutor', 'legal researcher',
      'criminology', 'criminal justice', 'public safety',
      'intelligence officer', 'anti-money laundering', 'aml'
    ],
    outOfField: [
      'cashier', 'driver', 'warehouse', 'construction', 'factory',
      'programmer', 'software engineer', 'teacher', 'accountant',
      'nurse', 'call center', 'bpo', 'sales', 'cook', 'waiter'
    ]
  },
  'CBE': {
    programs: CBE_PROGRAMS,
    inField: [
      'accountant', 'accounting', 'finance', 'financial analyst',
      'audit', 'auditor', 'tax', 'tax accountant', 'bookkeeper',
      'financial manager', 'controller', 'cpa', 'accounting clerk',
      'accounts payable', 'accounts receivable', 'payroll',
      'business', 'manager', 'management', 'operations manager',
      'general manager', 'branch manager', 'area manager',
      'business analyst', 'business development', 'entrepreneur',
      'business owner', 'self-employed', 'small business',
      'marketing', 'sales', 'marketing manager', 'sales manager',
      'brand manager', 'product manager', 'digital marketing',
      'social media manager', 'content creator', 'sales executive',
      'sales representative', 'account executive', 'account manager',
      'hr', 'human resources', 'recruiter', 'hr manager', 'hr generalist',
      'hr assistant', 'recruitment', 'payroll manager', 'admin manager',
      'administrative', 'office manager', 'executive assistant',
      'hotel', 'restaurant', 'tourism', 'travel', 'events', 'front desk',
      'receptionist', 'hotel manager', 'restaurant manager', 'chef',
      'cook', 'food & beverage', 'fb manager', 'housekeeping',
      'travel agent', 'tour guide', 'event planner', 'event coordinator',
      'banquet manager', 'catering', 'flight attendant', 'stewardess',
      'bank', 'banking', 'bank teller', 'loan officer', 'credit analyst',
      'branch banking', 'investment banking'
    ],
    outOfField: []
  },
  'PSY': {
    programs: PSY_PROGRAMS,
    inField: [
      'psychologist', 'clinical psychologist', 'counselor', 'therapist',
      'mental health', 'mental health worker', 'psychotherapist',
      'guidance counselor', 'school counselor', 'rehabilitation counselor',
      'addiction counselor', 'marriage counselor', 'family therapist',
      'hr', 'human resources', 'recruiter', 'hr generalist', 'hr assistant',
      'recruitment specialist', 'talent acquisition', 'training specialist',
      'organizational development', 'od specialist', 'industrial psychology',
      'people operations', 'employee relations',
      'psychometrician', 'research assistant', 'research analyst',
      'academic researcher', 'psychology teacher', 'psychology instructor',
      'social worker', 'case manager', 'community worker',
      'rehabilitation', 'crisis counselor', 'hotline counselor'
    ],
    outOfField: [
      'cashier', 'driver', 'warehouse', 'construction', 'factory',
      'programmer', 'software engineer', 'police', 'security guard'
    ]
  }
};

// ============================================================
// DETECT DEPARTMENT FROM COURSE NAME
// ============================================================
function detectDepartment(course: string): string | null {
  if (!course) return null;
  
  const courseTrimmed = course.trim();
  const courseLower = courseTrimmed.toLowerCase();
  
  // Exact match first (CCS)
  if (CCS_PROGRAMS.some(prog => prog.toLowerCase() === courseLower)) return 'CCS';
  if (CTE_PROGRAMS.some(prog => prog.toLowerCase() === courseLower)) return 'CTE';
  if (CCJE_PROGRAMS.some(prog => prog.toLowerCase() === courseLower)) return 'CCJE';
  if (CBE_PROGRAMS.some(prog => prog.toLowerCase() === courseLower)) return 'CBE';
  if (PSY_PROGRAMS.some(prog => prog.toLowerCase() === courseLower)) return 'PSY';
  
  // Partial match fallback (case insensitive)
  if (courseLower.includes('information technology') || courseLower.includes('bsit') || courseLower.includes('computer') || courseLower.includes('it')) return 'CCS';
  if (courseLower.includes('education') || courseLower.includes('elementary') || courseLower.includes('secondary') || courseLower.includes('beed') || courseLower.includes('bsed') || courseLower.includes('teaching')) return 'CTE';
  if (courseLower.includes('criminology') || courseLower.includes('criminal') || courseLower.includes('crim')) return 'CCJE';
  if (courseLower.includes('business') || courseLower.includes('accountancy') || courseLower.includes('management') || courseLower.includes('hospitality') || courseLower.includes('tourism') || courseLower.includes('accounting') || courseLower.includes('hotel') || courseLower.includes('restaurant')) return 'CBE';
  if (courseLower.includes('psychology') || courseLower.includes('psych')) return 'PSY';
  
  return null;
}

// ============================================================
// GEMINI CLASSIFICATION (USING YOUR EXISTING API)
// ============================================================
async function geminiClassify(course: string, jobTitle: string): Promise<CareerAlignmentResult | null> {
  const prompt = `You are a career alignment classifier for Cebu Roosevelt Memorial Colleges (CRMC).

Graduate's degree/course: "${course}"
Graduate's job title: "${jobTitle}"

Determine if this graduate's job title is "In-Field" (related to their degree) or "Out-of-Field" (not related).

Rules:
- BSIT/Computer Science/Information Technology graduates: In-Field jobs include IT, software development, programming, tech support, data analytics, network admin, cybersecurity
- Education graduates: In-Field jobs include teaching, school administration, curriculum development, training
- Criminology graduates: In-Field jobs include police, law enforcement, security, investigation, forensics
- Business/Hospitality/Tourism graduates: In-Field jobs include accounting, management, HR, marketing, hotel, restaurant, tourism, events
- Psychology graduates: In-Field jobs include counseling, HR, guidance, mental health, social work

Return ONLY valid JSON in this exact format:
{
  "alignment_status": "In-Field" or "Out-of-Field",
  "confidence_score": number between 0 and 1,
  "reasoning": "brief explanation"
}`;

  // Call your existing Gemini API helper
  const result = await callGeminiForClassification(prompt);
  
  if (!result) return null;
  
  try {
    let cleanResponse = result.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/```\n?/g, '');
    }
    
    const parsed = JSON.parse(cleanResponse);
    
    if (parsed.alignment_status && (parsed.alignment_status === 'In-Field' || parsed.alignment_status === 'Out-of-Field')) {
      return {
        alignment_status: parsed.alignment_status,
        confidence_score: Math.min(Math.max(parsed.confidence_score || 0.7, 0), 1),
        reasoning: parsed.reasoning || 'Gemini API classification',
        matched_skills: [],
        source: 'gemini'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    return null;
  }
}

// ============================================================
// KEYWORD FALLBACK CLASSIFICATION
// ============================================================
function keywordFallbackClassify(course: string, jobTitle: string): CareerAlignmentResult | null {
  const department = detectDepartment(course);
  if (!department) return null;
  
  const keywords = careerKeywords[department];
  if (!keywords) return null;
  
  const jobLower = jobTitle.toLowerCase();
  
  const exactProgramMatch = keywords.programs.some(prog => 
    jobLower === prog.toLowerCase() || jobLower.includes(prog.toLowerCase())
  );
  
  const matchedInField = keywords.inField.filter(kw => jobLower.includes(kw));
  
  if (exactProgramMatch || matchedInField.length > 0) {
    let confidence = 0.7;
    if (exactProgramMatch) confidence = 0.9;
    if (matchedInField.length > 0) confidence += (matchedInField.length * 0.05);
    confidence = Math.min(confidence, 0.98);
    
    return {
      alignment_status: 'In-Field',
      confidence_score: confidence,
      reasoning: `"${jobTitle}" aligns with ${keywords.programs[0]}`,
      matched_skills: matchedInField,
      source: 'keyword'
    };
  }
  
  const matchedOutField = keywords.outOfField.filter(kw => jobLower.includes(kw));
  if (matchedOutField.length > 0) {
    return {
      alignment_status: 'Out-of-Field',
      confidence_score: 0.85,
      reasoning: `"${jobTitle}" does not align with ${keywords.programs[0]} degree`,
      matched_skills: [],
      source: 'keyword'
    };
  }
  
  return null;
}

// ============================================================
// FINAL FALLBACK (When all else fails)
// ============================================================
function finalFallback(course: string, jobTitle: string): CareerAlignmentResult {
  const department = detectDepartment(course);
  
  if (!department) {
    return {
      alignment_status: 'Pending',
      confidence_score: 0.2,
      reasoning: `Cannot determine alignment for "${jobTitle}" with ${course}`,
      matched_skills: [],
      source: 'fallback'
    };
  }
  
  const keywords = careerKeywords[department];
  const programName = keywords?.programs[0] || 'your degree';
  const jobLower = jobTitle.toLowerCase();
  const hasPositiveIndicator = keywords?.inField.some(kw => jobLower.includes(kw)) || false;
  
  if (hasPositiveIndicator) {
    return {
      alignment_status: 'In-Field',
      confidence_score: 0.65,
      reasoning: `"${jobTitle}" may align with ${programName}`,
      matched_skills: [],
      source: 'fallback'
    };
  }
  
  return {
    alignment_status: 'Pending',
    confidence_score: 0.4,
    reasoning: `"${jobTitle}" needs manual review for ${programName}`,
    matched_skills: [],
    source: 'fallback'
  };
}

// ============================================================
// MAIN CLASSIFICATION FUNCTION
// ============================================================
export async function classifyCareerAlignment(
  course: string,
  jobTitle: string,
  _jobDescription?: string
): Promise<CareerAlignmentResult> {
  // Validate inputs
  if (!jobTitle || jobTitle.trim() === '') {
    return {
      alignment_status: 'Pending',
      confidence_score: 0,
      reasoning: 'No job title provided',
      matched_skills: [],
      source: 'fallback'
    };
  }

  if (!course || course.trim() === '') {
    return {
      alignment_status: 'Pending',
      confidence_score: 0,
      reasoning: 'No degree/course information available',
      matched_skills: [],
      source: 'fallback'
    };
  }

  // Check cache first
  const cacheKey = `${course}|${jobTitle}`;
  if (classificationCache.has(cacheKey)) {
    return { ...classificationCache.get(cacheKey)!, source: 'cache' };
  }
  
  // PRIORITY 1: Try Gemini API (Primary)
  console.log('=== GEMINI CLASSIFICATION (Primary) ===');
  console.log('Course:', course);
  console.log('Job Title:', jobTitle);
  
  const geminiResult = await geminiClassify(course, jobTitle);
  
  if (geminiResult && geminiResult.alignment_status !== 'Pending') {
    classificationCache.set(cacheKey, geminiResult);
    console.log('Gemini result:', geminiResult);
    return geminiResult;
  }
  
  // PRIORITY 2: Try Keyword Matching (Fallback)
  console.log('Gemini failed or rate limited, using keyword fallback');
  const keywordResult = keywordFallbackClassify(course, jobTitle);
  
  if (keywordResult) {
    classificationCache.set(cacheKey, keywordResult);
    return keywordResult;
  }
  
  // PRIORITY 3: Final Fallback
  const fallbackResult = finalFallback(course, jobTitle);
  classificationCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
export function getAlignmentDisplay(alignmentStatus: string | null): string {
  if (alignmentStatus === 'In-Field') return 'In-Field';
  if (alignmentStatus === 'Out-of-Field') return 'Out-of-Field';
  return 'Pending';
}

export function getAlignmentBadgeColor(alignmentStatus: string | null): string {
  if (alignmentStatus === 'In-Field') return 'bg-green-100 text-green-700';
  if (alignmentStatus === 'Out-of-Field') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-500';
}

export function clearClassificationCache(): void {
  classificationCache.clear();
}
// src/lib/careerClassifier.ts
import { callGeminiForClassification } from './gemini';

export interface CareerAlignmentResult {
  alignment_status: string;  // 'In-Field', 'Out-of-Field', or 'Pending'
  confidence_score: number;
  reasoning: string;
  matched_skills: string[];
  source: 'gemini' | 'keyword' | 'cache' | 'fallback';
}

// Memory cache for classified job titles (Key: `${course}|${jobTitle}`)
const classificationCache = new Map<string, CareerAlignmentResult>();

// ============================================================
// COMPLETE PROGRAM & MAJOR CATALOG FOR CRMC
// ============================================================

// CCS Programs (Computer Studies)
const CCS_PROGRAMS = [
  'BS Information Technology',
  'BSIT',
  'Information Technology',
  'BS Computer Science',
  'Computer Science',
  'BSCS',
  'IT',
  'ComSci',
  'Software Engineering',
  'Computer Applications'
];

// CTE Programs (Teacher Education & Graduate Studies)
const CTE_PROGRAMS = [
  'Bachelor of Elementary Education',
  'Bachelor of Elementary Education (BEED)',
  'BEED',
  'Elementary Education',
  'Bachelor of Secondary Education',
  'Bachelor of Secondary Education - English',
  'Bachelor of Secondary Education - Math',
  'Bachelor of Secondary Education - Science',
  'Bachelor of Secondary Education - Social Studies',
  'Bachelor of Secondary Education - Filipino',
  'Bachelor of Secondary Education - MAPEH',
  'Bachelor of Secondary Education - Values Education',
  'Bachelor of Secondary Education - TLE',
  'BSED',
  'BSED English',
  'BSED Math',
  'BSED Science',
  'BSED Social Studies',
  'BSED Filipino',
  'BSED MAPEH',
  'BSED Values Education',
  'BSED TLE',
  'Secondary Education',
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
  'Criminal Justice',
  'BSCrim'
];

// CBE Programs (Business Education & Hospitality)
const CBE_PROGRAMS = [
  'BS Accountancy',
  'Accountancy',
  'BSBA Financial Management',
  'BSBA Marketing Management',
  'BSBA Human Resource Management',
  'BSBA Operations Management',
  'BSBA',
  'BS Business Administration',
  'Financial Management',
  'Marketing Management',
  'Human Resource Management',
  'Operations Management',
  'BS Hospitality Management',
  'BS Hospitality Management (BSHM)',
  'BSHM',
  'Hospitality Management',
  'Hotel and Restaurant Management',
  'HRM',
  'BS Tourism Management',
  'BS Tourism Management (BSTM)',
  'BSTM',
  'Tourism Management',
  'Tourism',
  'Business Administration',
  'Business',
  'Accounting'
];

// PSY & Social Work Programs
const PSY_PROGRAMS = [
  'BS Psychology',
  'Psychology',
  'BS Psych',
  'Psych',
  'BS Social Work',
  'Social Work',
  'BSSW'
];

// ============================================================
// EXPANDED IN-FIELD KEYWORD DICTIONARIES WITH MAJOR SPECIFICITY
// ============================================================

const IN_FIELD_KEYWORDS: Record<string, string[]> = {
  CCS: [
    'software', 'developer', 'programmer', 'coding', 'programming',
    'web', 'app', 'mobile', 'frontend', 'backend', 'fullstack', 'full stack',
    'devops', 'qa', 'quality assurance', 'software engineer', 'web developer',
    'it', 'tech', 'technical', 'support', 'help desk', 'helpdesk', 'service desk',
    'it support', 'technical support', 'system admin', 'database admin', 'dba',
    'network admin', 'system administrator', 'network engineer', 'it manager',
    'it consultant', 'data analyst', 'data scientist', 'data engineer', 'bi analyst',
    'cybersecurity', 'cloud engineer', 'aws', 'azure', 'infrastructure',
    'it staff', 'it officer', 'it specialist', 'computer technician', 'it technician',
    'tsr', 'technical support representative', 'ui/ux', 'web designer', 'systems analyst'
  ],
  CTE: [
    'teacher', 'instructor', 'professor', 'educator', 'trainer', 'faculty',
    'teaching', 'lecturer', 'tutor', 'mentor', 'coach', 'principal',
    'school head', 'academic coordinator', 'curriculum developer',
    'guidance counselor', 'school counselor', 'librarian', 'lpt',
    'english teacher', 'math teacher', 'science teacher', 'social studies teacher',
    'filipino teacher', 'mapeh teacher', 'tle teacher', 'elementary teacher',
    'secondary teacher', 'high school teacher', 'grade school teacher',
    'preschool teacher', 'kindergarten teacher', 'special education teacher',
    'sped teacher', 'deped teacher', 'deped teacher i', 'deped teacher ii',
    'deped teacher iii', 'master teacher', 'esl teacher', 'online tutor',
    'training officer', 'corporate trainer', 'learning specialist',
    'instructional designer', 'education specialist', 'subject teacher'
  ],
  CCJE: [
    'police', 'law enforcement', 'pnp', 'policeman', 'policewoman', 'patrolman',
    'patrolwoman', 'sheriff', 'marshal', 'security', 'security guard',
    'security officer', 'safety officer', 'security supervisor', 'security manager',
    'investigator', 'detective', 'private investigator', 'nbi', 'criminologist',
    'criminal investigator', 'forensic', 'correctional', 'probation', 'parole',
    'jail', 'prison', 'correctional officer', 'jail officer', 'probation officer',
    'parole officer', 'bjmp', 'bfp', 'court officer', 'prosecutor staff',
    'legal researcher', 'process server', 'public safety officer',
    'intelligence officer', 'anti-money laundering officer', 'aml analyst'
  ],
  CBE: [
    'accountant', 'accounting', 'finance', 'financial analyst', 'audit', 'auditor',
    'tax', 'bookkeeper', 'financial manager', 'controller', 'cpa', 'accounting clerk',
    'accounts payable', 'accounts receivable', 'payroll', 'manager', 'management',
    'operations manager', 'general manager', 'branch manager', 'store manager',
    'supervisor', 'business analyst', 'business development', 'entrepreneur',
    'business owner', 'merchant', 'marketing', 'sales', 'marketing manager',
    'sales manager', 'brand manager', 'product manager', 'digital marketing',
    'social media manager', 'content creator', 'sales executive', 'sales representative',
    'account executive', 'account manager', 'hr', 'human resources', 'recruiter',
    'hr manager', 'hr generalist', 'hr assistant', 'talent acquisition',
    'administrative assistant', 'admin officer', 'office manager', 'executive assistant',
    'hotel', 'restaurant', 'tourism', 'travel', 'front desk', 'receptionist',
    'hotel manager', 'restaurant manager', 'chef', 'cook', 'food & beverage',
    'f&b supervisor', 'housekeeping', 'travel agent', 'tour guide', 'event planner',
    'event coordinator', 'flight attendant', 'bank', 'banking', 'bank teller',
    'loan officer', 'credit analyst', 'cashier', 'store supervisor'
  ],
  PSY: [
    'psychologist', 'counselor', 'therapist', 'mental health', 'psychotherapist',
    'guidance counselor', 'school counselor', 'rehabilitation counselor',
    'hr', 'human resources', 'recruiter', 'hr generalist', 'hr assistant',
    'talent acquisition', 'training specialist', 'organizational development',
    'people operations', 'employee relations', 'psychometrician',
    'research assistant', 'research analyst', 'psychology teacher',
    'social worker', 'case manager', 'community worker', 'crisis counselor',
    'rehabilitation specialist', 'welfare officer'
  ]
};

// MAJOR SPECIFIC EXTRA KEYWORDS
const MAJOR_SPECIFIC_KEYWORDS: Record<string, string[]> = {
  'english': ['english', 'esl', 'language', 'literature', 'copywriter', 'writer', 'editor', 'proofreader', 'content writer'],
  'math': ['math', 'mathematics', 'algebra', 'geometry', 'statistics', 'statistician', 'data analyst'],
  'science': ['science', 'biology', 'chemistry', 'physics', 'lab analyst', 'laboratory', 'researcher'],
  'financial management': ['finance', 'financial', 'bank', 'teller', 'loan', 'credit', 'investment', 'treasury'],
  'marketing management': ['marketing', 'brand', 'digital marketing', 'seo', 'social media', 'advertising', 'sales'],
  'human resource management': ['hr', 'human resources', 'recruiter', 'talent acquisition', 'payroll', 'training'],
  'educational management': ['principal', 'supervisor', 'administrator', 'school head', 'coordinator', 'academic director']
};

// DEFINITIVE OUT-OF-FIELD KEYWORDS (FOR NON-MATCHED DEGREES)
const UNIVERSAL_OUT_OF_FIELD_KEYWORDS = [
  'factory worker', 'production operator', 'line worker', 'assembly line',
  'construction worker', 'mason', 'carpenter', 'welder', 'laborer', 'stevedore',
  'delivery rider', 'courier', 'driver', 'tricycle driver', 'jeepney driver',
  'farm worker', 'agricultural laborer', 'fisherman', 'janitor', 'cleaner',
  'utility worker', 'housekeeper', 'housemaid', 'nanny', 'caregiver',
  'dishwasher', 'busboy', 'bagger', 'helper'
];

// ============================================================
// DEPARTMENT DETECTOR FROM COURSE / DEGREE TITLE
// ============================================================
export function detectDepartment(course: string): string | null {
  if (!course || typeof course !== 'string') return null;

  const cTrimmed = course.trim();
  const cLower = cTrimmed.toLowerCase();

  // Exact match first
  if (CCS_PROGRAMS.some(p => p.toLowerCase() === cLower)) return 'CCS';
  if (CTE_PROGRAMS.some(p => p.toLowerCase() === cLower)) return 'CTE';
  if (CCJE_PROGRAMS.some(p => p.toLowerCase() === cLower)) return 'CCJE';
  if (CBE_PROGRAMS.some(p => p.toLowerCase() === cLower)) return 'CBE';
  if (PSY_PROGRAMS.some(p => p.toLowerCase() === cLower)) return 'PSY';

  // Substring match
  if (/\b(it|bsit|bs cs|computer|software|tech|information technology)\b/i.test(cLower)) return 'CCS';
  if (/\b(education|beed|bsed|maed|teacher|teaching|elementary|secondary)\b/i.test(cLower)) return 'CTE';
  if (/\b(criminology|criminal|crim|bscrim|police)\b/i.test(cLower)) return 'CCJE';
  if (/\b(business|accountancy|bsba|bshm|bstm|management|hospitality|tourism|accounting|hotel|restaurant|finance|marketing)\b/i.test(cLower)) return 'CBE';
  if (/\b(psychology|psych|social work)\b/i.test(cLower)) return 'PSY';

  return null;
}

// ============================================================
// FAST HIGH-CONFIDENCE KEYWORD CLASSIFIER
// ============================================================
function fastKeywordClassify(course: string, jobTitle: string): CareerAlignmentResult | null {
  const dept = detectDepartment(course);
  if (!dept) return null;

  const jobLower = jobTitle.toLowerCase().trim();
  const cLower = course.toLowerCase().trim();

  // Check universal out-of-field keywords first
  const isUniversalOut = UNIVERSAL_OUT_OF_FIELD_KEYWORDS.some(kw => jobLower.includes(kw));
  if (isUniversalOut && dept !== 'CCJE') {
    return {
      alignment_status: 'Out-of-Field',
      confidence_score: 0.92,
      reasoning: `Job title "${jobTitle}" represents non-degree general labor unrelated to ${course}`,
      matched_skills: [],
      source: 'keyword'
    };
  }

  // Department-specific in-field keyword match
  const deptKeywords = IN_FIELD_KEYWORDS[dept] || [];
  const matchedKeywords = deptKeywords.filter(kw => {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(jobLower) || jobLower.includes(kw);
  });

  // Major-specific keyword match
  let majorMatched = false;
  for (const [majorKey, majorKws] of Object.entries(MAJOR_SPECIFIC_KEYWORDS)) {
    if (cLower.includes(majorKey)) {
      if (majorKws.some(mkw => jobLower.includes(mkw))) {
        majorMatched = true;
        break;
      }
    }
  }

    if (matchedKeywords.length > 0 || majorMatched) {
      const confidence = Math.min(0.85 + (matchedKeywords.length * 0.04) + (majorMatched ? 0.08 : 0), 0.98);
      return {
        alignment_status: 'In-Field',
        confidence_score: Math.round(confidence * 100) / 100,
        reasoning: `Job title "${jobTitle}" directly matches ${dept} career field competencies (${matchedKeywords.slice(0, 3).join(', ')})`,
        matched_skills: matchedKeywords.slice(0, 5),
        source: 'keyword'
      };
    }

  // Check department-specific out-of-field matches
  if (dept === 'CCS' && /\b(cashier|security guard|janitor|waiter|cook|sales associate|promoter)\b/i.test(jobLower)) {
    return {
      alignment_status: 'Out-of-Field',
      confidence_score: 0.90,
      reasoning: `Job title "${jobTitle}" does not utilize IT or software engineering degree skills`,
      matched_skills: [],
      source: 'keyword'
    };
  }

  if (dept === 'CTE' && /\b(call center agent|csr|bpo agent|cashier|security guard|waiter|driver)\b/i.test(jobLower)) {
    return {
      alignment_status: 'Out-of-Field',
      confidence_score: 0.88,
      reasoning: `Job title "${jobTitle}" is unrelated to Teacher Education & pedagogy`,
      matched_skills: [],
      source: 'keyword'
    };
  }

  if (dept === 'CCJE' && /\b(waiter|cook|bpo agent|software developer|accounting clerk)\b/i.test(jobLower)) {
    return {
      alignment_status: 'Out-of-Field',
      confidence_score: 0.85,
      reasoning: `Job title "${jobTitle}" does not align with Criminal Justice or Law Enforcement`,
      matched_skills: [],
      source: 'keyword'
    };
  }

  return null;
}

// ============================================================
// GEMINI CLASSIFICATION (AI-POWERED)
// ============================================================
async function geminiClassify(course: string, jobTitle: string): Promise<CareerAlignmentResult | null> {
  const prompt = `You are an expert career alignment classifier for Cebu Roosevelt Memorial Colleges (CRMC).

Graduate Degree/Course: "${course}"
Graduate Job Title: "${jobTitle}"

Determine if this job title is "In-Field" (professionally related to their degree) or "Out-of-Field" (unrelated or non-degree work).

Guidelines:
- BSIT/BSCS/Computer Studies: In-Field includes software development, web development, IT support, QA, systems admin, cybersecurity, data analytics, technical support.
- Education (BEED/BSED/MAED): In-Field includes DepEd teaching, private school teaching, tutoring, ESL instruction, academic administration, training officers.
- Criminology (CCJE): In-Field includes PNP police officers, security officers, investigators, jail/correctional officers, forensic specialists, legal researchers.
- Business/BSBA/Hospitality/Tourism (CBE): In-Field includes accounting, finance, banking, management, HR, marketing, sales management, hotel/resort operations, event planning.
- Psychology/Social Work (PSY): In-Field includes counselors, HR specialists, psychometricians, social workers, case managers, mental health workers.

Return ONLY valid JSON in this exact structure:
{
  "alignment_status": "In-Field" or "Out-of-Field",
  "confidence_score": number between 0.50 and 0.99,
  "reasoning": "one concise sentence explaining why"
}`;

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
        confidence_score: Math.min(Math.max(parsed.confidence_score || 0.85, 0.5), 0.99),
        reasoning: parsed.reasoning || `Gemini AI evaluated "${jobTitle}" for ${course}`,
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
// MAIN CAREER CLASSIFICATION FUNCTION
// ============================================================
export async function classifyCareerAlignment(
  course: string,
  jobTitle: string,
  _jobDescription?: string
): Promise<CareerAlignmentResult> {
  // 1. Sanitize & Validate Inputs
  if (!jobTitle || jobTitle.trim() === '') {
    return {
      alignment_status: 'Pending',
      confidence_score: 0,
      reasoning: 'No job title provided for classification',
      matched_skills: [],
      source: 'fallback'
    };
  }

  if (!course || course.trim() === '') {
    return {
      alignment_status: 'Pending',
      confidence_score: 0,
      reasoning: 'No degree or course information provided',
      matched_skills: [],
      source: 'fallback'
    };
  }

  const cleanCourse = course.trim();
  const cleanJob = jobTitle.trim();
  const cacheKey = `${cleanCourse}|${cleanJob}`.toLowerCase();

  // 2. Check Memory Cache
  if (classificationCache.has(cacheKey)) {
    return { ...classificationCache.get(cacheKey)!, source: 'cache' };
  }

  // 3. PRIORITY 1: Fast High-Confidence Keyword Matcher (Deterministic & Fast)
  const fastResult = fastKeywordClassify(cleanCourse, cleanJob);
  if (fastResult && fastResult.confidence_score >= 0.80) {
    classificationCache.set(cacheKey, fastResult);
    return fastResult;
  }

  // 4. PRIORITY 2: Gemini AI Classifier for Complex or Ambiguous Job Titles
  const geminiResult = await geminiClassify(cleanCourse, cleanJob);
  if (geminiResult && geminiResult.alignment_status !== 'Pending') {
    classificationCache.set(cacheKey, geminiResult);
    return geminiResult;
  }

  // 5. PRIORITY 3: Fallback Keyword Match if Gemini fails or is rate limited
  if (fastResult) {
    classificationCache.set(cacheKey, fastResult);
    return fastResult;
  }

  // 6. PRIORITY 4: Final Safe Fallback
  const dept = detectDepartment(cleanCourse);
  const fallbackResult: CareerAlignmentResult = {
    alignment_status: dept ? 'Out-of-Field' : 'Pending',
    confidence_score: 0.60,
    reasoning: dept 
      ? `Job title "${cleanJob}" does not show direct alignment with ${dept} degree competencies`
      : `Cannot automatically classify "${cleanJob}" for ${cleanCourse}`,
    matched_skills: [],
    source: 'fallback'
  };

  classificationCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

// ============================================================
// UI DISPLAY HELPERS
// ============================================================
export function getAlignmentDisplay(alignmentStatus: string | null): string {
  if (alignmentStatus === 'In-Field') return 'In-Field';
  if (alignmentStatus === 'Out-of-Field') return 'Out-of-Field';
  return 'Pending';
}

export function getAlignmentBadgeColor(alignmentStatus: string | null): string {
  if (alignmentStatus === 'In-Field') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (alignmentStatus === 'Out-of-Field') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
}

export function clearClassificationCache(): void {
  classificationCache.clear();
}
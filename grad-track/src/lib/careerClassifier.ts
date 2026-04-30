// src/lib/careerClassifier.ts
export interface CareerAlignmentResult {
  isAligned: boolean | null;  // TRUE = In-Field, FALSE = Out-of-Field, NULL = Pending
  confidence_score: number;
  reasoning: string;
  matched_skills: string[];
  source: 'keyword' | 'llm' | 'cache' | 'fallback';
}

// Cache for already-classified job titles
const classificationCache = new Map<string, CareerAlignmentResult>();

// ============================================================
// KEYWORD DATABASE for CRMC Programs
// ============================================================

const careerKeywords: Record<string, {
  inField: string[];
  outOfField: string[];
  programs: string[];
}> = {
  'CCS': {
    programs: ['BS Information Technology'],
    inField: [
      'software', 'developer', 'programmer', 'engineer', 'it', 'tech', 
      'web', 'database', 'system', 'network', 'cyber', 'cloud', 
      'devops', 'full stack', 'frontend', 'backend', 'data', 
      'analytics', 'machine learning', 'ai', 'support', 
      'administrator', 'security', 'coding', 'programming'
    ],
    outOfField: ['cashier', 'driver', 'warehouse', 'construction', 'factory', 'sales', 'security']
  },
  'CTE': {
    programs: ['Bachelor of Elementary Education', 'Bachelor of Secondary Education'],
    inField: [
      'teacher', 'instructor', 'professor', 'educator', 'trainer',
      'principal', 'school', 'teaching', 'faculty', 'librarian',
      'guidance counselor', 'academic', 'coach', 'tutor', 'mentor'
    ],
    outOfField: ['cashier', 'driver', 'warehouse', 'construction', 'factory', 'call center', 'bpo']
  },
  'CCJE': {
    programs: ['BS Criminology'],
    inField: [
      'police', 'law enforcement', 'security', 'investigator',
      'forensic', 'correctional', 'probation', 'parole',
      'safety officer', 'detective', 'bureau', 'jail'
    ],
    outOfField: []
  },
  'CBE': {
    programs: ['BS Accountancy', 'BS Business Administration', 'BS Hospitality Management', 'BS Tourism Management'],
    inField: [
      'accountant', 'finance', 'marketing', 'sales', 'manager',
      'business', 'admin', 'hr', 'human resources', 'analyst',
      'consultant', 'bank', 'banking', 'audit', 'tax', 'bookkeeper',
      'hotel', 'restaurant', 'tourism', 'travel', 'events', 'front desk'
    ],
    outOfField: []
  },
  'PSY': {
    programs: ['BS Psychology'],
    inField: [
      'psychologist', 'counselor', 'therapist', 'mental health',
      'clinical', 'guidance', 'social worker', 'hr', 'recruiter',
      'industrial psychology', 'organizational development'
    ],
    outOfField: ['cashier', 'driver', 'warehouse', 'construction', 'factory']
  }
};

// Detect department from course name
function detectDepartment(course: string): string | null {
  const courseLower = course.toLowerCase();
  
  if (courseLower.includes('information technology') || courseLower.includes('computer')) return 'CCS';
  if (courseLower.includes('education') || courseLower.includes('elementary') || courseLower.includes('secondary')) return 'CTE';
  if (courseLower.includes('criminology') || courseLower.includes('criminal')) return 'CCJE';
  if (courseLower.includes('business') || courseLower.includes('accountancy') || courseLower.includes('management') || courseLower.includes('hospitality') || courseLower.includes('tourism')) return 'CBE';
  if (courseLower.includes('psychology')) return 'PSY';
  
  return null;
}

// Keyword-based classification (returns boolean)
function keywordClassify(course: string, jobTitle: string): CareerAlignmentResult | null {
  const department = detectDepartment(course);
  if (!department) return null;
  
  const keywords = careerKeywords[department];
  if (!keywords) return null;
  
  const jobLower = jobTitle.toLowerCase();
  
  // Check In-Field keywords
  const matchedInField = keywords.inField.filter(kw => jobLower.includes(kw));
  if (matchedInField.length > 0) {
    const confidence = Math.min(0.7 + (matchedInField.length * 0.05), 0.95);
    return {
      isAligned: true,
      confidence_score: confidence,
      reasoning: `"${jobTitle}" aligns with ${keywords.programs[0]} (keywords: ${matchedInField.slice(0, 3).join(', ')})`,
      matched_skills: matchedInField,
      source: 'keyword'
    };
  }
  
  // Check Out-of-Field keywords
  const matchedOutField = keywords.outOfField.filter(kw => jobLower.includes(kw));
  if (matchedOutField.length > 0) {
    return {
      isAligned: false,
      confidence_score: 0.85,
      reasoning: `"${jobTitle}" does not align with ${keywords.programs[0]} degree`,
      matched_skills: [],
      source: 'keyword'
    };
  }
  
  return null;
}

// Fallback classification
function fallbackClassify(course: string, jobTitle: string): CareerAlignmentResult {
  const department = detectDepartment(course);
  
  if (!department) {
    return {
      isAligned: null,
      confidence_score: 0.2,
      reasoning: `Cannot determine alignment for "${jobTitle}" with ${course}`,
      matched_skills: [],
      source: 'fallback'
    };
  }
  
  return {
    isAligned: null,
    confidence_score: 0.4,
    reasoning: `"${jobTitle}" needs manual review for ${course}`,
    matched_skills: [],
    source: 'fallback'
  };
}

// MAIN CLASSIFICATION FUNCTION - CALL THIS FROM YOUR DASHBOARD
export async function classifyCareerAlignment(
  course: string,
  jobTitle: string,
  jobDescription?: string
): Promise<CareerAlignmentResult> {
  // Validate inputs
  if (!jobTitle || jobTitle.trim() === '') {
    return {
      isAligned: null,
      confidence_score: 0,
      reasoning: 'No job title provided',
      matched_skills: [],
      source: 'fallback'
    };
  }

  if (!course || course.trim() === '') {
    return {
      isAligned: null,
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
  
  // Try keyword matching
  const keywordResult = keywordClassify(course, jobTitle);
  if (keywordResult && keywordResult.confidence_score >= 0.7) {
    classificationCache.set(cacheKey, keywordResult);
    return keywordResult;
  }
  
  // Fallback
  const fallbackResult = fallbackClassify(course, jobTitle);
  classificationCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

// Helper functions
export function getAlignmentDisplay(isAligned: boolean | null): string {
  if (isAligned === true) return 'In-Field';
  if (isAligned === false) return 'Out-of-Field';
  return 'Pending';
}

export function getAlignmentBadgeColor(isAligned: boolean | null): string {
  if (isAligned === true) return 'bg-green-100 text-green-700';
  if (isAligned === false) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-500';
}

export function clearClassificationCache(): void {
  classificationCache.clear();
}
// src/lib/gemini.ts
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface DepartmentStat {
  department: string;
  total_alumni: number;
  employed_count: number;
  unemployed_count: number;
  in_field_count: number;
  out_of_field_count: number;
  employment_rate: number;
  alignment_rate: number;
  
}

// Track rate limiting
let isRateLimited = false;
let rateLimitResetTime = 0;

const INDUSTRY_READINESS_TARGET = 80;

async function callGemini(prompt: string, temperature?: number): Promise<{ success: boolean; text: string }> {
  if (isRateLimited && Date.now() < rateLimitResetTime) {
    console.log('Still rate limited, using fallback');
    return { success: false, text: '' };
  }
  
  if (isRateLimited && Date.now() >= rateLimitResetTime) {
    isRateLimited = false;
    console.log('Rate limit cooldown ended');
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: temperature !== undefined ? { temperature, topP: 0.85 } : undefined
      })
    });
    
    if (response.status === 429) {
      isRateLimited = true;
      rateLimitResetTime = Date.now() + 60000;
      console.log('Rate limit hit, using fallback');
      return { success: false, text: '' };
    }
    
    if (!response.ok) {
      console.error('API Error:', response.status);
      return { success: false, text: '' };
    }
    
    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText || generatedText.length < 10) {
      return { success: false, text: '' };
    }
    
    return { success: true, text: generatedText };
  } catch (error) {
    console.error('Gemini API error:', error);
    return { success: false, text: '' };
  }
}

// ============================================================
// PROGRAM PROMOTION RECOMMENDATIONS
// ============================================================
export async function getProgramPromotionRecommendations(stats: DepartmentStat[]): Promise<{ success: boolean; text: string }> {
  if (!stats.length) {
    return { 
      success: false, 
      text: 'No alumni data available to generate recommendations.' 
    };
  }

  const departmentsWithAlumni = stats.filter(s => s.total_alumni > 0);
  
  if (departmentsWithAlumni.length === 1) {
    const dept = departmentsWithAlumni[0];
    const deptName = getDepartmentName(dept.department);
    return {
      success: false,
      text: `📊 Based on current data, ${deptName} (${dept.department}) has ${dept.total_alumni} registered alumni with ${dept.employment_rate.toFixed(0)}% employment rate. As more alumni join, we'll provide comparative program recommendations.`
    };
  }

  const prompt = `
You are an alumni career analyst for GradTrack at Cebu Roosevelt Memorial Colleges (CRMC).

Based on the following alumni program performance data, identify which programs should be promoted:

Data:
${JSON.stringify(stats, null, 2)}

Identify the TOP 2 programs with the best employment and alignment rates.
For each program, provide:
- Program name (full name, not just code)
- Why they are successful (one short sentence)
- Target audience to promote to

Keep response concise, professional, and under 150 words.
`;
  
  const result = await callGemini(prompt);
  
  if (!result.success) {
    const validDepts = stats.filter(s => s.total_alumni > 0);
    if (validDepts.length === 0) {
      return {
        success: false,
        text: `No alumni data available yet. Once alumni register and update their career information, insights will appear here.`
      };
    }
    
    const sorted = [...validDepts].sort((a, b) => b.alignment_rate - a.alignment_rate);
    const topDept = sorted[0];
    const topDeptName = getDepartmentName(topDept.department);
    
    return {
      success: false,
      text: `📈 Based on current data, ${topDeptName} (${topDept.department}) is the top performer with ${topDept.alignment_rate.toFixed(0)}% career alignment and ${topDept.employment_rate.toFixed(0)}% employment rate. Continue monitoring as more alumni join for comprehensive insights.`
    };
  }
  
  return result;
}

// ============================================================
// PROGRAM STRENGTH ANALYSIS
// ============================================================
export async function getProgramStrengthAnalysis(stats: DepartmentStat[]): Promise<{ success: boolean; text: string }> {
  if (!stats.length) {
    return { 
      success: false, 
      text: 'No alumni data available for analysis.' 
    };
  }

  const validDepts = stats.filter(s => s.total_alumni > 0);
  
  if (validDepts.length === 0) {
    return {
      success: false,
      text: `Waiting for alumni data. Insights will appear as graduates register and update their profiles.`
    };
  }

  const prompt = `
Analyze this program performance data from CRMC:

${JSON.stringify(stats, null, 2)}

Provide:
1. Overall assessment (one sentence)
2. Best performing department and why
3. Department that needs attention

Keep response professional and under 150 words.
`;
  
  const result = await callGemini(prompt);
  
  if (!result.success) {
    const validDepts = stats.filter(s => s.total_alumni > 0);
    const bestDept = validDepts.reduce((prev, current) => 
      (prev.alignment_rate > current.alignment_rate) ? prev : current
    );
    const bestDeptName = getDepartmentName(bestDept.department);
    const avgAlignment = validDepts.reduce((sum, d) => sum + d.alignment_rate, 0) / validDepts.length;
    
    const worstDept = validDepts.reduce((prev, current) => 
      (prev.alignment_rate < current.alignment_rate) ? prev : current
    );
    const worstDeptName = getDepartmentName(worstDept.department);
    
    if (validDepts.length === 1) {
      return {
        success: false,
        text: `Currently tracking ${bestDept.total_alumni} alumni in ${bestDeptName} with ${bestDept.employment_rate.toFixed(0)}% employment and ${bestDept.alignment_rate.toFixed(0)}% alignment. More departments will appear as alumni register.`
      };
    }
    
    return {
      success: false,
      text: `Based on ${validDepts.length} departments with data, average career alignment is ${avgAlignment.toFixed(0)}%. ${bestDeptName} leads with ${bestDept.alignment_rate.toFixed(0)}% alignment. ${worstDeptName} has ${worstDept.alignment_rate.toFixed(0)}% alignment - consider reviewing career support.`
    };
  }
  
  return result;
}

// ============================================================
// INSTITUTIONAL SUMMARY
// ============================================================
export async function getInstitutionalSummary(stats: DepartmentStat[]): Promise<{ success: boolean; text: string }> {
  if (!stats.length) {
    return { 
      success: false, 
      text: 'Tracking alumni performance across all departments.' 
    };
  }

  const validDepts = stats.filter(s => s.total_alumni > 0);
  const totalAlumni = validDepts.reduce((sum, d) => sum + d.total_alumni, 0);
  const avgEmployment = validDepts.reduce((sum, d) => sum + d.employment_rate, 0) / validDepts.length;
  const avgAlignment = validDepts.reduce((sum, d) => sum + d.alignment_rate, 0) / validDepts.length;
  
  const prompt = `
Write ONE professional sentence summarizing GradTrack's alumni performance:
- Total alumni tracked: ${totalAlumni}
- Average employment rate: ${avgEmployment.toFixed(0)}%
- Average career alignment: ${avgAlignment.toFixed(0)}%

Keep under 20 words, encouraging tone.
`;
  
  const result = await callGemini(prompt);
  
  if (!result.success) {
    if (totalAlumni === 0) {
      return {
        success: false,
        text: `🎓 GradTrack is ready to track alumni careers. Insights will appear as graduates join and update their profiles.`
      };
    }
    if (validDepts.length === 1) {
      const dept = validDepts[0];
      const deptName = getDepartmentName(dept.department);
      return {
        success: false,
        text: `🎓 Tracking ${totalAlumni} alumni in ${deptName} with ${avgEmployment.toFixed(0)}% employment and ${avgAlignment.toFixed(0)}% career alignment.`
      };
    }
    return {
      success: false,
      text: `🎓 Tracking ${totalAlumni} alumni across ${validDepts.length} departments with ${avgEmployment.toFixed(0)}% employment and ${avgAlignment.toFixed(0)}% career alignment.`
    };
  }
  
  return result;
}

// ============================================================
// PREDICTION DASHBOARD - UPGRADED GEMINI PROMPT & FALLBACK
export function isRealIndustry(industryName: string | null | undefined): boolean {
  if (!industryName) return false;
  const normalized = industryName.trim().toLowerCase();
  return (
    normalized !== '' &&
    normalized !== 'unspecified' &&
    normalized !== 'pending' &&
    normalized !== 'unemployed' &&
    normalized !== 'n/a' &&
    normalized !== 'none' &&
    normalized !== 'unknown' &&
    normalized !== 'not specified'
  );
}

// ============================================================
// PREDICTION DASHBOARD - UPGRADED GEMINI PROMPT & FALLBACK
// ============================================================

export interface PredictionInsightRequest {
  department: string;
  departmentName: string;
  totalAlumni: number;
  employedCount?: number;
  inFieldCount?: number;
  outOfFieldCount?: number;
  employmentRate: number;
  alignmentRate: number;
  healthScore: number;
  demandScore: number;
  projection: number | null;
  growth: number | null;
  gap: number;
  targetBatch: number | null;
  latestBatch: number | null;
  topIndustry: string | null;
  topIndustryDemand: number | null;
  industriesCount: number;
  topIndustriesList?: { name: string; count: number; share: number }[];
  batchCount: number;
  batchHistory?: { year: number; rate: number }[];
  isSmallSample: boolean;
  hasTrendData: boolean;
  trendDescription: string;
}

export interface PredictionInsightResponse {
  projection: string;
  workforce: string;
  industry: string;
  health: string;
  productivity: string;
  summary: string;
  actionableStep: string;
  riskFactor: string;
  growthOpportunity: string;
  isLiveAI?: boolean;
}

/**
 * Generates AI-powered interpretations for the PredictionDashboard
 * Falls back to dynamic data-driven interpretations when AI is unavailable
 */
export async function getPredictionInsights(request: PredictionInsightRequest): Promise<{ success: boolean; insights: PredictionInsightResponse }> {
  const {
    department,
    departmentName,
    totalAlumni,
    employedCount = Math.round((request.employmentRate / 100) * totalAlumni),
    inFieldCount = Math.round((request.alignmentRate / 100) * totalAlumni),
    outOfFieldCount = Math.max(0, employedCount - Math.round((request.alignmentRate / 100) * totalAlumni)),
    employmentRate,
    alignmentRate,
    healthScore,
    demandScore,
    projection,
    growth,
    gap,
    targetBatch,
    latestBatch: _latestBatchData,
    topIndustry,
    topIndustryDemand,
    industriesCount,
    topIndustriesList,
    batchCount,
    batchHistory,
    isSmallSample,
    trendDescription: _trendDescription,
  } = request;

  // If no data, return empty insights
  if (totalAlumni === 0) {
    const fallback = generateImprovedFallback(request);
    fallback.isLiveAI = false;
    return {
      success: false,
      insights: fallback
    };
  }

  // If small sample, use improved data-driven fallback
  if (isSmallSample || batchCount < 2) {
    const fallback = generateImprovedFallback(request);
    fallback.isLiveAI = false;
    return { success: false, insights: fallback };
  }

  const topIndustriesSummary = topIndustriesList && topIndustriesList.length > 0
    ? topIndustriesList.map(i => `${i.name} (${i.count} alumni, ${i.share}%)`).join(', ')
    : (isRealIndustry(topIndustry) ? `${topIndustry} (${topIndustryDemand}% demand)` : 'Pending / Not Specified');

  const historySummary = batchHistory && batchHistory.length > 0
    ? batchHistory.map(b => `Batch ${b.year}: ${b.rate}% alignment`).join(' → ')
    : 'Limited batch history';

  // ============================================================
  // UPGRADED GEMINI PROMPT (SHARPER PREDICTIVE ANALYTICS)
  // ============================================================
  const prompt = `
You are a Lead Predictive Analytics & Workforce Forecasting Specialist for Cebu Roosevelt Memorial Colleges (CRMC) GradTrack. Your role is to deliver sharp, data-backed insights and strategic interventions for academic deans and program heads.

DEPARTMENT CONTEXT:
- Department: ${departmentName} (${department})
- Total Alumni Tracked: ${totalAlumni} (Employed: ${employedCount}, In Field: ${inFieldCount}, Out of Field: ${outOfFieldCount})
- Latest Batch Analyzed: ${_latestBatchData !== null ? 'Batch ' + _latestBatchData : 'N/A'}
- Target Forecast Batch: ${targetBatch !== null ? 'Batch ' + targetBatch : 'Next batch'}
- Batches Analyzed: ${batchCount} (${historySummary})

PERFORMANCE & DEMAND METRICS:
- Employment Rate: ${employmentRate}%
- Career Alignment Rate: ${alignmentRate}% (${inFieldCount} in field, ${outOfFieldCount} out of field)
- Composite Program Health Score: ${healthScore}%
- Industry Demand Score: ${demandScore}%
- Projected Alignment for Target Batch: ${projection !== null ? projection + '%' : 'N/A'}
- Projected Alignment Growth: ${growth !== null ? (growth > 0 ? '+' : '') + growth + '%' : 'N/A'}
- Graduate Gap: ${gap > 0 ? gap + ' additional graduates needed' : gap < 0 ? 'Supply exceeds demand by ' + Math.abs(gap) : 'Balanced'}

INDUSTRY RECRUITMENT SECTORS:
- Top Valid Sectors: ${topIndustriesSummary}
- Total Industry Sectors Represented: ${industriesCount}
- Overall Market Trend: ${_trendDescription || 'stable'}

CRITICAL RULES:
- 'Unspecified', 'Pending', or 'Unemployed' represent unclassified alumni or job seekers, NOT an employer or industry sector.
- NEVER cite 'Unspecified' as a top industry or employer.
- Provide sharp, data-driven conclusions referencing exact numbers.

INSTRUCTION FORMAT:
Generate 9 structured analytical insights in the exact format below. Each item must be a single direct sentence:

FORMAT:
PROJECTION: [Sentence analyzing alignment trajectory and projection for Batch ${targetBatch || 'next'}]
WORKFORCE: [Sentence evaluating workforce supply gap vs employer demand]
INDUSTRY: [Sentence analyzing recruitment in leading valid sectors: ${topIndustriesSummary}]
HEALTH: [Sentence assessing composite program health score]
PRODUCTIVITY: [Sentence evaluating career readiness and field placement]
SUMMARY: [One executive summary sentence]
ACTIONABLE_STEP: [One concrete curriculum or career placement action step for CRMC deans]
RISK_FACTOR: [One key operational or field-misalignment risk factor]
GROWTH_OPPORTUNITY: [One strategic growth sector or skill focus area]

Generate now for ${departmentName} (${department}):
`;

  const result = await callGemini(prompt, 0.2);

  // If Gemini fails, use IMPROVED data-driven fallback
  if (!result.success) {
    const fallback = generateImprovedFallback(request);
    fallback.isLiveAI = false;
    return { success: false, insights: fallback };
  }

  // Parse the response
  const text = result.text;
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  const insights: PredictionInsightResponse = generateImprovedFallback(request);
  insights.isLiveAI = true;

  try {
    const projectionLine = lines.find(l => l.toLowerCase().includes('projection'));
    const workforceLine = lines.find(l => l.toLowerCase().includes('workforce'));
    const industryLine = lines.find(l => l.toLowerCase().includes('industry'));
    const healthLine = lines.find(l => l.toLowerCase().includes('health'));
    const productivityLine = lines.find(l => l.toLowerCase().includes('productivity'));
    const summaryLine = lines.find(l => l.toLowerCase().includes('summary'));
    const actionLine = lines.find(l => l.toLowerCase().includes('actionable') || l.toLowerCase().includes('action step'));
    const riskLine = lines.find(l => l.toLowerCase().includes('risk'));
    const growthLine = lines.find(l => l.toLowerCase().includes('growth') || l.toLowerCase().includes('opportunity'));

    if (projectionLine) insights.projection = projectionLine.replace(/^[^:]*:\s*/i, '').trim();
    if (workforceLine) insights.workforce = workforceLine.replace(/^[^:]*:\s*/i, '').trim();
    if (industryLine) insights.industry = industryLine.replace(/^[^:]*:\s*/i, '').trim();
    if (healthLine) insights.health = healthLine.replace(/^[^:]*:\s*/i, '').trim();
    if (productivityLine) insights.productivity = productivityLine.replace(/^[^:]*:\s*/i, '').trim();
    if (summaryLine) insights.summary = summaryLine.replace(/^[^:]*:\s*/i, '').trim();
    if (actionLine) insights.actionableStep = actionLine.replace(/^[^:]*:\s*/i, '').trim();
    if (riskLine) insights.riskFactor = riskLine.replace(/^[^:]*:\s*/i, '').trim();
    if (growthLine) insights.growthOpportunity = growthLine.replace(/^[^:]*:\s*/i, '').trim();
  } catch (e) {
    console.warn('Error parsing Gemini response:', e);
  }

  return { success: true, insights };
}

// ============================================================
// IMPROVED FALLBACK INTERPRETATIONS - NATURAL & PROFESSIONAL
// ============================================================

export function generateImprovedFallback(request: PredictionInsightRequest): PredictionInsightResponse {
  return {
    projection: generateImprovedProjection(request),
    workforce: generateImprovedWorkforce(request),
    industry: generateImprovedIndustry(request),
    health: generateImprovedHealth(request),
    productivity: generateImprovedProductivity(request),
    summary: generateImprovedSummary(request),
    actionableStep: generateImprovedActionableStep(request),
    riskFactor: generateImprovedRiskFactor(request),
    growthOpportunity: generateImprovedGrowthOpportunity(request)
  };
}

function generateImprovedActionableStep(request: PredictionInsightRequest): string {
  const { departmentName, alignmentRate, targetBatch } = request;
  const batchLabel = targetBatch !== null ? `Batch ${targetBatch}` : 'upcoming batch';
  if (alignmentRate < 70) {
    return `Integrate industry-recognized certifications and hands-on capstone projects into ${departmentName} curriculum for ${batchLabel}.`;
  }
  return `Expand placement partnerships and internship pipelines with regional employers in leading growth sectors.`;
}

function generateImprovedRiskFactor(request: PredictionInsightRequest): string {
  const { departmentName, outOfFieldCount, totalAlumni, gap } = request;
  if (outOfFieldCount && outOfFieldCount > 0) {
    return `${outOfFieldCount} of ${totalAlumni} ${departmentName} graduates work out-of-field, posing a risk of skills mismatch.`;
  }
  if (gap < 0) {
    return `Graduate supply exceeds current regional demand by ${Math.abs(gap)}, increasing potential underemployment.`;
  }
  return `Limited historical batch data may constrain long-term alignment trajectory precision.`;
}

function generateImprovedGrowthOpportunity(request: PredictionInsightRequest): string {
  const { topIndustry, topIndustryDemand, departmentName } = request;
  if (topIndustry && isRealIndustry(topIndustry) && topIndustryDemand !== null) {
    return `High recruitment demand in ${topIndustry} (${topIndustryDemand}%) presents a key opportunity to offer specialized elective tracks.`;
  }
  return `Expanding cross-industry technical skills will broaden career placement options for ${departmentName} graduates.`;
}

function generateImprovedProjection(request: PredictionInsightRequest): string {
  const { departmentName, projection, growth, alignmentRate, targetBatch, batchCount, totalAlumni } = request;

  if (batchCount === 0) {
    return `${departmentName} has ${totalAlumni} alumni but no batch data recorded. Add batch_year to alumni records to enable projections.`;
  }

  if (batchCount === 1) {
    return `${departmentName} has ${totalAlumni} alumni with ${alignmentRate}% career alignment. With only one batch recorded, trend analysis requires additional data.`;
  }

  if (projection === null || growth === null) {
    return `${departmentName} currently shows ${alignmentRate}% career alignment based on ${batchCount} batches. More historical data would improve projection accuracy.`;
  }

  const direction = growth > 0 ? 'improving' : growth < 0 ? 'declining' : 'stable';
  const absGrowth = Math.abs(growth);
  const batchLabel = targetBatch !== null ? `Batch ${targetBatch}` : 'Next batch';

  let insight = `Based on ${batchCount} batches of data, ${departmentName} alignment is ${direction} `;
  insight += `from ${alignmentRate}% to ${projection}% for ${batchLabel} (${growth > 0 ? '+' : ''}${absGrowth}%).`;

  if (growth > 5) {
    insight += ' This positive trend suggests effective program strategies and strong graduate outcomes.';
  } else if (growth > 0) {
    insight += ' Gradual improvement indicates steady progress in graduate preparation.';
  } else if (growth < -10) {
    insight += ' This significant decline warrants immediate review of program curriculum and support services.';
  } else if (growth < 0) {
    insight += ' This decline suggests a need for curriculum review and enhanced career preparation.';
  } else {
    insight += ' Stable performance indicates consistent graduate outcomes over time.';
  }

  return insight;
}

function generateImprovedWorkforce(request: PredictionInsightRequest): string {
  const { departmentName, gap, targetBatch, topIndustry, topIndustryDemand, industriesCount, totalAlumni } = request;

  const hasRealTop = isRealIndustry(topIndustry);

  if (industriesCount === 0 && !hasRealTop) {
    return `${departmentName} has ${totalAlumni} alumni, but industry classification is currently pending or unspecified. Encouraging graduates to update profiles will refine workforce analysis.`;
  }

  const batchLabel = targetBatch !== null ? `Batch ${targetBatch}` : 'Next batch';

  let insight = industriesCount > 0
    ? `${departmentName} graduates work across ${industriesCount} specified industry sector${industriesCount > 1 ? 's' : ''}.`
    : `${departmentName} alumni employment data is being tracked with sector classification pending for some graduates.`;

  if (hasRealTop && topIndustryDemand !== null) {
    insight += ` The primary employer sector is ${topIndustry}, representing ${topIndustryDemand}% demand.`;
  }

  if (gap > 0) {
    insight += ` For ${batchLabel}, we anticipate needing ${gap} more graduates to meet employer demand.`;
    if (hasRealTop && topIndustryDemand !== null && topIndustryDemand > 70) {
      insight += ` Strong demand in ${topIndustry} suggests active sector recruitment.`;
    }
  } else if (gap < 0) {
    insight += ` For ${batchLabel}, graduate supply exceeds demand by ${Math.abs(gap)}.`;
    if (hasRealTop && topIndustryDemand !== null && topIndustryDemand < 50) {
      insight += ` Lower demand in key sectors may contribute to this surplus.`;
    }
  } else {
    insight += ` For ${batchLabel}, graduate supply and demand are currently balanced.`;
  }

  return insight;
}

function generateImprovedIndustry(request: PredictionInsightRequest): string {
  const { departmentName, demandScore, topIndustry, topIndustryDemand, industriesCount } = request;

  const hasRealTop = isRealIndustry(topIndustry);

  if (industriesCount === 0 && !hasRealTop) {
    return `${departmentName} graduates have not yet reported specified industry sector information. Alumni profile updates will provide clearer sector demand insights.`;
  }

  let demandDesc = 'moderate';
  if (demandScore >= 70) demandDesc = 'strong';
  else if (demandScore < 40) demandDesc = 'limited';

  let insight = `${departmentName} graduates demonstrate ${demandDesc} market demand with an overall score of ${demandScore}%.`;

  if (hasRealTop && topIndustryDemand !== null) {
    insight += ` ${topIndustry} is the leading sector with ${topIndustryDemand}% demand.`;
  }

  if (industriesCount >= 3) {
    insight += ` With ${industriesCount} industry sectors represented, graduates have diverse career paths.`;
  } else if (industriesCount === 1 && hasRealTop) {
    insight += ` Graduates are concentrated primarily in ${topIndustry}.`;
  }

  if (demandScore >= 70) {
    insight += ' High market demand validates curriculum alignment and graduate workforce readiness.';
  } else if (demandScore < 50) {
    insight += ' Expanding industry partnerships may improve sector demand outcomes.';
  }

  return insight;
}

function generateImprovedHealth(request: PredictionInsightRequest): string {
  const { departmentName, healthScore, employmentRate, alignmentRate, totalAlumni } = request;

  const status = healthScore >= 80 ? 'excellent' : healthScore >= 70 ? 'very good' : healthScore >= 60 ? 'good' : healthScore >= 50 ? 'fair' : 'needs improvement';

  let insight = `${departmentName} has a health score of ${healthScore}%, which is ${status}.`;

  if (employmentRate >= 70 && alignmentRate >= 70) {
    insight += ` Both employment (${employmentRate}%) and alignment (${alignmentRate}%) are strong.`;
  } else if (employmentRate >= 70) {
    insight += ` Employment (${employmentRate}%) is strong, but alignment (${alignmentRate}%) lags behind.`;
  } else if (alignmentRate >= 70) {
    insight += ` Alignment (${alignmentRate}%) is strong, but employment (${employmentRate}%) needs attention.`;
  } else {
    insight += ` Both employment (${employmentRate}%) and alignment (${alignmentRate}%) need improvement.`;
  }

  if (healthScore >= 70) {
    insight += ' The department is performing well and should maintain its current trajectory.';
  } else if (healthScore >= 50) {
    insight += ' Targeted improvements in placement and curriculum alignment could boost outcomes.';
  } else {
    insight += ' Urgent intervention is recommended to address underlying issues.';
  }

  if (totalAlumni < 10) {
    insight += ' Note: This assessment is based on a small sample size.';
  }

  return insight;
}

function generateImprovedProductivity(request: PredictionInsightRequest): string {
  const { departmentName, alignmentRate, totalAlumni, targetBatch } = request;

  const readyCount = Math.round((alignmentRate / 100) * totalAlumni);
  const batchLabel = targetBatch !== null ? `Batch ${targetBatch}` : 'Next batch';

  let insight = `${readyCount} of ${totalAlumni} ${departmentName} graduates are currently working in their field.`;

  if (alignmentRate >= 80) {
    insight += ' This excellent alignment indicates the department is producing highly industry-ready graduates.';
  } else if (alignmentRate >= 70) {
    insight += ' Strong performance suggests graduates are well-prepared for the workforce.';
  } else if (alignmentRate >= 60) {
    insight += ' Moderate alignment shows room for improvement in industry readiness.';
  } else {
    insight += ' The department should review curriculum and career preparation strategies.';
  }

  if (alignmentRate < INDUSTRY_READINESS_TARGET) {
    const neededInField = Math.ceil((INDUSTRY_READINESS_TARGET / 100) * totalAlumni);
    const shortfall = Math.max(0, neededInField - readyCount);
    insight += ` To reach the ${INDUSTRY_READINESS_TARGET}% target for ${batchLabel}, ${shortfall} more graduates need to secure field-aligned positions.`;
  }

  return insight;
}

function generateImprovedSummary(request: PredictionInsightRequest): string {
  const { departmentName, totalAlumni, employmentRate, alignmentRate, healthScore, gap, targetBatch } = request;

  const batchLabel = targetBatch !== null ? `Batch ${targetBatch}` : 'Next batch';

  let gapText = 'balanced';
  if (gap > 0) gapText = `short by ${gap} graduates`;
  else if (gap < 0) gapText = `exceeds demand by ${Math.abs(gap)} graduates`;

  let insight = `${departmentName}: ${totalAlumni} alumni, ${employmentRate}% employed, `;
  insight += `${alignmentRate}% aligned, ${healthScore}% health. Based on latest data, `;
  insight += `workforce supply ${gapText} for ${batchLabel}.`;

  if (healthScore >= 70 && employmentRate >= 70 && alignmentRate >= 70) {
    insight += ' Overall, the department is in good standing.';
  } else if (healthScore >= 50) {
    insight += ' Some areas require attention to optimize outcomes.';
  } else {
    insight += ' Immediate action is recommended to address performance gaps.';
  }

  return insight;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getDepartmentName(code: string): string {
  const names: Record<string, string> = {
    'CCS': 'Computer Studies',
    'CTE': 'Teacher Education',
    'CCJE': 'Criminal Justice Education',
    'CBE': 'Business Education',
    'PSY': 'Psychology'
  };
  return names[code] || code;
}

// function classifyHealth(score: number): string {
//   if (score >= 80) return 'Excellent';
//   if (score >= 70) return 'Very Good';
//   if (score >= 60) return 'Good';
//   if (score >= 50) return 'Fair';
//   return 'Needs Improvement';
// }

// ============================================================
// EXPORT FOR CAREER CLASSIFIER
// ============================================================
export async function callGeminiForClassification(prompt: string): Promise<string | null> {
  if (isRateLimited && Date.now() < rateLimitResetTime) {
    console.log('Still rate limited');
    return null;
  }
  
  if (isRateLimited && Date.now() >= rateLimitResetTime) {
    isRateLimited = false;
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    if (response.status === 429) {
      isRateLimited = true;
      rateLimitResetTime = Date.now() + 60000;
      console.log('Rate limit hit');
      return null;
    }
    
    if (!response.ok) {
      console.error('API Error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText || generatedText.length < 10) {
      return null;
    }
    
    return generatedText;
  } catch (error) {
    console.error('Gemini API error:', error);
    return null;
  }
}
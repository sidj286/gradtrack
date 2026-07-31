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

async function callGemini(prompt: string): Promise<{ success: boolean; text: string }> {
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
        contents: [{ parts: [{ text: prompt }] }]
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
// ============================================================

export interface PredictionInsightRequest {
  department: string;
  departmentName: string;
  totalAlumni: number;
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
  batchCount: number;
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
    batchCount,
    isSmallSample,
    hasTrendData: _hasTrendData,
    trendDescription: _trendDescription,
  } = request;

  // If no data, return empty insights
  if (totalAlumni === 0) {
    return {
      success: false,
      insights: {
        projection: `No alumni data available for ${departmentName}. Begin tracking graduates to enable workforce projections.`,
        workforce: `Workforce analysis unavailable. ${departmentName} needs alumni employment data.`,
        industry: `Industry demand analysis unavailable. Encourage alumni to update industry information.`,
        health: `${departmentName} health assessment pending. ${totalAlumni} alumni records needed for meaningful analysis.`,
        productivity: `Productivity assessment pending. ${departmentName} requires at least 5 alumni records for reliable insights.`,
        summary: `${departmentName}: 0 alumni tracked. Begin data collection for workforce insights.`
      }
    };
  }

  // If small sample, use improved data-driven fallback
  if (isSmallSample || batchCount < 2) {
    const insights = generateImprovedFallback(request);
    return { success: false, insights };
  }

  // ============================================================
  // UPGRADED GEMINI PROMPT
  // ============================================================
  const prompt = `
You are a senior data analyst for GradTrack, an alumni career tracking system at Cebu Roosevelt Memorial Colleges (CRMC). Your role is to generate professional, data-driven insights for academic program evaluation and workforce planning.

DEPARTMENT CONTEXT:
- Department: ${departmentName} (${department})
- Total Alumni Tracked: ${totalAlumni}
- Latest Batch with Data: ${_latestBatchData !== null ? 'Batch ' + _latestBatchData : 'N/A'}
- Target Batch: ${targetBatch !== null ? 'Batch ' + targetBatch : 'Next batch'}
- Batches Analyzed: ${batchCount} (${batchCount >= 3 ? 'sufficient for trend analysis' : 'limited, trends may not be statistically significant'})

PERFORMANCE METRICS:
- Employment Rate: ${employmentRate}% of graduates are employed
- Career Alignment Rate: ${alignmentRate}% of graduates work in their field
- Health Score: ${healthScore}% (composite of employment and alignment)
- Demand Score: ${demandScore}% (industry demand indicator)
- Projected Alignment: ${projection !== null ? projection + '%' : 'Insufficient data for projection'}
- Growth Trend: ${growth !== null ? (growth > 0 ? '+' : '') + growth + '%' : 'Insufficient data'}
- Graduate Gap: ${gap > 0 ? gap + ' additional graduates needed' : gap < 0 ? 'Supply exceeds demand by ' + Math.abs(gap) : 'Balanced'}

INDUSTRY CONTEXT:
- Top Industry: ${topIndustry || 'N/A'} ${topIndustryDemand !== null ? `(${topIndustryDemand}% demand)` : ''}
- Number of Industries: ${industriesCount}
- Trend: ${_trendDescription || 'stable'}

INSTRUCTION FORMAT:
Generate 6 professional insights in the exact format below. Each insight must be:
- A single, complete sentence
- Under 25 words
- Direct and professional
- Data-driven (reference specific numbers)
- No emojis
- No marketing language
- Start with the department name or code

FORMAT:
PROJECTION: [One sentence about the projection]
WORKFORCE: [One sentence about workforce supply and demand]
INDUSTRY: [One sentence about industry demand]
HEALTH: [One sentence about department health]
PRODUCTIVITY: [One sentence about graduate productivity]
SUMMARY: [One comprehensive summary sentence]

EXAMPLES:
PROJECTION: Computer Studies (CCS) alignment is projected to improve from 72% to 76.5% for Batch 2027, a 4.2% increase.
WORKFORCE: IT sector demand requires 15 additional CCS graduates for Batch 2027, indicating a workforce supply gap.
INDUSTRY: Strong demand exists in IT (92%) and BPO (78%) sectors for CCS graduates, with 5 industries represented.
HEALTH: CCS department health is 79% (Very Good), with employment at 82% and alignment at 76%.
PRODUCTIVITY: 98 of 128 CCS graduates (76%) are industry-ready for Batch 2027, exceeding the 80% target.
SUMMARY: CCS shows strong workforce demand and improving alignment, with a moderate graduate supply gap for Batch 2027.

Now generate 6 insights for ${departmentName} (${department}) based on the provided data:
`;

  const result = await callGemini(prompt);

  // If Gemini fails, use IMPROVED data-driven fallback
  if (!result.success) {
    const fallback = generateImprovedFallback(request);
    return { success: false, insights: fallback };
  }

  // Parse the response
  const text = result.text;
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  let insights: PredictionInsightResponse = {
    projection: generateImprovedProjection(request),
    workforce: generateImprovedWorkforce(request),
    industry: generateImprovedIndustry(request),
    health: generateImprovedHealth(request),
    productivity: generateImprovedProductivity(request),
    summary: generateImprovedSummary(request)
  };

  try {
    const projectionLine = lines.find(l => l.toLowerCase().includes('projection'));
    const workforceLine = lines.find(l => l.toLowerCase().includes('workforce'));
    const industryLine = lines.find(l => l.toLowerCase().includes('industry'));
    const healthLine = lines.find(l => l.toLowerCase().includes('health'));
    const productivityLine = lines.find(l => l.toLowerCase().includes('productivity'));
    const summaryLine = lines.find(l => l.toLowerCase().includes('summary'));

    if (projectionLine) insights.projection = projectionLine.replace(/^[A-Z]+:\s*/i, '').trim();
    if (workforceLine) insights.workforce = workforceLine.replace(/^[A-Z]+:\s*/i, '').trim();
    if (industryLine) insights.industry = industryLine.replace(/^[A-Z]+:\s*/i, '').trim();
    if (healthLine) insights.health = healthLine.replace(/^[A-Z]+:\s*/i, '').trim();
    if (productivityLine) insights.productivity = productivityLine.replace(/^[A-Z]+:\s*/i, '').trim();
    if (summaryLine) insights.summary = summaryLine.replace(/^[A-Z]+:\s*/i, '').trim();
  } catch (e) {
    console.warn('Error parsing Gemini response:', e);
  }

  return { success: true, insights };
}

// ============================================================
// IMPROVED FALLBACK INTERPRETATIONS - NATURAL & PROFESSIONAL
// ============================================================

function generateImprovedFallback(request: PredictionInsightRequest): PredictionInsightResponse {
  return {
    projection: generateImprovedProjection(request),
    workforce: generateImprovedWorkforce(request),
    industry: generateImprovedIndustry(request),
    health: generateImprovedHealth(request),
    productivity: generateImprovedProductivity(request),
    summary: generateImprovedSummary(request)
  };
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

  if (industriesCount === 0) {
    return `${departmentName} has ${totalAlumni} alumni but no industry data reported. Encouraging graduates to update employment information would improve workforce analysis.`;
  }

  const batchLabel = targetBatch !== null ? `Batch ${targetBatch}` : 'Next batch';

  let insight = `${departmentName} graduates work across ${industriesCount} different industry sectors.`;

  if (topIndustry && topIndustryDemand !== null) {
    insight += ` The primary employer is ${topIndustry}, representing ${topIndustryDemand}% of demand.`;
  }

  if (gap > 0) {
    insight += ` For ${batchLabel}, we anticipate needing ${gap} more graduates to meet employer demand.`;
    if (topIndustry && topIndustryDemand !== null && topIndustryDemand > 70) {
      insight += ` Strong demand in ${topIndustry} suggests this sector is actively recruiting.`;
    }
  } else if (gap < 0) {
    insight += ` For ${batchLabel}, graduate supply exceeds demand by ${Math.abs(gap)}.`;
    if (topIndustry && topIndustryDemand !== null && topIndustryDemand < 50) {
      insight += ` Lower demand in ${topIndustry} may be a contributing factor to this surplus.`;
    }
  } else {
    insight += ` For ${batchLabel}, graduate supply and demand are currently balanced.`;
  }

  return insight;
}

function generateImprovedIndustry(request: PredictionInsightRequest): string {
  const { departmentName, demandScore, topIndustry, topIndustryDemand, industriesCount } = request;

  if (industriesCount === 0) {
    return `${departmentName} graduates have not yet reported industry information. Alumni engagement in updating profiles would provide valuable insights.`;
  }

  let demandDesc = 'moderate';
  if (demandScore >= 70) demandDesc = 'strong';
  else if (demandScore < 40) demandDesc = 'limited';

  let insight = `${departmentName} graduates demonstrate ${demandDesc} demand in the job market with a score of ${demandScore}%.`;

  if (topIndustry && topIndustryDemand !== null) {
    insight += ` ${topIndustry} is the leading sector with ${topIndustryDemand}% demand.`;
  }

  if (industriesCount >= 3) {
    insight += ` With ${industriesCount} industries represented, graduates have diverse employment options.`;
  } else if (industriesCount === 1) {
    insight += ` Graduates are concentrated in a single industry, which may limit opportunities.`;
  }

  if (demandScore >= 70) {
    insight += ' This high demand validates the department\'s curriculum and graduate quality.';
  } else if (demandScore < 50) {
    insight += ' Strengthening industry partnerships and curriculum relevance may improve demand.';
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
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

  // Filter out departments with zero alumni for more relevant analysis
  const departmentsWithAlumni = stats.filter(s => s.total_alumni > 0);
  
  // If only one department has data, provide specific recommendation
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
    // IMPROVED FALLBACK: Only consider departments with data
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
    
    // Only mention "needs attention" if there's an actual underperformer with data
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
// HELPER FUNCTION: Get department full name
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
// Add this at the bottom of your gemini.ts file

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
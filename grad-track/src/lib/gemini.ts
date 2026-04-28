// src/lib/gemini.ts - WITH RATE LIMIT DETECTION
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

// Track if we're currently rate limited
let isRateLimited = false;
let rateLimitResetTime = 0;

async function callGemini(prompt: string): Promise<{ success: boolean; text: string }> {
  // Check if we're still in rate limit cooldown
  if (isRateLimited && Date.now() < rateLimitResetTime) {
    console.log('Still rate limited, using fallback');
    return { success: false, text: '' };
  }
  
  // Reset rate limit flag after cooldown
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
    
    // Handle rate limit
    if (response.status === 429) {
      isRateLimited = true;
      rateLimitResetTime = Date.now() + 60000; // Wait 60 seconds
      console.log('Rate limit hit, using fallback for next 60 seconds');
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

// ==================== FEATURE FUNCTIONS ====================

export async function getProgramPromotionRecommendations(stats: DepartmentStat[]): Promise<{ success: boolean; text: string }> {
  if (!stats.length) {
    return { 
      success: false, 
      text: 'No alumni data available to generate recommendations.' 
    };
  }

  const prompt = `
You are an alumni career analyst for GradTrack at Cebu Roosevelt Memorial Colleges (CRMC).

Based on the following alumni program performance data, identify which programs should be promoted:

Data:
${JSON.stringify(stats, null, 2)}

Identify the TOP 2 programs with the best employment and alignment rates.
For each program, provide:
- Program name
- Why they are successful (one short sentence)
- Target audience to promote to

Keep response concise, professional, and under 150 words.
`;
  
  const result = await callGemini(prompt);
  
  if (!result.success) {
    // Return fallback based on real data
    const sorted = [...stats].sort((a, b) => b.alignment_rate - a.alignment_rate);
    const topDept = sorted[0];
    return {
      success: false,
      text: `Based on alumni data, ${topDept.department} shows the strongest performance with ${topDept.alignment_rate.toFixed(0)}% career alignment and ${topDept.employment_rate.toFixed(0)}% employment rate. Consider promoting this program to prospective students.`
    };
  }
  
  return result;
}

export async function getProgramStrengthAnalysis(stats: DepartmentStat[]): Promise<{ success: boolean; text: string }> {
  if (!stats.length) {
    return { 
      success: false, 
      text: 'No alumni data available for analysis.' 
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
    const bestDept = stats.reduce((prev, current) => 
      (prev.alignment_rate > current.alignment_rate) ? prev : current
    );
    const worstDept = stats.reduce((prev, current) => 
      (prev.alignment_rate < current.alignment_rate) ? prev : current
    );
    const avgAlignment = stats.reduce((sum, d) => sum + d.alignment_rate, 0) / stats.length;
    return {
      success: false,
      text: `Overall CRMC shows ${avgAlignment.toFixed(0)}% average career alignment. ${bestDept.department} is the top performer at ${bestDept.alignment_rate.toFixed(0)}% alignment. ${worstDept.department} may need curriculum review at ${worstDept.alignment_rate.toFixed(0)}% alignment.`
    };
  }
  
  return result;
}

export async function getInstitutionalSummary(stats: DepartmentStat[]): Promise<{ success: boolean; text: string }> {
  if (!stats.length) {
    return { 
      success: false, 
      text: 'Tracking alumni performance across all departments.' 
    };
  }

  const totalAlumni = stats.reduce((sum, d) => sum + d.total_alumni, 0);
  const avgEmployment = stats.reduce((sum, d) => sum + d.employment_rate, 0) / stats.length;
  const avgAlignment = stats.reduce((sum, d) => sum + d.alignment_rate, 0) / stats.length;
  
  const prompt = `
Write ONE professional sentence summarizing GradTrack's alumni performance:
- Total alumni tracked: ${totalAlumni}
- Average employment rate: ${avgEmployment.toFixed(0)}%
- Average career alignment: ${avgAlignment.toFixed(0)}%

Keep under 20 words, encouraging tone.
`;
  
  const result = await callGemini(prompt);
  
  if (!result.success) {
    return {
      success: false,
      text: `🎓 Tracking ${totalAlumni} alumni with ${avgEmployment.toFixed(0)}% employment and ${avgAlignment.toFixed(0)}% career alignment across 5 departments.`
    };
  }
  
  return result;
}
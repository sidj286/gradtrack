import { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { getSpecializationFromJobTitle } from './lib/jobTitleMapper';
import { classifyCareerAlignmentSync } from './lib/careerClassifier';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================
// TYPES
// ============================================================
interface AnalyticsData {
  specializationData: {
    department: string;
    specialization: string;
    count: number;
    totalInDepartment: number;
    percentage: number;
  }[];
  departmentMetrics: {
    department: string;
    totalAlumni: number;
    employed: number;
    unemployed: number;
    inField: number;
    outOfField: number;
    pending: number;
    employmentRate: number;
    alignmentRate: number;
    unemploymentRate: number;
    institutionalAvgAlignment: number;
    institutionalAvgUnemployment: number;
    isAboveAvgAlignment: boolean;
    isBelowAvgUnemployment: boolean;
    status: 'excellent' | 'good' | 'needs_attention' | 'critical';
  }[];
  overallMetrics: {
    totalAlumni: number;
    totalEmployed: number;
    totalUnemployed: number;
    totalInField: number;
    totalOutOfField: number;
    totalPending: number;
    overallEmploymentRate: number;
    overallAlignmentRate: number;
    overallUnemploymentRate: number;
  };
  insights: {
    type: 'success' | 'warning' | 'danger' | 'info';
    message: string;
    recommendation?: string;
    department?: string;
  }[];
}

interface AlumniProfile {
  full_name: string;
  department: string;
  course: string;
  job_title: string;
  employment_status: string;
  career_alignment_status: string;
  batch_year: number;
  company: string;
}

// ============================================================
// COLOR CONSTANTS
// ============================================================
const COLORS = {
  primary: '#800000',
  primaryLight: '#a10000',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  gray: '#6b7280',
  chart: ['#800000', '#a10000', '#c41e3a', '#e74c3c', '#f1948a', '#f5b7b1'],
  pie: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'],
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ReportsPanel() {
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportType, setExportType] = useState<'employment' | 'department' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullData, setFullData] = useState<AnalyticsData | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [showExportModal, setShowExportModal] = useState(false);

  // ============================================================
  // PAGINATION HELPER
  // ============================================================
  const fetchAllRows = async (table: string, select: string, filter?: { column: string; value: any }) => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from(table)
        .select(select)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filter) {
        query = query.eq(filter.column, filter.value);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        page++;
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }

    return allData;
  };

  // ============================================================
  // FETCH ANALYTICS DATA - ONCE ON MOUNT
  // ============================================================
  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const alumni = await fetchAllRows('alumni_profiles', `
        full_name,
        department,
        course,
        job_title,
        employment_status,
        career_alignment_status,
        batch_year,
        company
      `);

      const processedData = processAnalyticsData(alumni || []);
      setFullData(processedData);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // DATA PROCESSING - ALWAYS PROCESSES FULL DATASET
  // ============================================================
  const processAnalyticsData = (alumniInput: AlumniProfile[]): AnalyticsData => {
    // Auto-heal alignment status for report calculations
    const alumni = alumniInput.map(a => {
      let status = a.career_alignment_status;
      if ((!status || status === 'Pending') && a.job_title && a.job_title.trim() !== '') {
        const syncResult = classifyCareerAlignmentSync(a.course || '', a.job_title);
        if (syncResult && syncResult.alignment_status !== 'Pending') {
          status = syncResult.alignment_status;
        }
      }
      return { ...a, career_alignment_status: status };
    });

    const total = alumni.length;

    const inField = alumni.filter(a => a.career_alignment_status === 'In-Field').length;
    const outOfField = alumni.filter(a => a.career_alignment_status === 'Out-of-Field').length;

    const employed = alumni.filter(a => 
      a.career_alignment_status === 'In-Field' || 
      a.career_alignment_status === 'Out-of-Field' || 
      (a.employment_status && a.employment_status !== 'Unemployed' && a.job_title && a.job_title.trim() !== '')
    ).length;

    const unemployed = Math.max(0, total - employed);
    const pending = alumni.filter(a => 
      !a.career_alignment_status || 
      a.career_alignment_status === 'Pending' ||
      a.career_alignment_status === null
    ).length;

    const overallEmploymentRate = total > 0 ? (employed / total) * 100 : 0;
    const overallAlignmentRate = total > 0 ? (inField / total) * 100 : 0;
    const overallUnemploymentRate = total > 0 ? (unemployed / total) * 100 : 0;

    const specializationMap = new Map<string, Map<string, number>>();
    const departmentTotals = new Map<string, number>();

    alumni.forEach(alum => {
      const dept = alum.department || 'Unknown';
      const spec = getSpecializationFromJobTitle(alum.job_title || '');

      if (!specializationMap.has(dept)) {
        specializationMap.set(dept, new Map());
      }
      const specMap = specializationMap.get(dept)!;
      specMap.set(spec, (specMap.get(spec) || 0) + 1);

      departmentTotals.set(dept, (departmentTotals.get(dept) || 0) + 1);
    });

    const specializationData: AnalyticsData['specializationData'] = [];
    specializationMap.forEach((specMap, dept) => {
      const totalInDept = departmentTotals.get(dept) || 1;
      specMap.forEach((count, spec) => {
        specializationData.push({
          department: dept,
          specialization: spec,
          count,
          totalInDepartment: totalInDept,
          percentage: (count / totalInDept) * 100,
        });
      });
    });

    const departments = [...new Set(alumni.map(a => a.department).filter(Boolean))];
    const departmentMetrics: AnalyticsData['departmentMetrics'] = departments.map(dept => {
      const deptAlumni = alumni.filter(a => a.department === dept);
      const deptTotal = deptAlumni.length;
      const deptEmployed = deptAlumni.filter(a => a.employment_status === 'Employed').length;
      const deptUnemployed = deptAlumni.filter(a => a.employment_status === 'Unemployed').length;

      const deptInField = deptAlumni.filter(a => a.career_alignment_status === 'In-Field').length;
      const deptOutOfField = deptAlumni.filter(a => a.career_alignment_status === 'Out-of-Field').length;
      const deptPending = deptAlumni.filter(a => 
        !a.career_alignment_status || 
        a.career_alignment_status === 'Pending' ||
        a.career_alignment_status === null
      ).length;

      const employmentRate = deptTotal > 0 ? (deptEmployed / deptTotal) * 100 : 0;
      const alignmentRate = deptTotal > 0 ? (deptInField / deptTotal) * 100 : 0;
      const unemploymentRate = deptTotal > 0 ? (deptUnemployed / deptTotal) * 100 : 0;

      let status: 'excellent' | 'good' | 'needs_attention' | 'critical' = 'good';
      if (alignmentRate >= 70 && unemploymentRate < 10) status = 'excellent';
      else if (alignmentRate >= 50 && unemploymentRate < 20) status = 'good';
      else if (alignmentRate >= 30 || unemploymentRate < 30) status = 'needs_attention';
      else status = 'critical';

      return {
        department: dept,
        totalAlumni: deptTotal,
        employed: deptEmployed,
        unemployed: deptUnemployed,
        inField: deptInField,
        outOfField: deptOutOfField,
        pending: deptPending,
        employmentRate,
        alignmentRate,
        unemploymentRate,
        institutionalAvgAlignment: overallAlignmentRate,
        institutionalAvgUnemployment: overallUnemploymentRate,
        isAboveAvgAlignment: alignmentRate >= overallAlignmentRate,
        isBelowAvgUnemployment: unemploymentRate <= overallUnemploymentRate,
        status,
      };
    });

    // ============================================================
    // INSIGHT GENERATION - EVERY department gets insights
    // ============================================================
    const insights: AnalyticsData['insights'] = [];

    departmentMetrics.forEach(dept => {
      const alignmentDiff = dept.alignmentRate - dept.institutionalAvgAlignment;
      const unemploymentDiff = dept.unemploymentRate - dept.institutionalAvgUnemployment;

      // --- ALIGNMENT INSIGHT ---
      if (alignmentDiff > 10) {
        insights.push({
          type: 'success',
          department: dept.department,
          message: `${dept.department} is significantly exceeding institutional alignment (${dept.alignmentRate.toFixed(1)}% vs ${dept.institutionalAvgAlignment.toFixed(1)}% avg).`,
          recommendation: `Document and share ${dept.department}'s successful career preparation strategies with other departments.`,
        });
      } else if (alignmentDiff > 5) {
        insights.push({
          type: 'success',
          department: dept.department,
          message: `${dept.department} is performing above the institutional alignment average (${dept.alignmentRate.toFixed(1)}% vs ${dept.institutionalAvgAlignment.toFixed(1)}% avg).`,
          recommendation: `Continue supporting ${dept.department}'s career development initiatives.`,
        });
      } else if (alignmentDiff >= -5) {
        insights.push({
          type: 'info',
          department: dept.department,
          message: `${dept.department} is performing in line with institutional alignment (${dept.alignmentRate.toFixed(1)}% vs ${dept.institutionalAvgAlignment.toFixed(1)}% avg).`,
          recommendation: `Maintain current career preparation programs for ${dept.department}.`,
        });
      } else if (alignmentDiff >= -10) {
        insights.push({
          type: 'warning',
          department: dept.department,
          message: `${dept.department} is below institutional alignment (${dept.alignmentRate.toFixed(1)}% vs ${dept.institutionalAvgAlignment.toFixed(1)}% avg).`,
          recommendation: `Strengthen industry partnerships and career guidance for ${dept.department} students.`,
        });
      } else {
        insights.push({
          type: 'danger',
          department: dept.department,
          message: `${dept.department} is significantly below institutional alignment (${dept.alignmentRate.toFixed(1)}% vs ${dept.institutionalAvgAlignment.toFixed(1)}% avg).`,
          recommendation: `Urgently review ${dept.department} curriculum and enhance career preparation programs.`,
        });
      }

      // --- UNEMPLOYMENT INSIGHT ---
      if (unemploymentDiff < -10) {
        insights.push({
          type: 'success',
          department: dept.department,
          message: `${dept.department} has significantly lower unemployment (${dept.unemploymentRate.toFixed(1)}% vs ${dept.institutionalAvgUnemployment.toFixed(1)}% avg).`,
          recommendation: `Share ${dept.department}'s successful employment strategies with other departments.`,
        });
      } else if (unemploymentDiff < -5) {
        insights.push({
          type: 'success',
          department: dept.department,
          message: `${dept.department} has lower unemployment (${dept.unemploymentRate.toFixed(1)}% vs ${dept.institutionalAvgUnemployment.toFixed(1)}% avg).`,
          recommendation: `Continue supporting ${dept.department}'s job placement programs.`,
        });
      } else if (unemploymentDiff <= 5) {
        insights.push({
          type: 'info',
          department: dept.department,
          message: `${dept.department} has unemployment in line with institutional average (${dept.unemploymentRate.toFixed(1)}% vs ${dept.institutionalAvgUnemployment.toFixed(1)}% avg).`,
          recommendation: `Maintain current job placement support for ${dept.department} graduates.`,
        });
      } else if (unemploymentDiff <= 10) {
        insights.push({
          type: 'warning',
          department: dept.department,
          message: `${dept.department} has higher unemployment (${dept.unemploymentRate.toFixed(1)}% vs ${dept.institutionalAvgUnemployment.toFixed(1)}% avg).`,
          recommendation: `Enhance job placement services and employer partnerships for ${dept.department}.`,
        });
      } else {
        insights.push({
          type: 'danger',
          department: dept.department,
          message: `${dept.department} has significantly higher unemployment (${dept.unemploymentRate.toFixed(1)}% vs ${dept.institutionalAvgUnemployment.toFixed(1)}% avg).`,
          recommendation: `Urgently review ${dept.department} curriculum and strengthen industry partnerships.`,
        });
      }

      // --- OVERALL STATUS INSIGHT ---
      if (dept.status === 'excellent') {
        insights.push({
          type: 'success',
          department: dept.department,
          message: `${dept.department} is performing exceptionally well with ${dept.alignmentRate.toFixed(1)}% alignment and ${dept.unemploymentRate.toFixed(1)}% unemployment.`,
          recommendation: `Continue supporting ${dept.department}'s successful programs and initiatives.`,
        });
      } else if (dept.status === 'good') {
        insights.push({
          type: 'info',
          department: dept.department,
          message: `${dept.department} shows solid performance with ${dept.alignmentRate.toFixed(1)}% alignment and ${dept.unemploymentRate.toFixed(1)}% unemployment.`,
          recommendation: `Maintain current strategies and monitor for improvement opportunities in ${dept.department}.`,
        });
      } else if (dept.status === 'needs_attention') {
        insights.push({
          type: 'warning',
          department: dept.department,
          message: `${dept.department} needs attention with ${dept.alignmentRate.toFixed(1)}% alignment and ${dept.unemploymentRate.toFixed(1)}% unemployment.`,
          recommendation: `Develop targeted improvement plan for ${dept.department} focusing on career preparation.`,
        });
      } else {
        insights.push({
          type: 'danger',
          department: dept.department,
          message: `${dept.department} requires critical intervention with ${dept.alignmentRate.toFixed(1)}% alignment and ${dept.unemploymentRate.toFixed(1)}% unemployment.`,
          recommendation: `Immediate strategic review needed for ${dept.department} including curriculum and industry partnerships.`,
        });
      }
    });

    // --- ADD BEST/WORST DEPARTMENT INSIGHTS ---
    if (departmentMetrics.length > 0) {
      const bestDept = departmentMetrics.reduce((best, current) =>
        current.alignmentRate > best.alignmentRate ? current : best
      );
      insights.push({
        type: 'info',
        department: bestDept.department,
        message: `${bestDept.department} has the highest career alignment rate at ${bestDept.alignmentRate.toFixed(1)}%.`,
        recommendation: `Analyze and replicate ${bestDept.department}'s successful strategies across the institution.`,
      });

      const lowestUnemployment = departmentMetrics.reduce((lowest, current) =>
        current.unemploymentRate < lowest.unemploymentRate ? current : lowest
      );
      if (lowestUnemployment.department !== bestDept.department) {
        insights.push({
          type: 'info',
          department: lowestUnemployment.department,
          message: `${lowestUnemployment.department} has the lowest unemployment rate at ${lowestUnemployment.unemploymentRate.toFixed(1)}%.`,
          recommendation: `Study ${lowestUnemployment.department}'s employment strategies for institutional adoption.`,
        });
      }
    }

    // Sort insights by severity
    const severityOrder = { danger: 0, warning: 1, info: 2, success: 3 };
    insights.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);

    return {
      specializationData,
      departmentMetrics,
      overallMetrics: {
        totalAlumni: total,
        totalEmployed: employed,
        totalUnemployed: unemployed,
        totalInField: inField,
        totalOutOfField: outOfField,
        totalPending: pending,
        overallEmploymentRate,
        overallAlignmentRate,
        overallUnemploymentRate,
      },
      insights,
    };
  };

  // ============================================================
  // FILTER DATA - CLIENT SIDE, INSTANT, NO LOADING
  // ============================================================
  const filteredData = useMemo(() => {
    if (!fullData) return null;
    if (selectedDepartment === 'all') return fullData;

    const filteredDeptMetrics = fullData.departmentMetrics.filter(
      d => d.department === selectedDepartment
    );
    const filteredSpecData = fullData.specializationData.filter(
      d => d.department === selectedDepartment
    );
    const filteredInsights = fullData.insights.filter(
      i => i.department === selectedDepartment
    );
    const selectedDeptMetric = filteredDeptMetrics[0];

    if (!selectedDeptMetric) return fullData;

    return {
      specializationData: filteredSpecData,
      departmentMetrics: filteredDeptMetrics,
      overallMetrics: {
        totalAlumni: selectedDeptMetric.totalAlumni,
        totalEmployed: selectedDeptMetric.employed,
        totalUnemployed: selectedDeptMetric.unemployed,
        totalInField: selectedDeptMetric.inField,
        totalOutOfField: selectedDeptMetric.outOfField,
        totalPending: selectedDeptMetric.pending,
        overallEmploymentRate: selectedDeptMetric.employmentRate,
        overallAlignmentRate: selectedDeptMetric.alignmentRate,
        overallUnemploymentRate: selectedDeptMetric.unemploymentRate,
      },
      insights: filteredInsights,
    };
  }, [fullData, selectedDepartment]);

  // ============================================================
  // HELPER FUNCTION: Standard Deviation
  // ============================================================
  const calculateStdDev = (values: number[]): number => {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  };

  // ============================================================
  // INTERPRETATION GENERATOR
  // ============================================================
  const generateInterpretation = (stats: any, department?: string, deptStats?: any[], alumni?: any[]) => {
    const dept = department || 'Overall';
    const interpretations = [];
    const alignment = stats.alignmentRate || 0;
    const unemployment = stats.unemploymentRate || 0;
    const employment = stats.employmentRate || 0;
    const total = stats.total || 0;
    const inField = stats.inField || 0;
    const outOfField = stats.outOfField || 0;
    const pending = stats.pending || 0;
    const employed = stats.employed || 0;
    const unemployed = stats.unemployed || 0;

    // ============================================================
    // 1. EXECUTIVE SUMMARY
    // ============================================================
    if (dept === 'Overall') {
      let summary = `This report provides a comprehensive INSTITUTION-WIDE analysis of all alumni across all departments. `;
      
      if (total > 0) {
        summary += `Based on ${total} alumni records across ${deptStats?.length || 0} departments, `;
        summary += `${employed} (${employment.toFixed(1)}%) are employed, ${unemployed} (${unemployment.toFixed(1)}%) are unemployed, and ${pending} (${((pending/total)*100).toFixed(1)}%) have pending status. `;
        
        if (inField > 0) {
          summary += `${inField} (${alignment.toFixed(1)}%) alumni are working in their field of study, while ${outOfField} (${((outOfField/total)*100).toFixed(1)}%) are working outside their field.`;
        }
        
        if (deptStats && deptStats.length > 0) {
          const topDept = deptStats.reduce((best, current) => 
            current.alignmentRate > best.alignmentRate ? current : best
          );
          const bottomDept = deptStats.reduce((worst, current) => 
            current.alignmentRate < worst.alignmentRate ? current : worst
          );
          summary += ` The highest performing department is ${topDept.department} with ${topDept.alignmentRate.toFixed(1)}% alignment, while ${bottomDept.department} has the lowest at ${bottomDept.alignmentRate.toFixed(1)}%.`;
        }
      } else {
        summary += 'No alumni records are available for analysis.';
      }
      
      interpretations.push(`EXECUTIVE SUMMARY: ${summary}`);

      if (total > 0) {
        let healthAssessment = 'INSTITUTIONAL ASSESSMENT: ';
        if (alignment >= 70 && employment >= 80 && unemployment < 10) {
          healthAssessment += 'The institution demonstrates EXCELLENT overall performance. Graduates are highly employable and well-aligned with their fields of study. This reflects positively on the quality of programs and career preparation across all departments.';
        } else if (alignment >= 55 && employment >= 65 && unemployment < 20) {
          healthAssessment += 'The institution shows GOOD overall performance with some areas for improvement. While graduates are generally finding employment, there is opportunity to strengthen career alignment across departments.';
        } else if (alignment >= 40 || employment >= 50) {
          healthAssessment += 'The institution shows MODERATE performance with significant opportunities for improvement. A substantial portion of graduates are either unemployed or working outside their field of study. Institutional-level intervention may be needed to address these trends.';
        } else {
          healthAssessment += 'The institution requires SIGNIFICANT improvement across multiple metrics. Low career alignment and employment rates suggest systemic issues that need to be addressed at the institutional level through curriculum review, industry partnership development, and enhanced career services.';
        }
        interpretations.push(healthAssessment);

        let overallRec = 'INSTITUTIONAL RECOMMENDATION: ';
        if (alignment < 50) {
          overallRec += 'Prioritize institutional-wide career alignment initiatives. Consider establishing a centralized career development office, strengthening employer partnerships, and implementing a standardized career preparation curriculum across all departments.';
        } else if (unemployment > 15) {
          overallRec += 'Focus on institution-wide job placement strategies. Develop a comprehensive alumni career support program, expand internship opportunities, and create targeted job matching services for graduates.';
        } else if (alignment >= 70 && unemployment < 10) {
          overallRec += 'Maintain and enhance current successful institutional strategies. Continue investing in career development resources and strengthen inter-departmental collaboration to share best practices.';
        } else {
          overallRec += 'Continue monitoring key metrics and implementing targeted interventions. Consider conducting a comprehensive institutional review to identify systemic barriers to graduate success.';
        }
        interpretations.push(overallRec);

        if (deptStats && deptStats.length > 1) {
          const stdDev = calculateStdDev(deptStats.map(d => d.alignmentRate));
          if (stdDev > 15) {
            interpretations.push(
              `DEPARTMENT VARIATION: There is significant variation (${stdDev.toFixed(1)}% standard deviation) in career alignment rates across departments. ` +
              `This suggests that some departments are significantly outperforming others. ` +
              `Recommendation: Conduct a cross-departmental analysis to identify and share best practices from high-performing departments.`
            );
          } else if (stdDev > 8) {
            interpretations.push(
              `DEPARTMENT VARIATION: There is moderate variation (${stdDev.toFixed(1)}% standard deviation) in career alignment rates across departments. ` +
              `This suggests some inconsistency in program effectiveness. ` +
              `Recommendation: Review department-specific strategies and consider implementing a unified institutional approach to career preparation.`
            );
          } else {
            interpretations.push(
              `DEPARTMENT CONSISTENCY: Career alignment rates are relatively consistent across departments (${stdDev.toFixed(1)}% standard deviation). ` +
              `This suggests that institutional-wide initiatives are having a uniform impact across all programs. Continue to monitor and maintain consistent quality standards.`
            );
          }
        }
      }

    } else {
      let summary = `This report provides a comprehensive analysis of the ${dept} department's performance based on ${total} alumni records. `;
      
      if (total > 0) {
        summary += `Of these, ${employed} (${employment.toFixed(1)}%) are employed, ${unemployed} (${unemployment.toFixed(1)}%) are unemployed, and ${pending} (${((pending/total)*100).toFixed(1)}%) have pending status. `;
        
        if (inField > 0) {
          summary += `${inField} (${alignment.toFixed(1)}%) alumni are working in their field of study, while ${outOfField} (${((outOfField/total)*100).toFixed(1)}%) are working outside their field.`;
        }
      } else {
        summary += 'No alumni records are available for analysis.';
      }
      
      interpretations.push(`EXECUTIVE SUMMARY: ${summary}`);

      if (total > 0 && alignment > 0) {
        if (alignment >= 80) {
          interpretations.push(
            `CAREER ALIGNMENT ANALYSIS: The ${dept} department demonstrates EXCELLENT career alignment at ${alignment.toFixed(1)}%. ` +
            `This means ${Math.round((alignment/100) * total)} out of ${total} alumni are working in their field of study. ` +
            `This high alignment rate indicates that the program curriculum is highly relevant to current industry demands ` +
            `and graduates are successfully securing positions that match their academic training.`
          );
        } else if (alignment >= 65) {
          interpretations.push(
            `CAREER ALIGNMENT ANALYSIS: The ${dept} department shows GOOD career alignment at ${alignment.toFixed(1)}%. ` +
            `Approximately ${Math.round((alignment/100) * total)} alumni are employed in their field of study. ` +
            `While this is a positive indicator, there is opportunity to improve by strengthening industry connections, ` +
            `enhancing internship programs, and providing more targeted career guidance to students.`
          );
        } else if (alignment >= 50) {
          interpretations.push(
            `CAREER ALIGNMENT ANALYSIS: The ${dept} department has MODERATE career alignment at ${alignment.toFixed(1)}%. ` +
            `About ${Math.round((alignment/100) * total)} alumni are working in field-related positions. ` +
            `This suggests that the program could benefit from curriculum review, enhanced internship programs, ` +
            `and stronger partnerships with industry employers to better prepare students for field-relevant careers.`
          );
        } else if (alignment >= 35) {
          interpretations.push(
            `CAREER ALIGNMENT ANALYSIS: The ${dept} department shows LOW career alignment at only ${alignment.toFixed(1)}%. ` +
            `Only ${Math.round((alignment/100) * total)} alumni are working in their field of study. ` +
            `This raises concerns about the program's current industry relevance. Recommended actions include: ` +
            `(a) conducting a comprehensive curriculum review with industry partners, ` +
            `(b) expanding internship and apprenticeship programs, and ` +
            `(c) implementing a structured career mentoring program.`
          );
        } else if (alignment < 35 && alignment > 0) {
          interpretations.push(
            `CAREER ALIGNMENT ANALYSIS: The ${dept} department has CRITICALLY LOW career alignment at ${alignment.toFixed(1)}%. ` +
            `Only ${Math.round((alignment/100) * total)} alumni are working in their field of study. ` +
            `This is a significant concern that requires urgent institutional intervention. ` +
            `Immediate actions needed: (1) Emergency curriculum review with industry advisory board, ` +
            `(2) Development of industry-relevant specializations, (3) Enhanced career counseling services, and ` +
            `(4) Strategic partnerships with target employers.`
          );
        }
      }

      if (total > 0 && employment > 0) {
        if (employment >= 90) {
          interpretations.push(
            `EMPLOYMENT RATE ANALYSIS: The ${dept} department achieves an EXCELLENT employment rate of ${employment.toFixed(1)}%. ` +
            `This means ${employed} out of ${total} graduates are successfully employed. ` +
            `This outstanding rate reflects well on the program's reputation and the marketability of its graduates. ` +
            `The department should maintain its current strategies and serve as a benchmark for other departments.`
          );
        } else if (employment >= 75) {
          interpretations.push(
            `EMPLOYMENT RATE ANALYSIS: The ${dept} department has a GOOD employment rate of ${employment.toFixed(1)}%. ` +
            `${employed} out of ${total} graduates have secured employment. ` +
            `This demonstrates the program's effectiveness in preparing students for the job market. ` +
            `To further improve, consider strengthening alumni networking programs and employer engagement initiatives.`
          );
        } else if (employment >= 60) {
          interpretations.push(
            `EMPLOYMENT RATE ANALYSIS: The ${dept} department shows a MODERATE employment rate of ${employment.toFixed(1)}%. ` +
            `${employed} out of ${total} graduates are employed. ` +
            `This suggests a need to enhance the program's career preparation components, including: ` +
            `- Improved job placement services, ` +
            `- Enhanced interview and professional skills training, and ` +
            `- Stronger industry partnership development.`
          );
        } else if (employment < 60 && employment > 0) {
          interpretations.push(
            `EMPLOYMENT RATE ANALYSIS: The ${dept} department has a CONCERNING employment rate of ${employment.toFixed(1)}%. ` +
            `Only ${employed} out of ${total} graduates have found employment. ` +
            `This is a serious concern that requires immediate strategic action: ` +
            `(1) Program curriculum review with employer input, (2) Expansion of internship opportunities, ` +
            `(3) Strengthening of career development services, and (4) Development of targeted employer engagement strategies.`
          );
        }
      }

      if (total > 0 && unemployment > 0) {
        if (unemployment < 5) {
          interpretations.push(
            `UNEMPLOYMENT RATE ANALYSIS: The ${dept} department has an EXCELLENT unemployment rate of ${unemployment.toFixed(1)}%. ` +
            `Only ${unemployed} out of ${total} graduates are unemployed. ` +
            `This indicates that graduates are highly employable and the program is effectively meeting labor market demands. ` +
            `The department should maintain its successful approach and share best practices with other departments.`
          );
        } else if (unemployment < 15) {
          interpretations.push(
            `UNEMPLOYMENT RATE ANALYSIS: The ${dept} department maintains a GOOD unemployment rate of ${unemployment.toFixed(1)}%. ` +
            `${unemployed} out of ${total} graduates are currently unemployed. ` +
            `To further reduce unemployment, consider enhancing student support services and expanding industry partnerships.`
          );
        } else if (unemployment < 30) {
          interpretations.push(
            `UNEMPLOYMENT RATE ANALYSIS: The ${dept} department has an ELEVATED unemployment rate of ${unemployment.toFixed(1)}%. ` +
            `${unemployed} out of ${total} graduates are unemployed. ` +
            `Recommended actions: Conduct graduate exit surveys to identify barriers to employment, ` +
            `strengthen career preparation programs, develop stronger employer partnerships, and ` +
            `consider program curriculum adjustments based on industry feedback.`
          );
        } else if (unemployment >= 30) {
          interpretations.push(
            `UNEMPLOYMENT RATE ANALYSIS: The ${dept} department has a CRITICAL unemployment rate of ${unemployment.toFixed(1)}%. ` +
            `${unemployed} out of ${total} graduates are unemployed. ` +
            `This is a severe concern that requires urgent institutional response: ` +
            `(1) Comprehensive program review with industry stakeholders, (2) Development of new industry-aligned specializations, ` +
            `(3) Strategic employer engagement initiative, (4) Enhanced student career support services, and ` +
            `(5) Regular monitoring of graduate employment outcomes.`
          );
        }
      }
    }

    // ============================================================
    // 5. COMPARATIVE ANALYSIS
    // ============================================================
    if (deptStats && deptStats.length > 1) {
      const avgAlignment = deptStats.reduce((sum, d) => sum + d.alignmentRate, 0) / deptStats.length;
      const avgUnemployment = deptStats.reduce((sum, d) => sum + d.unemploymentRate, 0) / deptStats.length;
      
      const alignmentDiff = alignment - avgAlignment;
      const unemploymentDiff = unemployment - avgUnemployment;

      if (dept === 'Overall') {
        interpretations.push(
          `INSTITUTIONAL OVERVIEW: The institution as a whole has an average career alignment rate of ${avgAlignment.toFixed(1)}% and an average unemployment rate of ${avgUnemployment.toFixed(1)}%. ` +
          `This represents the baseline for all department-level comparisons.`
        );
      } else {
        interpretations.push(`COMPARATIVE ANALYSIS: The ${dept} department is being compared against ${deptStats.length - 1} other departments.`);

        if (Math.abs(alignmentDiff) > 5) {
          if (alignmentDiff > 0) {
            interpretations.push(
              `ALIGNMENT PERFORMANCE: ${dept} performs ${alignmentDiff.toFixed(1)}% ABOVE the institutional average (${avgAlignment.toFixed(1)}%) for career alignment. ` +
              `This indicates that the department's strategies for career preparation are particularly effective. ` +
              `Consider conducting a detailed analysis of what this department does differently to achieve these superior results.`
            );
          } else {
            interpretations.push(
              `ALIGNMENT PERFORMANCE: ${dept} performs ${Math.abs(alignmentDiff).toFixed(1)}% BELOW the institutional average (${avgAlignment.toFixed(1)}%) for career alignment. ` +
              `This suggests that the department faces unique challenges in preparing students for field-related careers. ` +
              `Recommendation: Conduct a peer learning session with the best-performing department to identify improvement opportunities.`
            );
          }
        } else {
          interpretations.push(
            `ALIGNMENT PERFORMANCE: ${dept} is performing at ${alignment.toFixed(1)}%, which is close to the institutional average of ${avgAlignment.toFixed(1)}%. ` +
            `This indicates that the department is keeping pace with overall institutional performance in career alignment.`
          );
        }

        if (Math.abs(unemploymentDiff) > 5) {
          if (unemploymentDiff < 0) {
            interpretations.push(
              `UNEMPLOYMENT PERFORMANCE: ${dept} has ${Math.abs(unemploymentDiff).toFixed(1)}% LOWER unemployment than the institutional average (${avgUnemployment.toFixed(1)}%). ` +
              `This is a positive indicator that the department's graduates are particularly competitive in the job market. ` +
              `Document and share this department's successful strategies with other departments.`
            );
          } else {
            interpretations.push(
              `UNEMPLOYMENT PERFORMANCE: ${dept} has ${Math.abs(unemploymentDiff).toFixed(1)}% HIGHER unemployment than the institutional average (${avgUnemployment.toFixed(1)}%). ` +
              `This indicates that the department's graduates may face additional barriers to employment. ` +
              `Recommendation: Conduct a focused review of the program's career preparation components and employer engagement strategies.`
            );
          }
        } else {
          interpretations.push(
            `UNEMPLOYMENT PERFORMANCE: ${dept} has an unemployment rate of ${unemployment.toFixed(1)}%, which is close to the institutional average of ${avgUnemployment.toFixed(1)}%. ` +
            `This indicates that the department is performing in line with overall institutional trends.`
          );
        }
      }

      if (dept !== 'Overall') {
        const bestDept = deptStats.reduce((best, current) =>
          current.alignmentRate > best.alignmentRate ? current : best
        );
        const worstDept = deptStats.reduce((worst, current) =>
          current.alignmentRate < worst.alignmentRate ? current : worst
        );

        if (bestDept.department !== dept) {
          interpretations.push(
            `BENCHMARK INSIGHT: ${bestDept.department} has the highest career alignment rate at ${bestDept.alignmentRate.toFixed(1)}%. ` +
            `Consider studying their approaches to career preparation and industry engagement.`
          );
        } else {
          interpretations.push(
            `BENCHMARK INSIGHT: ${dept} has the highest career alignment rate at ${bestDept.alignmentRate.toFixed(1)}%. ` +
            `Other departments should study ${dept}'s successful strategies.`
          );
        }

        if (worstDept.department !== dept && worstDept.alignmentRate < 50) {
          interpretations.push(
            `IMPROVEMENT OPPORTUNITY: ${worstDept.department} has the lowest career alignment rate at ${worstDept.alignmentRate.toFixed(1)}%. ` +
            `Consider implementing a support program to help this department improve its career alignment outcomes.`
          );
        }
      }
    }

    // ============================================================
    // 6. SPECIALIZATION INSIGHTS
    // ============================================================
    if (alumni && alumni.length > 0) {
      const specCount = new Map<string, number>();
      alumni.forEach(alum => {
        const spec = getSpecializationFromJobTitle(alum.job_title || '');
        specCount.set(spec, (specCount.get(spec) || 0) + 1);
      });

      const topSpecs = Array.from(specCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      if (topSpecs.length > 0) {
        let specInsight = `SPECIALIZATION INSIGHTS: The most common specializations among ${dept} alumni are: `;
        topSpecs.forEach(([spec, count], index) => {
          specInsight += `${spec} (${count} alumni, ${((count/total)*100).toFixed(1)}%)`;
          if (index < topSpecs.length - 1) specInsight += ', ';
        });
        specInsight += '. This distribution reflects the career paths that graduates are pursuing.';
        interpretations.push(specInsight);
      }
    }

    // ============================================================
    // 7. OVERALL STATUS SUMMARY
    // ============================================================
    if (total > 0) {
      if (dept === 'Overall') {
        if (alignment >= 70 && unemployment < 15 && employment >= 75) {
          interpretations.push(
            `INSTITUTIONAL STATUS: The institution demonstrates STRONG overall performance across all key metrics. ` +
            `With ${alignment.toFixed(1)}% career alignment, ${unemployment.toFixed(1)}% unemployment, and ${employment.toFixed(1)}% employment rate, ` +
            `the institution is effectively preparing students for successful careers. Continue to maintain and strengthen current successful initiatives across all departments.`
          );
        } else if (alignment >= 50 && unemployment < 25 && employment >= 60) {
          interpretations.push(
            `INSTITUTIONAL STATUS: The institution shows SATISFACTORY performance with opportunities for improvement. ` +
            `While graduates are finding employment (${employment.toFixed(1)}%), there is room to strengthen career alignment (${alignment.toFixed(1)}%) ` +
            `and further reduce unemployment (${unemployment.toFixed(1)}%) at the institutional level. Focus on: ` +
            `(a) strengthening industry partnerships across all departments, (b) enhancing career counseling services, and ` +
            `(c) developing targeted interventions for underperforming programs.`
          );
        } else {
          interpretations.push(
            `INSTITUTIONAL STATUS: The institution requires SIGNIFICANT improvement across multiple metrics. ` +
            `With ${alignment.toFixed(1)}% career alignment, ${unemployment.toFixed(1)}% unemployment, and ${employment.toFixed(1)}% employment rate, ` +
            `the institution needs comprehensive review and strategic intervention. Priority actions: ` +
            `(1) institutional-wide curriculum review with industry partners, (2) expanded work-integrated learning opportunities, ` +
            `(3) enhanced career support services, and (4) development of strategic industry partnerships at the institutional level.`
          );
        }
      } else {
        if (alignment >= 70 && unemployment < 15 && employment >= 75) {
          interpretations.push(
            `OVERALL ASSESSMENT: ${dept} demonstrates STRONG overall performance across all key metrics. ` +
            `With ${alignment.toFixed(1)}% career alignment, ${unemployment.toFixed(1)}% unemployment, and ${employment.toFixed(1)}% employment rate, ` +
            `the program is effectively preparing students for successful careers. Continue to maintain and strengthen current successful initiatives.`
          );
        } else if (alignment >= 50 && unemployment < 25 && employment >= 60) {
          interpretations.push(
            `OVERALL ASSESSMENT: ${dept} shows SATISFACTORY performance with opportunities for improvement. ` +
            `While graduates are finding employment (${employment.toFixed(1)}%), there is room to strengthen career alignment (${alignment.toFixed(1)}%) ` +
            `and further reduce unemployment (${unemployment.toFixed(1)}%). Focus on: (a) strengthening industry partnerships, ` +
            `(b) enhancing career counseling, and (c) developing targeted interventions for at-risk students.`
          );
        } else {
          interpretations.push(
            `OVERALL ASSESSMENT: ${dept} requires SIGNIFICANT improvement across multiple metrics. ` +
            `With ${alignment.toFixed(1)}% career alignment, ${unemployment.toFixed(1)}% unemployment, and ${employment.toFixed(1)}% employment rate, ` +
            `the program needs comprehensive review and strategic intervention. Priority actions: ` +
            `(1) curriculum review with industry partners, (2) expanded work-integrated learning opportunities, ` +
            `(3) enhanced career support services, and (4) development of strategic industry partnerships.`
          );
        }
      }
    }

    return interpretations.join('\n\n');
  };

  // ============================================================
  // PDF GENERATION FUNCTIONS
  // ============================================================

  const generateDepartmentPDF = (props: any) => {
    const { deptName, interpretation, stats, specializationData, recommendations } = props;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(128, 0, 0);
    doc.text(`${deptName} Department Report`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Executive Summary & Interpretation', 14, currentY);
    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    
    const paragraphs = interpretation.split('\n\n');
    paragraphs.forEach((para: string) => {
      if (para.trim()) {
        const splitPara = doc.splitTextToSize(para.trim(), pageWidth - 28);
        doc.text(splitPara, 14, currentY);
        currentY += (splitPara.length * 4.5) + 5;
      }
    });
    currentY += 5;

    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Department Statistics', 14, currentY);
    currentY += 5;

    const statsData = [
      ['Total Alumni', stats.total.toString()],
      ['Employed', stats.employed.toString()],
      ['Unemployed', stats.unemployed.toString()],
      ['Employment Rate', `${stats.employmentRate.toFixed(2)}%`],
      ['Career Alignment Rate', `${stats.alignmentRate.toFixed(2)}%`],
      ['Unemployment Rate', `${stats.unemploymentRate.toFixed(2)}%`],
      ['In-Field', stats.inField.toString()],
      ['Out-of-Field', stats.outOfField.toString()],
      ['Pending', stats.pending.toString()],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Value']],
      body: statsData,
      theme: 'striped',
      headStyles: {
        fillColor: [128, 0, 0],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Specialization Distribution by Department', 14, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Showing Distribution of entities by category', 14, currentY);
    currentY += 10;

    if (specializationData && specializationData.length > 0) {
      const groupedBySpec = new Map<string, { departments: string[], count: number }>();
      
      specializationData.forEach((item: any) => {
        if (!groupedBySpec.has(item.specialization)) {
          groupedBySpec.set(item.specialization, { departments: [], count: 0 });
        }
        const entry = groupedBySpec.get(item.specialization)!;
        if (!entry.departments.includes(item.department)) {
          entry.departments.push(item.department);
        }
        entry.count += item.count;
      });

      const specTableData = Array.from(groupedBySpec.entries())
        .map(([spec, data]) => [
          spec,
          data.departments.join(', '),
          data.count.toString()
        ])
        .sort((a, b) => parseInt(b[2]) - parseInt(a[2]));

      autoTable(doc, {
        startY: currentY,
        head: [['Specialization', 'Department', 'Total Count']],
        body: specTableData,
        theme: 'striped',
        headStyles: {
          fillColor: [128, 0, 0],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
        },
        styles: {
          fontSize: 9,
          cellPadding: 4,
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 40 },
        },
        margin: { left: 14, right: 14 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.text('No specialization data available', 14, currentY);
      currentY += 10;
    }

    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Strategic Recommendations', 14, currentY);
    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    if (recommendations && recommendations.length > 0) {
      recommendations.forEach((rec: string, index: number) => {
        const splitRec = doc.splitTextToSize(`${index + 1}. ${rec}`, pageWidth - 28);
        doc.text(splitRec, 14, currentY);
        currentY += (splitRec.length * 5) + 3;
      });
    } else {
      doc.text('No specific recommendations at this time. Department is performing well.', 14, currentY);
      currentY += 10;
    }

    const totalPages = doc.internal.pages.length;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${totalPages} | ${deptName} Department Report | Generated: ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    const fileName = `${deptName.replace(/[^a-zA-Z0-9]/g, '_')}_Department_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const generateEmploymentSummaryPDF = (props: any) => {
    const { interpretation, stats, deptStats, insights } = props;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(128, 0, 0);
    doc.text('Employment Summary Report', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Executive Summary & Interpretation', 14, currentY);
    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    
    const paragraphs = interpretation.split('\n\n');
    paragraphs.forEach((para: string) => {
      if (para.trim()) {
        const splitPara = doc.splitTextToSize(para.trim(), pageWidth - 28);
        doc.text(splitPara, 14, currentY);
        currentY += (splitPara.length * 4.5) + 5;
      }
    });
    currentY += 5;

    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Overall Summary', 14, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Total Alumni', 'Employed', 'Unemployed', 'Employment Rate', 'Alignment Rate']],
      body: [[
        stats.total.toString(),
        stats.employed.toString(),
        stats.unemployed.toString(),
        `${stats.employmentRate.toFixed(2)}%`,
        `${stats.alignmentRate.toFixed(2)}%`
      ]],
      theme: 'striped',
      headStyles: {
        fillColor: [128, 0, 0],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    if (currentY > 200) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Department Performance', 14, currentY);
    currentY += 5;

    const deptTableData = deptStats.map((dept: any) => [
      dept.department,
      dept.total.toString(),
      dept.employed.toString(),
      dept.unemployed.toString(),
      `${dept.employmentRate.toFixed(2)}%`,
      `${dept.alignmentRate.toFixed(2)}%`,
      dept.employmentRate >= 70 ? 'Good' : dept.employmentRate >= 50 ? 'Moderate' : 'Needs Improvement'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Department', 'Total', 'Employed', 'Unemployed', 'Employment Rate', 'Alignment Rate', 'Status']],
      body: deptTableData,
      theme: 'striped',
      headStyles: {
        fillColor: [128, 0, 0],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    if (insights && insights.length > 0) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Key Insights', 14, currentY);
      currentY += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      insights.forEach((insight: string) => {
        const splitInsight = doc.splitTextToSize(`• ${insight}`, pageWidth - 28);
        doc.text(splitInsight, 14, currentY);
        currentY += (splitInsight.length * 5) + 3;
      });
    }

    const totalPages = doc.internal.pages.length;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${totalPages} | Employment Summary Report | Generated: ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`Employment_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // ============================================================
  // EXPORT: Department Report (PDF)
  // ============================================================
  const exportDepartmentReport = async (department: string) => {
    setExportLoading(true);
    setExportType('department');

    try {
      let alumni: any[] = [];
      
      if (department !== 'all') {
        alumni = await fetchAllRows('alumni_profiles', `
          full_name,
          course,
          department,
          batch_year,
          employment_status,
          job_title,
          company,
          industry,
          location,
          linkedin_url,
          career_alignment_status,
          ai_confidence_score,
          profile_completion,
          created_at,
          updated_at
        `, { column: 'department', value: department });
      } else {
        alumni = await fetchAllRows('alumni_profiles', `
          full_name,
          course,
          department,
          batch_year,
          employment_status,
          job_title,
          company,
          industry,
          location,
          linkedin_url,
          career_alignment_status,
          ai_confidence_score,
          profile_completion,
          created_at,
          updated_at
        `);
      }

      const deptName = department === 'all' ? 'All Departments' : department;

      const total = alumni?.length || 0;
      const employed = alumni?.filter(a => a.employment_status === 'Employed').length || 0;
      const unemployed = alumni?.filter(a => a.employment_status === 'Unemployed').length || 0;
      const inField = alumni?.filter(a => a.career_alignment_status === 'In-Field').length || 0;
      const pending = alumni?.filter(a => 
        !a.career_alignment_status || 
        a.career_alignment_status === 'Pending' ||
        a.career_alignment_status === null
      ).length || 0;
      const employmentRate = total > 0 ? (employed / total) * 100 : 0;
      const alignmentRate = total > 0 ? (inField / total) * 100 : 0;
      const unemploymentRate = total > 0 ? (unemployed / total) * 100 : 0;

      const stats = { 
        alignmentRate, 
        unemploymentRate, 
        employmentRate,
        total,
        employed,
        unemployed,
        inField,
        outOfField: total - inField - pending,
        pending,
      };

      const allDeptData = await fetchAllRows('alumni_profiles', 'department, career_alignment_status, employment_status');

      const deptStats = allDeptData ? processDepartmentStatsForComparison(allDeptData) : [];

      const interpretation = generateInterpretation(stats, deptName, deptStats, alumni);

      const specDepartmentMap = new Map<string, { departments: Set<string>, count: number }>();
      
      alumni?.forEach(alum => {
        const spec = getSpecializationFromJobTitle(alum.job_title || '');
        const dept = alum.department || 'Unknown';
        
        if (!specDepartmentMap.has(spec)) {
          specDepartmentMap.set(spec, { departments: new Set(), count: 0 });
        }
        const entry = specDepartmentMap.get(spec)!;
        entry.departments.add(dept);
        entry.count += 1;
      });

      const specializationData = Array.from(specDepartmentMap.entries()).map(([spec, data]) => ({
        specialization: spec,
        department: Array.from(data.departments).join(', '),
        count: data.count,
      })).sort((a, b) => b.count - a.count);

      const recommendations: string[] = [];
      if (alignmentRate < 50) {
        recommendations.push(`Strengthen industry partnerships and develop targeted career guidance programs for ${deptName} students. Consider implementing a structured mentorship program with industry professionals.`);
      }
      if (unemploymentRate > 20) {
        recommendations.push(`Enhance job placement programs and career preparation services for ${deptName} graduates. Develop a comprehensive career development framework including interview skills, resume writing, and professional networking.`);
      }
      if (alignmentRate >= 70) {
        recommendations.push(`Share ${deptName}'s successful strategies with other departments. Document and disseminate best practices in curriculum design and industry engagement.`);
      }
      if (alignmentRate >= 50 && alignmentRate < 70) {
        recommendations.push(`Continue improving career alignment programs. Focus on strengthening internship opportunities and industry partnerships to increase field-related employment.`);
      }
      if (pending > 0) {
        recommendations.push(`Encourage ${pending} alumni to update their career alignment status. Consider implementing automated follow-up reminders and providing incentives for profile completion.`);
      }
      if (recommendations.length === 0) {
        recommendations.push('No specific recommendations at this time. Department is performing well. Continue monitoring key metrics and maintaining current successful strategies.');
      }

      generateDepartmentPDF({
        deptName: deptName,
        interpretation: interpretation,
        stats: {
          total,
          employed,
          unemployed,
          inField,
          outOfField: total - inField - pending,
          pending,
          employmentRate,
          alignmentRate,
          unemploymentRate,
        },
        specializationData,
        recommendations,
      });

      alert('PDF generated successfully!');

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export department report: ' + (error as Error).message);
    } finally {
      setExportLoading(false);
      setExportType(null);
      setShowExportModal(false);
    }
  };

  // Helper function to process department stats for comparison
  const processDepartmentStatsForComparison = (alumni: any[]) => {
    const deptMap = new Map<string, { alignmentRate: number, unemploymentRate: number }>();
    const departments = [...new Set(alumni.map(a => a.department).filter(Boolean))];

    departments.forEach(dept => {
      const deptAlumni = alumni.filter(a => a.department === dept);
      const total = deptAlumni.length;
      const inField = deptAlumni.filter(a => a.career_alignment_status === 'In-Field').length;
      const unemployed = deptAlumni.filter(a => a.employment_status === 'Unemployed').length;
      
      deptMap.set(dept, {
        alignmentRate: total > 0 ? (inField / total) * 100 : 0,
        unemploymentRate: total > 0 ? (unemployed / total) * 100 : 0,
      });
    });

    return Array.from(deptMap.entries()).map(([department, data]) => ({
      department,
      ...data,
    }));
  };

  // ============================================================
  // EXPORT: Employment Summary (PDF)
  // ============================================================
  const exportEmploymentSummary = async () => {
    setExportLoading(true);
    setExportType('employment');

    try {
      const alumni = await fetchAllRows('alumni_profiles', 'employment_status, department, batch_year, course, career_alignment_status');

      const total = alumni.length;
      const employed = alumni.filter(a => a.employment_status === 'Employed').length;
      const unemployed = alumni.filter(a => a.employment_status === 'Unemployed').length;
      const employmentRate = total > 0 ? ((employed / total) * 100) : 0;
      const unemploymentRate = total > 0 ? ((unemployed / total) * 100) : 0;

      const inField = alumni.filter(a => a.career_alignment_status === 'In-Field').length;
      const alignmentRate = total > 0 ? ((inField / total) * 100) : 0;

      const stats = { 
        alignmentRate, 
        unemploymentRate, 
        employmentRate,
        total,
        employed,
        unemployed,
        inField,
      };

      const deptStats = processDepartmentStatsForComparison(alumni);
      
      const interpretation = generateInterpretation(stats, 'Overall', deptStats, alumni);

      const departments = [...new Set(alumni.map(a => a.department).filter(Boolean))];
      const deptTableStats = departments.map(dept => {
        const deptAlumni = alumni.filter(a => a.department === dept);
        const deptTotal = deptAlumni.length;
        const deptEmployed = deptAlumni.filter(a => a.employment_status === 'Employed').length;
        const deptUnemployed = deptAlumni.filter(a => a.employment_status === 'Unemployed').length;
        const deptInField = deptAlumni.filter(a => a.career_alignment_status === 'In-Field').length;
        return {
          department: dept,
          total: deptTotal,
          employed: deptEmployed,
          unemployed: deptUnemployed,
          employmentRate: deptTotal > 0 ? ((deptEmployed / deptTotal) * 100) : 0,
          alignmentRate: deptTotal > 0 ? ((deptInField / deptTotal) * 100) : 0,
          unemploymentRate: deptTotal > 0 ? ((deptUnemployed / deptTotal) * 100) : 0,
        };
      });

      const insights = [];
      const bestDept = deptTableStats.reduce((best, current) =>
        current.alignmentRate > best.alignmentRate ? current : best
      );
      const worstDept = deptTableStats.reduce((worst, current) =>
        current.alignmentRate < worst.alignmentRate ? current : worst
      );

      insights.push(`${bestDept.department} has the highest alignment rate at ${bestDept.alignmentRate.toFixed(2)}%, indicating strong industry connections and effective career preparation.`);
      insights.push(`${worstDept.department} has the lowest alignment rate at ${worstDept.alignmentRate.toFixed(2)}%, suggesting a need for curriculum review and enhanced industry partnerships.`);
      
      if (worstDept.alignmentRate < 50) {
        insights.push(`STRATEGIC RECOMMENDATION: Strengthen industry partnerships and career guidance programs for ${worstDept.department} to improve career alignment outcomes.`);
      }

      const highestUnemployment = deptTableStats.reduce((highest, current) =>
        current.unemploymentRate > highest.unemploymentRate ? current : highest
      );
      if (highestUnemployment.unemploymentRate > 20) {
        insights.push(`STRATEGIC RECOMMENDATION: Enhance job placement programs and career preparation services for ${highestUnemployment.department} graduates.`);
      }

      const bestEmployment = deptTableStats.reduce((best, current) =>
        current.employmentRate > best.employmentRate ? current : best
      );
      insights.push(`${bestEmployment.department} has the highest employment rate at ${bestEmployment.employmentRate.toFixed(2)}%, demonstrating effective career preparation and strong employer relationships.`);

      generateEmploymentSummaryPDF({
        interpretation,
        stats: {
          total,
          employed,
          unemployed,
          employmentRate,
          alignmentRate,
        },
        deptStats: deptTableStats,
        insights,
      });

      alert('PDF generated successfully!');

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export employment summary: ' + (error as Error).message);
    } finally {
      setExportLoading(false);
      setExportType(null);
    }
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================
  const renderSpecializationChart = () => {
    if (!filteredData) return null;

    const departments = [...new Set(filteredData.specializationData.map(d => d.department))];

    const chartData = departments.map(dept => {
      const deptData = filteredData.specializationData.filter(d => d.department === dept);
      const total = deptData.reduce((sum, d) => sum + d.count, 0);
      const entry: any = { department: dept, total };
      deptData.forEach(d => {
        entry[d.specialization] = (entry[d.specialization] || 0) + d.count;
      });
      return entry;
    });

    const allSpecializations = [...new Set(filteredData.specializationData.map(d => d.specialization))];

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Specialization Distribution by Department
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Automatically derived from job titles of alumni
        </p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="department" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', border: 'none' }}
              />
              <Legend />
              {allSpecializations.map((spec, index) => (
                <Bar
                  key={spec}
                  dataKey={spec}
                  stackId="a"
                  fill={COLORS.chart[index % COLORS.chart.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Distribution of alumni specializations across departments (derived from job titles)
        </p>
      </div>
    );
  };

  const renderDepartmentMetrics = () => {
    if (!filteredData) return null;

    const chartData = filteredData.departmentMetrics.map(dept => ({
      department: dept.department,
      'Career Alignment': dept.alignmentRate,
      'Unemployment Rate': dept.unemploymentRate,
      'Institutional Alignment Avg': dept.institutionalAvgAlignment,
      'Institutional Unemployment Avg': dept.institutionalAvgUnemployment,
    }));

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Department Performance Metrics
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="department" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', border: 'none' }}
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
              <Legend />
              <Bar dataKey="Career Alignment" fill={COLORS.success} />
              <Bar dataKey="Unemployment Rate" fill={COLORS.danger} />
              <Line
                type="monotone"
                dataKey="Institutional Alignment Avg"
                stroke={COLORS.primary}
                strokeDasharray="5 5"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Institutional Unemployment Avg"
                stroke={COLORS.gray}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Department performance compared to institutional averages
        </p>
      </div>
    );
  };

  const renderOverallMetrics = () => {
    if (!filteredData) return null;

    const { overallMetrics } = filteredData;
    const pieData = [
      { name: 'In-Field', value: overallMetrics.totalInField },
      { name: 'Out-of-Field', value: overallMetrics.totalOutOfField },
      { name: 'Pending', value: overallMetrics.totalPending },
    ];

    const employmentData = [
      { name: 'Employed', value: overallMetrics.totalEmployed },
      { name: 'Unemployed', value: overallMetrics.totalUnemployed },
    ];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Career Alignment Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.pie[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Alumni</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {overallMetrics.totalAlumni}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Employment Rate</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {overallMetrics.overallEmploymentRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Alignment Rate</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {overallMetrics.overallAlignmentRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Employment Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={employmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill={COLORS.success} />
                  <Cell fill={COLORS.danger} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Unemployment Rate</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {overallMetrics.overallUnemploymentRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderInsights = () => {
    if (!filteredData || filteredData.insights.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <p className="text-gray-500 dark:text-gray-400 text-center">
            No insights generated yet.
          </p>
        </div>
      );
    }

    const getStatusColor = (type: string) => {
      switch (type) {
        case 'success': return 'border-green-500 bg-green-50 dark:bg-green-900/20';
        case 'warning': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
        case 'danger': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
        default: return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      }
    };

    const getIcon = (type: string) => {
      switch (type) {
        case 'success': return '✅';
        case 'warning': return '⚠️';
        case 'danger': return '🚨';
        default: return 'ℹ️';
      }
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>💡</span> Automated Insights & Recommendations
        </h3>
        <div className="space-y-4">
          {filteredData.insights.slice(0, 8).map((insight, index) => (
            <div
              key={index}
              className={`border-l-4 p-4 rounded-r-lg ${getStatusColor(insight.type)}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{getIcon(insight.type)}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {insight.message}
                  </p>
                  {insight.recommendation && (
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                      💡 {insight.recommendation}
                    </p>
                  )}
                  {insight.department && (
                    <span className="inline-block mt-2 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                      {insight.department}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDepartmentCards = () => {
    if (!filteredData) return null;

    const statusColors = {
      excellent: 'border-green-500 bg-green-50 dark:bg-green-900/20',
      good: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      needs_attention: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
      critical: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    };
    const statusLabels = {
      excellent: '🌟 Excellent',
      good: '👍 Good',
      needs_attention: '⚠️ Needs Attention',
      critical: '🚨 Critical',
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredData.departmentMetrics.map(dept => (
          <div
            key={dept.department}
            className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-l-4 p-4 ${statusColors[dept.status]}`}
          >
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-gray-900 dark:text-white">{dept.department}</h4>
              <button
                 
                className="text-xs bg-[#800000] text-white px-2 py-1 rounded hover:bg-[#a10000] transition"
              >
                DEPARTMENT
              </button>
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total Alumni</span>
                <span className="font-semibold">{dept.totalAlumni}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Career Alignment</span>
                <span className={`font-semibold ${dept.alignmentRate >= dept.institutionalAvgAlignment
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                  }`}>
                  {dept.alignmentRate.toFixed(1)}%
                  {dept.alignmentRate >= dept.institutionalAvgAlignment ? ' ↑' : ' ↓'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Unemployment</span>
                <span className={`font-semibold ${dept.unemploymentRate <= dept.institutionalAvgUnemployment
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                  }`}>
                  {dept.unemploymentRate.toFixed(1)}%
                  {dept.unemploymentRate <= dept.institutionalAvgUnemployment ? ' ✓' : ' ⚠️'}
                </span>
              </div>
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {statusLabels[dept.status]}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Export Modal
  const renderExportModal = () => {
    if (!showExportModal) return null;

    const departments = filteredData?.departmentMetrics.map(d => d.department) || [];

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Export Department Report (PDF)
            </h3>
            <button
              onClick={() => setShowExportModal(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              ✕
            </button>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Select a department to export its detailed PDF report with interpretations.
          </p>

          <div className="space-y-2">
            <button
              onClick={() => exportDepartmentReport('all')}
              disabled={exportLoading}
              className="w-full py-2 px-4 bg-[#800000] text-white rounded-lg hover:bg-[#a10000] transition flex items-center justify-between disabled:opacity-50"
            >
              <span>All Departments</span>
              <span className="text-xs opacity-75">Complete Report</span>
            </button>

            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => exportDepartmentReport(dept)}
                disabled={exportLoading}
                className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center justify-between disabled:opacity-50"
              >
                <span>{dept}</span>
                <span className="text-xs opacity-75">Export PDF</span>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Each export includes: Executive Summary with detailed interpretation based on actual data, Statistics, Specialization Distribution by Department, and Strategic Recommendations
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#800000] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => fetchAnalytics()}
            className="mt-4 px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-[#a10000] transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!filteredData) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            📊 Employment Summary Performance Dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Comprehensive analytics and insights for career tracking
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]"
          >
            <option value="all">All Departments</option>
            {fullData?.departmentMetrics.map(dept => (
              <option key={dept.department} value={dept.department}>
                {dept.department}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchAnalytics()}
            className="px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-[#a10000] transition text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Export Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setShowExportModal(true)}
          disabled={exportLoading}
          className="py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Export Department Report (PDF)
        </button>

        <button
          onClick={exportEmploymentSummary}
          disabled={exportLoading}
          className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {exportLoading && exportType === 'employment' ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Employment Summary (PDF)
            </>
          )}
        </button>
      </div>

      {/* Export Modal */}
      {renderExportModal()}

      {/* Overall Metrics */}
      {renderOverallMetrics()}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderSpecializationChart()}
        {renderDepartmentMetrics()}
      </div>

      {/* Department Performance Cards */}
      {renderDepartmentCards()}

      {/* Insights */}
      {renderInsights()}

      {/* Note */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <span>ℹ️</span>
          All exports are in PDF format with comprehensive executive summaries, detailed interpretations based on actual data, statistics, specialization distribution by department, and strategic recommendations.
        </p>
      </div>
    </div>
  );
}
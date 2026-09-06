// src/components/PredictionDashboard.tsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { PredictionInsightRequest } from './lib/gemini';
import { getPredictionInsights, isRealIndustry, generateImprovedFallback } from './lib/gemini';
import { classifyCareerAlignmentSync } from './lib/careerClassifier';

interface PredictionDashboardProps {
  alumni: any[];
  departmentStats: any[];
  selectedDepartment?: string;
}

// Department logos from public folder with department-specific colors
const DEPARTMENTS = [
  { 
    code: 'CCS', 
    name: 'Computer Studies', 
    color: '#4b1503',
    bgColor: '#4b1503',
    textColor: '#ffffff',
    logo: '/images/departments/ccs-logo.png',
    fullName: 'College of Computer Studies'
  },
  { 
    code: 'CTE', 
    name: 'Teacher Education', 
    color: '#00bbf9',
    bgColor: '#00bbf9',
    textColor: '#ffffff',
    logo: '/images/departments/cte-logo.png',
    fullName: 'College of Teacher Education'
  },
  { 
    code: 'CCJE', 
    name: 'Criminal Justice', 
    color: '#09ce03',
    bgColor: '#09ce03',
    textColor: '#ffffff',
    logo: '/images/departments/ccje-logo.png',
    fullName: 'Criminal Justice Education'
  },
  { 
    code: 'CBE', 
    name: 'Business Education', 
    color: '#ffee00',
    bgColor: '#ffee00',
    textColor: '#000000',
    logo: '/images/departments/cbe-logo.png',
    fullName: 'College of Business Education'
  },
  { 
    code: 'PSY', 
    name: 'Psychology', 
    color: '#ff8800',
    bgColor: '#ff8800',
    textColor: '#ffffff',
    logo: '/images/departments/psych-logo.png',
    fullName: 'Psychology Program'
  },
];

type TabKey = 'workforce' | 'industry' | 'health';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'workforce', label: 'Workforce' },
  { key: 'industry', label: 'Industry Demand' },
  { key: 'health', label: 'Department Health' },
];

const INDUSTRY_READINESS_TARGET = 80;
const MIN_BATCH_SAMPLE_SIZE = 3;
const SMALL_SAMPLE_THRESHOLD = 10;
const CURRENT_CALENDAR_YEAR = new Date().getFullYear();
const MIN_PLAUSIBLE_BATCH_YEAR = CURRENT_CALENDAR_YEAR - 60;
const MAX_PLAUSIBLE_BATCH_YEAR = CURRENT_CALENDAR_YEAR + 3;

function toBatchYear(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value) && value >= MIN_PLAUSIBLE_BATCH_YEAR && value <= MAX_PLAUSIBLE_BATCH_YEAR) {
      return value;
    }
    return null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    if (Number.isFinite(n) && Number.isInteger(n) && n >= MIN_PLAUSIBLE_BATCH_YEAR && n <= MAX_PLAUSIBLE_BATCH_YEAR) {
      return n;
    }
  }
  return null;
}

function normalizeStatus(value: any): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

const isEmployed = (a: any): boolean => normalizeStatus(a?.employment_status) === 'employed';
const isInField = (a: any): boolean => {
  let s = normalizeStatus(a?.career_alignment_status);
  if ((!s || s === 'pending') && a?.job_title && a.job_title.trim() !== '') {
    const syncResult = classifyCareerAlignmentSync(a?.course || '', a.job_title);
    s = normalizeStatus(syncResult.alignment_status);
  }
  return s === 'in-field' || s === 'in field' || s === 'infield';
};

const normalizedDept = (a: any): string =>
  typeof a?.department === 'string' ? a.department.trim().toUpperCase() : '';

const round1 = (n: number): number => Math.round(n * 10) / 10;

function classifyHealth(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Needs Improvement';
}

const healthColor = (score: number): string => {
  if (score >= 80) return '#10b981';
  if (score >= 70) return '#3b82f6';
  if (score >= 60) return '#f59e0b';
  if (score >= 50) return '#f97316';
  return '#ef4444';
};

type DemandLabel = 'High Demand' | 'Moderate Demand' | 'Low Demand';
const classifyDemand = (score: number): DemandLabel => {
  if (score >= 70) return 'High Demand';
  if (score >= 40) return 'Moderate Demand';
  return 'Low Demand';
};

type Confidence = 'High' | 'Moderate' | 'Low';
function classifyConfidence(usableBatchCount: number, r2: number): Confidence {
  if (usableBatchCount >= 4 && r2 >= 0.5) return 'High';
  if (usableBatchCount >= 3 && r2 >= 0.3) return 'Moderate';
  return 'Low';
}

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } | null {
  const n = x.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    sumX += xi;
    sumY += yi;
    sumXY += xi * yi;
    sumX2 += xi * xi;
  }
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * x[i] + intercept;
    ssTot += (y[i] - meanY) ** 2;
    ssRes += (y[i] - predicted) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 1;
  return { slope, intercept, r2 };
}

interface IndustryRow {
  industry: string;
  count: number;
  employmentRate: number;
  demandScore: number;
  demandLabel: DemandLabel;
  shareOfDept: number;
}

interface DeptMetrics {
  code: string;
  name: string;
  fullName: string;
  color: string;
  total: number;
  employed: number;
  inField: number;
  employmentRate: number;
  alignmentRate: number;
  demandScore: number;
  healthScore: number;
  batchCount: number;
  usableBatchCount: number;
  projection: number | null;
  growth: number | null;
  confidence: Confidence | null;
  isSmallSample: boolean;
  industries: IndustryRow[];
  supply: number;
  demand: number;
  gap: number;
  latestBatch: number | null;
  targetBatch: number | null;
  trendDescription: string;
}

function computeIndustries(deptAlumni: any[]): IndustryRow[] {
  const groups = new Map<string, any[]>();
  deptAlumni.forEach((a) => {
    const rawKey = typeof a?.industry === 'string' ? a.industry.trim() : '';
    const key = isRealIndustry(rawKey) ? rawKey : 'Unspecified';
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    bucket.push(a);
  });

  const total = deptAlumni.length;
  return Array.from(groups.entries())
    .map(([industry, records]) => {
      const employed = records.filter(isEmployed).length;
      const employmentRate = records.length > 0 ? round1((employed / records.length) * 100) : 0;
      const demandScore = round1(employmentRate * 0.6 + 0.4);
      return {
        industry,
        count: records.length,
        employmentRate,
        demandScore,
        demandLabel: classifyDemand(demandScore),
        shareOfDept: total > 0 ? round1((records.length / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function computeDeptMetrics(deptAlumni: any[], dept: typeof DEPARTMENTS[0], targetBatch: number | null, latestBatch: number | null): DeptMetrics {
  const total = deptAlumni.length;
  const employed = deptAlumni.filter(isEmployed).length;
  const inField = deptAlumni.filter(isInField).length;
  const employmentRate = total > 0 ? round1((employed / total) * 100) : 0;
  const alignmentRate = total > 0 ? round1((inField / total) * 100) : 0;
  const demandScore = round1(employmentRate * 0.6 + alignmentRate * 0.4);
  const healthScore = round1((employmentRate + alignmentRate) / 2);

  const batchGroups = new Map<number, any[]>();
  deptAlumni.forEach((a) => {
    const year = toBatchYear(a?.batch_year);
    if (year === null) return;
    let bucket = batchGroups.get(year);
    if (!bucket) {
      bucket = [];
      batchGroups.set(year, bucket);
    }
    bucket.push(a);
  });

  const allBatchYears = Array.from(batchGroups.keys()).sort((a, b) => a - b);
  const usableBatchYears = allBatchYears.filter((year) => (batchGroups.get(year)?.length ?? 0) >= MIN_BATCH_SAMPLE_SIZE);

  let projection: number | null = null;
  let growth: number | null = null;
  let confidence: Confidence | null = null;
  let slope = 0;

  if (targetBatch !== null && usableBatchYears.length >= 2) {
    const rates = usableBatchYears.map((year) => {
      const batchAlumni = batchGroups.get(year) ?? [];
      return batchAlumni.length > 0 ? (batchAlumni.filter(isInField).length / batchAlumni.length) * 100 : 0;
    });
    const regression = linearRegression(usableBatchYears, rates);
    if (regression) {
      slope = regression.slope;
      const predicted = regression.slope * targetBatch + regression.intercept;
      projection = round1(Math.max(0, Math.min(100, predicted)));
      growth = round1(projection - alignmentRate);
      confidence = classifyConfidence(usableBatchYears.length, regression.r2);
    }
  }

  let trendDescription = 'stable';
  if (slope > 1) trendDescription = 'improving';
  else if (slope > 2) trendDescription = 'strongly improving';
  else if (slope < -1) trendDescription = 'declining';
  else if (slope < -2) trendDescription = 'strongly declining';

  const industries = computeIndustries(deptAlumni);
  const supply = total;
  const demand = Math.round(total * (demandScore / 100) * 1.1);

  return {
    code: dept.code,
    name: dept.name,
    fullName: dept.fullName,
    color: dept.color,
    total,
    employed,
    inField,
    employmentRate,
    alignmentRate,
    demandScore,
    healthScore,
    batchCount: allBatchYears.length,
    usableBatchCount: usableBatchYears.length,
    projection,
    growth,
    confidence,
    isSmallSample: total > 0 && total < SMALL_SAMPLE_THRESHOLD,
    industries,
    supply,
    demand,
    gap: demand - supply,
    latestBatch,
    targetBatch,
    trendDescription,
  };
}

function generateProjectionInsight(metrics: DeptMetrics): string {
  const { name, total, alignmentRate, projection, growth, gap, targetBatch, latestBatch, batchCount, usableBatchCount } = metrics;
  if (total === 0) return `No alumni records available for ${name}.`;
  if (targetBatch === null || latestBatch === null) return 'Batch data unavailable. Add batch_year to records.';
  if (batchCount === 0) return `No batch-year data for ${name}. Add batch_year to enable projection.`;

  if (batchCount === 1) {
    const projectedRate = alignmentRate;
    const estimatedGap = Math.round(total * (alignmentRate / 100) * 1.1 - total);
    let base = `Based on Batch ${latestBatch} (${total} alumni, ${alignmentRate}% aligned), Batch ${targetBatch} requires ${projectedRate}% alignment.`;
    if (estimatedGap > 0) base += ` ${estimatedGap} additional graduates are needed for Batch ${targetBatch}.`;
    else if (estimatedGap < 0) base += ` Current graduate supply is sufficient for estimated demand.`;
    else base += ` Graduate supply and workforce demand are balanced.`;
    if (alignmentRate < 50) base += ` Low current alignment suggests program review is needed for Batch ${targetBatch}.`;
    else if (alignmentRate < 70) base += ` Moderate alignment indicates opportunity for improvement for Batch ${targetBatch}.`;
    else base += ` Strong alignment suggests maintaining current strategies for Batch ${targetBatch}.`;
    if (total < SMALL_SAMPLE_THRESHOLD) base += ` Small sample size (${total} alumni) limits statistical significance.`;
    return base;
  }
  if (usableBatchCount < 2) return `Insufficient batch data for ${name}. Current alignment: ${alignmentRate}%. Encourage more alumni to complete profiles.`;
  if (projection === null || growth === null || metrics.confidence === null) return `Insufficient historical data for Batch ${targetBatch} projection.`;

  const trend = growth > 0 ? 'improving' : growth < 0 ? 'declining' : 'stable';
  const absGrowth = Math.abs(growth);
  let base = `Based on Batch ${latestBatch} graduates, Batch ${targetBatch} alignment is ${trend}.`;
  base += ` Projected alignment: ${projection}% (${growth > 0 ? '+' : ''}${absGrowth}% from current ${alignmentRate}%).`;
  if (gap > 0) base += ` ${gap} additional graduates are needed for Batch ${targetBatch}.`;
  else if (gap < 0) base += ` Graduate supply meets estimated demand.`;
  else base += ` Graduate supply and demand are balanced.`;
  if (growth < -10) base += ' Urgent intervention is recommended to address declining alignment.';
  else if (growth < -5) base += ' Declining trend detected. Monitor curriculum and employer engagement.';
  else if (growth > 5) base += ' Positive trend observed. Continue current strategies.';
  return base;
}

function generateWorkforceInsight(metrics: DeptMetrics): string {
  const { industries, gap, targetBatch, latestBatch, code } = metrics;
  const realIndustries = industries.filter(i => isRealIndustry(i.industry));
  const lead = realIndustries[0];
  if (!lead) return `No specified employment industry sector data available for ${code}. Status/industry information is pending or unspecified.`;
  const batchLabel = targetBatch !== null ? `Batch ${targetBatch}` : 'Next batch';
  const fromLabel = latestBatch !== null ? `Batch ${latestBatch}` : 'previous';
  let base = `Based on ${fromLabel} data, ${lead.industry} shows ${lead.demandLabel.toLowerCase()} (${lead.demandScore}%). ${lead.shareOfDept}% of ${code} graduates are employed in this sector.`;
  if (lead.demandLabel === 'High Demand' && gap > 0) base += ` Additional ${code} graduates are needed for ${batchLabel}.`;
  else if (lead.demandLabel === 'High Demand' && gap <= 0) base += ` Current ${code} graduate supply meets demand for ${batchLabel}.`;
  else if (lead.demandLabel === 'Moderate Demand') base += ` Steady demand is expected for ${batchLabel}. Monitor trends.`;
  else base += ` Program diversification for ${batchLabel} may be beneficial.`;
  if (lead.demandLabel === 'High Demand' && gap > 5) base += ` Consider increasing ${code} enrollment by ${Math.min(gap + 5, 20)} students.`;
  else if (lead.demandLabel === 'Low Demand') base += ` Review ${code} curriculum for ${batchLabel}.`;
  return base;
}

function generateIndustryInsight(metrics: DeptMetrics): string {
  const { code, industries } = metrics;
  const realIndustries = industries.filter(i => isRealIndustry(i.industry));
  if (realIndustries.length === 0) return `No specified industry sector data available for ${code}.`;
  const top = realIndustries[0];
  let base = `${code} graduates show ${top.demandLabel.toLowerCase()} demand.`;
  if (top.shareOfDept >= 40) base += ` ${top.industry} employs ${top.shareOfDept}% of ${code} graduates.`;
  else if (realIndustries.length >= 3) base += ` Employment is distributed across ${realIndustries.length} industry sectors.`;
  else base += ` ${top.industry} is the primary employer (${top.shareOfDept}%).`;
  const highDemand = realIndustries.filter(i => i.demandLabel === 'High Demand');
  const lowDemand = realIndustries.filter(i => i.demandLabel === 'Low Demand');
  if (highDemand.length > 0) base += ` High demand sectors: ${highDemand.map(i => i.industry).join(', ')}.`;
  if (lowDemand.length > 0) base += ` Low demand sectors: ${lowDemand.map(i => i.industry).join(', ')}.`;
  if (highDemand.length >= 2) base += ` Graduates are in strong demand across ${highDemand.length} sectors.`;
  else if (highDemand.length === 1) base += ` Graduates are in demand in ${highDemand[0].industry}.`;
  return base;
}

function generateHealthInsight(metrics: DeptMetrics): string {
  const { code, healthScore, employmentRate, alignmentRate, total, targetBatch, latestBatch } = metrics;
  if (total === 0) return `No alumni data available for ${code}.`;
  const batchLabel = targetBatch !== null ? ` Batch ${targetBatch}` : ' next batch';
  const fromLabel = latestBatch !== null ? `Batch ${latestBatch}` : 'current';
  const status = classifyHealth(healthScore);
  let base = `Based on ${fromLabel} data, ${code} health score is ${healthScore}% (${status}).`;
  if (employmentRate >= 80) base += ` Employment (${employmentRate}%) is excellent.`;
  else if (employmentRate >= 70) base += ` Employment (${employmentRate}%) is good.`;
  else if (employmentRate >= 60) base += ` Employment (${employmentRate}%) is fair.`;
  else base += ` Employment (${employmentRate}%) requires improvement.`;
  if (alignmentRate >= 80) base += ` Alignment (${alignmentRate}%) is excellent.`;
  else if (alignmentRate >= 70) base += ` Alignment (${alignmentRate}%) is good.`;
  else if (alignmentRate >= 60) base += ` Alignment (${alignmentRate}%) is fair.`;
  else base += ` Alignment (${alignmentRate}%) requires improvement.`;
  if (employmentRate < 70 && alignmentRate < 70) base += ` Both employment and alignment need attention for${batchLabel}.`;
  else if (employmentRate < 70) base += ` Focus on improving job placement for${batchLabel}.`;
  else if (alignmentRate < 70) base += ` Focus on curriculum alignment for${batchLabel}.`;
  else base += ` Department is healthy. Maintain current strategies for${batchLabel}.`;
  return base;
}

function generateProductivityInsight(metrics: DeptMetrics): string {
  const { code, total, inField, alignmentRate, targetBatch, latestBatch } = metrics;
  if (total === 0) return `No alumni data available for ${code}.`;
  const batchLabel = targetBatch !== null ? `Batch ${targetBatch}` : 'Next batch';
  const fromLabel = latestBatch !== null ? `Batch ${latestBatch}` : 'current';
  let base = `Based on ${fromLabel} data, ${inField} of ${total} ${code} graduates (${alignmentRate}%) are industry-ready for ${batchLabel}.`;
  if (alignmentRate >= 80) base += ` Excellent. Graduates are in strong demand.`;
  else if (alignmentRate >= 70) base += ` Good. Graduates are in demand.`;
  else if (alignmentRate >= 60) base += ` Moderate. Can improve to reach 80% target.`;
  else base += ` Needs improvement. Review curriculum and career services.`;
  if (alignmentRate < INDUSTRY_READINESS_TARGET) {
    const neededInField = Math.ceil((INDUSTRY_READINESS_TARGET / 100) * total);
    const shortfall = Math.max(0, neededInField - inField);
    base += ` ${shortfall} additional graduates needed for ${batchLabel} to reach ${INDUSTRY_READINESS_TARGET}% target.`;
  }
  if (alignmentRate >= 70) base += ` ${code} productivity is good.`;
  else if (alignmentRate >= 50) base += ` ${code} productivity is moderate.`;
  else base += ` ${code} productivity needs attention.`;
  return base;
}

const SummaryCard = React.memo(function SummaryCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  );
});

const MetricCard = React.memo(function MetricCard({ 
  label, 
  value, 
  sublabel,
  onAudit
}: { 
  label: string; 
  value: string; 
  sublabel?: string;
  onAudit?: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 relative group hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {onAudit && (
          <button
            type="button"
            onClick={onAudit}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 transition-all flex items-center gap-1 cursor-pointer"
            title="Click to view calculation breakdown and formula"
          >
            <span>🧮 Formula</span>
          </button>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  );
});

const ProgressBar = React.memo(function ProgressBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${clamped}%`, backgroundColor: color }} />
    </div>
  );
});

const StatusBadge = React.memo(function StatusBadge({ label, type }: { label: string; type?: 'success' | 'warning' | 'error' | 'info' }) {
  const styles = {
    success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[type || 'info']}`}>
      {label}
    </span>
  );
});

export interface CalculationAuditPayload {
  title: string;
  metricName: string;
  value: string;
  formula: string;
  steps: { label: string; value: string }[];
  explanation: string;
  badgeText?: string;
}

function getHealthScoreAudit(metrics: DeptMetrics): CalculationAuditPayload {
  return {
    title: 'Department Health Score Audit',
    metricName: `${metrics.code} (${metrics.fullName || metrics.name}) Health Score`,
    value: `${metrics.healthScore}%`,
    badgeText: 'Program Health Score',
    formula: 'Health Score = (Employment Rate + In-Field Career Alignment Rate) ÷ 2',
    steps: [
      { label: 'Total Department Alumni Sample', value: `${metrics.total} graduates` },
      { label: 'Employed Alumni Count', value: `${metrics.employed} (${metrics.employmentRate}%)` },
      { label: 'In-Field Aligned Graduates', value: `${metrics.inField} (${metrics.alignmentRate}%)` },
      { label: 'Step 1: Calculate Employment Rate', value: `(${metrics.employed} / ${metrics.total}) × 100 = ${metrics.employmentRate}%` },
      { label: 'Step 2: Calculate Alignment Rate', value: `(${metrics.inField} / ${metrics.total}) × 100 = ${metrics.alignmentRate}%` },
      { label: 'Step 3: Average Both Indicators', value: `(${metrics.employmentRate}% + ${metrics.alignmentRate}%) ÷ 2 = ${metrics.healthScore}%` }
    ],
    explanation: 'The Department Health Score evaluates overall program vitality by giving equal weight (50% each) to job market absorption (employment rate) and educational relevance (in-field career alignment rate).'
  };
}

function getEmploymentRateAudit(metrics: DeptMetrics): CalculationAuditPayload {
  const unemployed = Math.max(0, metrics.total - metrics.employed);
  const ratio = metrics.total > 0 ? metrics.employed / metrics.total : 0;
  return {
    title: 'Employment Rate Calculation Audit',
    metricName: `${metrics.code} Employment Absorption`,
    value: `${metrics.employmentRate}%`,
    badgeText: 'Graduate Employment Rate',
    formula: 'Employment Rate = (Employed Graduates ÷ Total Alumni Sample) × 100',
    steps: [
      { label: 'Total Alumni Graduates Sample', value: `${metrics.total} graduates` },
      { label: 'Employed Alumni Headcount', value: `${metrics.employed} graduates` },
      { label: 'Unemployed / Unspecified / Seeking', value: `${unemployed} graduates` },
      { label: 'Calculation Ratio', value: `${metrics.employed} ÷ ${metrics.total} = ${ratio.toFixed(4)}` },
      { label: 'Percentage Conversion', value: `${ratio.toFixed(4)} × 100 = ${metrics.employmentRate}%` }
    ],
    explanation: 'Measures the proportion of department graduates who are currently employed across all registered industry sectors.'
  };
}

function getAlignmentRateAudit(metrics: DeptMetrics): CalculationAuditPayload {
  const outOfField = Math.max(0, metrics.employed - metrics.inField);
  const ratio = metrics.total > 0 ? metrics.inField / metrics.total : 0;
  return {
    title: 'In-Field Alignment Calculation Audit',
    metricName: `${metrics.code} Career Alignment Rate`,
    value: `${metrics.alignmentRate}%`,
    badgeText: 'Degree Alignment Rate',
    formula: 'Alignment Rate = (In-Field Employed Graduates ÷ Total Alumni Sample) × 100',
    steps: [
      { label: 'Total Department Alumni Sample', value: `${metrics.total} graduates` },
      { label: 'In-Field Employed Graduates', value: `${metrics.inField} graduates` },
      { label: 'Out-of-Field / Unaligned Employed', value: `${outOfField} graduates` },
      { label: 'Calculation Ratio', value: `${metrics.inField} ÷ ${metrics.total} = ${ratio.toFixed(4)}` },
      { label: 'Percentage Conversion', value: `${ratio.toFixed(4)} × 100 = ${metrics.alignmentRate}%` }
    ],
    explanation: 'Measures degree relevance by identifying graduates working in positions directly related to their academic field of study.'
  };
}

function getDemandScoreAudit(metrics: DeptMetrics): CalculationAuditPayload {
  const empComp = (metrics.employmentRate * 0.60).toFixed(1);
  const alignComp = (metrics.alignmentRate * 0.40).toFixed(1);
  return {
    title: 'Regional Market Demand Score Audit',
    metricName: `${metrics.code} Labor Demand Index`,
    value: `${metrics.demandScore}%`,
    badgeText: 'Industry Demand Score',
    formula: 'Demand Score = (Employment Rate × 0.60) + (Career Alignment Rate × 0.40)',
    steps: [
      { label: 'Employment Rate Component (60% Weight)', value: `${metrics.employmentRate}% × 0.60 = ${empComp}%` },
      { label: 'Alignment Rate Component (40% Weight)', value: `${metrics.alignmentRate}% × 0.40 = ${alignComp}%` },
      { label: 'Combined Demand Index', value: `${empComp}% + ${alignComp}% = ${metrics.demandScore}%` }
    ],
    explanation: 'Quantifies regional employer demand by placing 60% weight on general employment absorption and 40% weight on degree-matched field alignment.'
  };
}

function getWorkforceVolumeAudit(metrics: DeptMetrics): CalculationAuditPayload {
  const baseDemand = (metrics.total * (metrics.demandScore / 100)).toFixed(1);
  return {
    title: 'Workforce Headcount Demand Audit',
    metricName: `${metrics.code} Headcount Demand Index`,
    value: `Demand: ${metrics.demand} (Total Alumni: ${metrics.total})`,
    badgeText: `Net Gap: ${metrics.gap > 0 ? '+' : ''}${metrics.gap} Graduates`,
    formula: 'Demand Headcount = Math.round(Total Alumni × (Demand Score / 100) × 1.10 Market Buffer)',
    steps: [
      { label: 'Total Department Alumni', value: `${metrics.total} graduates` },
      { label: 'Market Demand Score Index', value: `${metrics.demandScore}%` },
      { label: 'Base Absorbed Demand', value: `${metrics.total} × (${metrics.demandScore} / 100) = ${baseDemand}` },
      { label: 'Market Vacancy & Growth Buffer', value: `× 1.10 (+10% market buffer for open positions)` },
      { label: 'Final Computed Industry Demand Volume', value: `Math.round(${baseDemand} × 1.10) = ${metrics.demand} graduates` },
      { label: 'Net Workforce Gap', value: `${metrics.demand} (Demand) - ${metrics.total} (Total Alumni) = ${metrics.gap > 0 ? '+' : ''}${metrics.gap}` }
    ],
    explanation: 'Computes total graduate headcount required by local industry sectors, incorporating a 10% market expansion buffer for job vacancies.'
  };
}

function getSectorShareAudit(metrics: DeptMetrics, sector: IndustryRow): CalculationAuditPayload {
  const ratio = metrics.total > 0 ? sector.count / metrics.total : 0;
  return {
    title: 'Industry Sector Concentration Audit',
    metricName: `${sector.industry} Department Share`,
    value: `${sector.shareOfDept}%`,
    badgeText: 'Sector Concentration Rate',
    formula: 'Concentration Rate = (Sector Employed Alumni ÷ Department Total Alumni) × 100',
    steps: [
      { label: 'Alumni Employed in Sector', value: `${sector.count} graduates` },
      { label: 'Total Department Graduates', value: `${metrics.total} graduates` },
      { label: 'Calculation Ratio', value: `${sector.count} ÷ ${metrics.total} = ${ratio.toFixed(4)}` },
      { label: 'Percentage Share', value: `${ratio.toFixed(4)} × 100 = ${sector.shareOfDept}%` }
    ],
    explanation: 'Indicates what percentage of the department\'s total alumni workforce is concentrated within this specific industry sector.'
  };
}

function getSectorDemandAudit(_metrics: DeptMetrics, sector: IndustryRow): CalculationAuditPayload {
  const empComp = (sector.employmentRate * 0.60).toFixed(1);
  return {
    title: 'Sector Demand Score Audit',
    metricName: `${sector.industry} Sector Demand Score`,
    value: `${sector.demandScore}% (${sector.demandLabel})`,
    badgeText: 'Sector Demand Index',
    formula: 'Sector Demand Score = (Sector Employment Rate × 0.60) + 0.40 Base Weight',
    steps: [
      { label: 'Sector Graduates Headcount', value: `${sector.count} graduates` },
      { label: 'Sector Employment Rate', value: `${sector.employmentRate}%` },
      { label: 'Weighted Component (60%)', value: `${sector.employmentRate}% × 0.60 = ${empComp}%` },
      { label: 'Baseline Weight Factor', value: `0.40` },
      { label: 'Combined Sector Demand Index', value: `${empComp} + 0.40 = ${sector.demandScore}%` }
    ],
    explanation: 'Evaluates employer hiring density and employment stability within this specific industry segment.'
  };
}

function getProjectionAudit(metrics: DeptMetrics): CalculationAuditPayload {
  return {
    title: 'Batch Forecast Linear Regression Audit',
    metricName: `Batch ${metrics.targetBatch || 'Next'} Projection Forecast`,
    value: `${metrics.projection !== null ? metrics.projection + '%' : 'N/A'}`,
    badgeText: 'Projected Alignment Rate',
    formula: 'Linear Regression: y = slope · TargetBatch + intercept (fitted on historical batch rates)',
    steps: [
      { label: 'Historical Batches Analyzed', value: `${metrics.batchCount} batch years` },
      { label: 'Current Batch Alignment Rate', value: `${metrics.alignmentRate}%` },
      { label: 'Target Batch Forecasted Rate', value: `${metrics.projection !== null ? metrics.projection + '%' : 'N/A'}` },
      { label: 'Forecasted Alignment Delta', value: `${metrics.growth !== null ? (metrics.growth > 0 ? '+' : '') + metrics.growth + '%' : 'N/A'}` },
      { label: 'Statistical Confidence Rating', value: `${metrics.confidence || 'Low'}` }
    ],
    explanation: 'Uses linear regression trends on historical batch alignment data to project career alignment rates for upcoming graduating batches.'
  };
}

const CalculationAuditModal = React.memo(function CalculationAuditModal({
  auditData,
  onClose,
}: {
  auditData: CalculationAuditPayload | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!auditData) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-purple-900/10 via-indigo-900/5 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-700 dark:text-purple-300 text-lg">
              🧮
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                {auditData.title}
              </h3>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                {auditData.metricName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
            title="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-2xl bg-purple-50 dark:bg-purple-950/40 p-4 border border-purple-100 dark:border-purple-900/40 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              {auditData.badgeText || 'Final Computed Result'}
            </span>
            <span className="text-2xl font-extrabold text-purple-900 dark:text-purple-100">
              {auditData.value}
            </span>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              📐 Mathematical Formula
            </p>
            <div className="p-3.5 rounded-xl bg-gray-900 text-purple-200 font-mono text-xs font-semibold leading-relaxed border border-gray-800 shadow-inner">
              {auditData.formula}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
              🔍 Calculation Steps & Data Inputs
            </p>
            <div className="space-y-2">
              {auditData.steps.map((step, idx) => (
                <div key={idx} className="flex items-start justify-between text-xs p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                  <span className="font-medium text-gray-600 dark:text-gray-300 pr-2">
                    {step.label}
                  </span>
                  <span className="font-mono font-bold text-purple-700 dark:text-purple-300 text-right whitespace-nowrap">
                    {step.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            💡 <strong>Institutional Note:</strong> {auditData.explanation}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
});

const DepartmentCard = React.memo(function DepartmentCard({
  metrics,
  isSelected,
  onSelect,
  onAuditHealth,
}: {
  metrics: DeptMetrics;
  isSelected: boolean;
  onSelect: () => void;
  onAuditHealth?: () => void;
}) {
  const healthClass = classifyHealth(metrics.healthScore);
  const healthColorValue = healthColor(metrics.healthScore);
  const deptConfig = DEPARTMENTS.find(d => d.code === metrics.code);
  const [imgError, setImgError] = useState(false);

  const cardBgColor = deptConfig?.bgColor || '#7C2D12';
  const isCBE = deptConfig?.code === 'CBE';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-2xl p-6 border-2 transition-all duration-300 ease-in-out w-full ${
        isSelected
          ? 'shadow-xl ring-2 ring-offset-2 ring-white/30 scale-[1.02]'
          : 'border-transparent hover:shadow-xl hover:scale-[1.01]'
      }`}
      style={{
        backgroundColor: cardBgColor,
        borderColor: isSelected ? 'rgba(255,255,255,0.3)' : 'transparent',
        minHeight: '300px',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="flex flex-col items-center text-center">
        {deptConfig?.logo && !imgError ? (
          <img 
            src={deptConfig.logo} 
            alt={`${metrics.name} logo`}
            className="w-32 h-32 object-contain mb-4 drop-shadow-lg"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div 
            className="w-32 h-32 rounded-2xl flex items-center justify-center text-6xl font-bold mb-4"
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.12)',
              color: isCBE ? '#000000' : '#ffffff',
              backdropFilter: 'blur(4px)',
              textShadow: isCBE ? 'none' : '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            {metrics.code}
          </div>
        )}
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: isCBE ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>
          {metrics.code}
        </p>
        <p className="text-sm font-bold leading-tight px-1" style={{ color: isCBE ? '#000000' : '#ffffff' }}>
          {metrics.fullName || metrics.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: isCBE ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}>
          {metrics.total} alumni
        </p>
      </div>

      <div className="mt-4 pt-3 border-t" style={{ borderColor: isCBE ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <span style={{ color: isCBE ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>Health Score</span>
            {onAuditHealth && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAuditHealth();
                }}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/40 text-current transition-all cursor-pointer"
                title="View Health Score calculation formula"
              >
                🧮
              </button>
            )}
          </div>
          <span className="font-bold text-xl" style={{ color: isCBE ? '#000000' : '#ffffff' }}>
            {metrics.healthScore}%
          </span>
        </div>
        <div className="mt-1.5">
          <ProgressBar value={metrics.healthScore} color={healthColorValue} />
        </div>
        <p className="text-xs mt-1.5 text-center font-medium" style={{ color: isCBE ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }}>
          {healthClass}
        </p>
      </div>

      {isSelected && (
        <div className="mt-3 pt-2 border-t flex justify-center" style={{ borderColor: isCBE ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
          <span className="text-[10px] font-medium tracking-wider" style={{ color: isCBE ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}>
            ● SELECTED
          </span>
        </div>
      )}
    </button>
  );
});

const WorkforceTab = React.memo(function WorkforceTab({ 
  metrics, 
  aiInsights, 
  aiLoading,
  onOpenAudit 
}: { 
  metrics: DeptMetrics; 
  aiInsights: any; 
  aiLoading: boolean;
  onOpenAudit?: (payload: CalculationAuditPayload) => void;
}) {
  const insight = useMemo(() => generateWorkforceInsight(metrics), [metrics]);
  const projectionInsight = useMemo(() => generateProjectionInsight(metrics), [metrics]);

  const realIndustries = useMemo(() => metrics.industries.filter(i => isRealIndustry(i.industry)), [metrics.industries]);
  const topValid = realIndustries[0];
  const topIndustriesList = useMemo(() => realIndustries.slice(0, 3).map(i => ({
    name: i.industry,
    count: i.count,
    share: i.shareOfDept
  })), [realIndustries]);

  const fallbackAI = useMemo(() => generateImprovedFallback({
    department: metrics.code,
    departmentName: metrics.fullName,
    totalAlumni: metrics.total,
    employedCount: metrics.employed,
    inFieldCount: metrics.inField,
    outOfFieldCount: Math.max(0, metrics.employed - metrics.inField),
    employmentRate: metrics.employmentRate,
    alignmentRate: metrics.alignmentRate,
    healthScore: metrics.healthScore,
    demandScore: metrics.demandScore,
    projection: metrics.projection,
    growth: metrics.growth,
    gap: metrics.gap,
    targetBatch: metrics.targetBatch,
    latestBatch: metrics.latestBatch,
    topIndustry: topValid?.industry || null,
    topIndustryDemand: topValid?.demandScore || null,
    industriesCount: realIndustries.length,
    topIndustriesList,
    batchCount: metrics.batchCount,
    isSmallSample: metrics.isSmallSample,
    hasTrendData: metrics.batchCount >= 2,
    trendDescription: metrics.trendDescription || 'stable'
  }), [metrics, topValid, realIndustries, topIndustriesList]);

  const ai = aiInsights?.[metrics.code] || fallbackAI;
  const isLoading = typeof aiLoading === 'boolean' ? aiLoading : Boolean((aiLoading as any)?.[metrics.code]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard 
          label="Total Alumni" 
          value={String(metrics.total)} 
          onAudit={onOpenAudit ? () => onOpenAudit(getEmploymentRateAudit(metrics)) : undefined}
        />
        <MetricCard 
          label="Demand" 
          value={String(metrics.demand)} 
          onAudit={onOpenAudit ? () => onOpenAudit(getWorkforceVolumeAudit(metrics)) : undefined}
        />
        <MetricCard 
          label="Gap" 
          value={`${metrics.gap > 0 ? '+' : ''}${metrics.gap}`} 
          sublabel={metrics.gap > 0 ? 'Additional graduates needed' : metrics.gap < 0 ? 'Supply exceeds demand' : 'Balanced'}
          onAudit={onOpenAudit ? () => onOpenAudit(getWorkforceVolumeAudit(metrics)) : undefined}
        />
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Projection</p>
          {onOpenAudit && metrics.projection !== null && (
            <button
              type="button"
              onClick={() => onOpenAudit(getProjectionAudit(metrics))}
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 hover:bg-purple-200 transition-all flex items-center gap-1 cursor-pointer"
              title="Click to view linear regression projection calculation"
            >
              <span>🧮 Formula Breakdown</span>
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{projectionInsight}</p>
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Workforce Analysis</p>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{insight}</p>
      </div>
      {ai && (
        <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-purple-900 dark:text-purple-200">🎯 AI Strategic Intervention & Action Plan</span>
              {ai.isLiveAI ? (
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Gemini AI
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-purple-200 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 rounded-full uppercase tracking-wider">
                  CRMC Strategic AI
                </span>
              )}
            </div>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
              {isLoading && <span className="animate-spin">⚙</span>}
              {isLoading ? 'Analyzing with Gemini 2.0 Flash...' : 'Powered by Gemini 2.0 Flash'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {ai.actionableStep && (
              <div className="rounded-xl bg-white/80 dark:bg-gray-900/80 p-4 border border-purple-100 dark:border-purple-900/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1.5">
                  <span>📌 Actionable Step</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{ai.actionableStep}</p>
              </div>
            )}
            {ai.riskFactor && (
              <div className="rounded-xl bg-white/80 dark:bg-gray-900/80 p-4 border border-amber-100 dark:border-amber-900/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                  <span>⚡ Key Risk Factor</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{ai.riskFactor}</p>
              </div>
            )}
            {ai.growthOpportunity && (
              <div className="rounded-xl bg-white/80 dark:bg-gray-900/80 p-4 border border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-1.5">
                  <span>💡 Growth Opportunity</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{ai.growthOpportunity}</p>
              </div>
            )}
          </div>

          {ai.workforce && (
            <div className="pt-2 border-t border-purple-100 dark:border-purple-900/40">
              <p className="text-xs text-purple-900 dark:text-purple-200 font-medium leading-relaxed">{ai.workforce}</p>
            </div>
          )}
          {aiLoading && (
            <p className="text-xs text-purple-500 animate-pulse">Generating sharp predictive insights...</p>
          )}
        </div>
      )}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">Top Industries</p>
        <ul className="space-y-3">
          {metrics.industries.slice(0, 5).map((industry) => (
            <li key={industry.industry}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {isRealIndustry(industry.industry) ? industry.industry : 'Unspecified (Pending / Unemployed)'}
                  </span>
                  {onOpenAudit && (
                    <button
                      type="button"
                      onClick={() => onOpenAudit(getSectorShareAudit(metrics, industry))}
                      className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer font-semibold"
                      title="View sector share calculation"
                    >
                      🧮 {industry.shareOfDept}%
                    </button>
                  )}
                </div>
                <span className="text-gray-500 dark:text-gray-400">{industry.count} alumni</span>
              </div>
              <ProgressBar value={industry.shareOfDept} color="#7C2D12" />
            </li>
          ))}
          {metrics.industries.length === 0 && (
            <li className="text-sm text-gray-500 dark:text-gray-400">No industry records available.</li>
          )}
        </ul>
      </div>
    </div>
  );
});

const IndustryTab = React.memo(function IndustryTab({ 
  metrics, 
  aiInsights, 
  aiLoading,
  onOpenAudit 
}: { 
  metrics: DeptMetrics; 
  aiInsights: any; 
  aiLoading: boolean;
  onOpenAudit?: (payload: CalculationAuditPayload) => void;
}) {
  const insight = useMemo(() => generateIndustryInsight(metrics), [metrics]);
  const ai = aiInsights?.[metrics.code];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Industry Demand Summary</p>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{insight}</p>
      </div>
      {ai?.industry && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">🤖 AI Industry Insight</span>
            <span className="text-xs text-blue-400">Powered by Gemini</span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{ai.industry}</p>
          {aiLoading && (
            <p className="text-xs text-blue-400 mt-2">Generating AI insights...</p>
          )}
        </div>
      )}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Industry</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Alumni</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Demand</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Employment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {metrics.industries.map((industry) => (
              <tr key={industry.industry}>
                <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <span>{isRealIndustry(industry.industry) ? industry.industry : 'Unspecified (Pending / Unemployed)'}</span>
                    {onOpenAudit && (
                      <button
                        type="button"
                        onClick={() => onOpenAudit(getSectorShareAudit(metrics, industry))}
                        className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer font-semibold"
                        title="View sector share calculation"
                      >
                        🧮 {industry.shareOfDept}%
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">{industry.count}</td>
                <td className="px-6 py-3 text-right">
                  <div className="inline-flex items-center justify-end gap-2">
                    <StatusBadge label={industry.demandLabel} type={
                      industry.demandLabel === 'High Demand' ? 'success' :
                      industry.demandLabel === 'Moderate Demand' ? 'warning' : 'error'
                    } />
                    {onOpenAudit && (
                      <button
                        type="button"
                        onClick={() => onOpenAudit(getSectorDemandAudit(metrics, industry))}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        title="View sector demand formula"
                      >
                        🧮
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <span>{industry.employmentRate}%</span>
                    {onOpenAudit && (
                      <button
                        type="button"
                        onClick={() => onOpenAudit(getSectorDemandAudit(metrics, industry))}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        title="View employment calculation"
                      >
                        🧮
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {metrics.industries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-gray-500 dark:text-gray-400">
                  No industry records available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

const HealthTab = React.memo(function HealthTab({ 
  metrics, 
  allMetrics, 
  departmentStats, 
  aiInsights, 
  aiLoading,
  onOpenAudit
}: { 
  metrics: DeptMetrics; 
  allMetrics: DeptMetrics[]; 
  departmentStats: any[];
  aiInsights: any;
  aiLoading: boolean;
  onOpenAudit?: (payload: CalculationAuditPayload) => void;
}) {
  const hasExternalStats = Array.isArray(departmentStats) && departmentStats.length > 0;
  const healthInsight = useMemo(() => generateHealthInsight(metrics), [metrics]);
  const productivityInsight = useMemo(() => generateProductivityInsight(metrics), [metrics]);
  const ai = aiInsights?.[metrics.code];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard 
          label="Employment" 
          value={`${metrics.employmentRate}%`} 
          onAudit={onOpenAudit ? () => onOpenAudit(getEmploymentRateAudit(metrics)) : undefined}
        />
        <MetricCard 
          label="Alignment" 
          value={`${metrics.alignmentRate}%`} 
          onAudit={onOpenAudit ? () => onOpenAudit(getAlignmentRateAudit(metrics)) : undefined}
        />
        <MetricCard 
          label="Demand" 
          value={`${metrics.demandScore}%`} 
          onAudit={onOpenAudit ? () => onOpenAudit(getDemandScoreAudit(metrics)) : undefined}
        />
        <MetricCard 
          label="Health" 
          value={`${metrics.healthScore}%`} 
          sublabel={classifyHealth(metrics.healthScore)}
          onAudit={onOpenAudit ? () => onOpenAudit(getHealthScoreAudit(metrics)) : undefined}
        />
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Health Assessment</p>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{healthInsight}</p>
      </div>
      {ai?.health && (
        <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-green-700 dark:text-green-300">🤖 AI Health Insight</span>
            <span className="text-xs text-green-400">Powered by Gemini</span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{ai.health}</p>
          {aiLoading && (
            <p className="text-xs text-green-400 mt-2">Generating AI insights...</p>
          )}
        </div>
      )}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Productivity</p>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{productivityInsight}</p>
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Department</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Health</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Employment</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Alignment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {allMetrics.map((row) => {
              const external = hasExternalStats
                ? departmentStats.find((d: any) => normalizedDept({ department: d?.department }) === row.code)
                : null;
              const employment = external?.employment_rate ?? row.employmentRate;
              const alignment = external?.alignment_rate ?? row.alignmentRate;
              const health = external
                ? round1((Number(employment) || 0) * 0.5 + (Number(alignment) || 0) * 0.5)
                : row.healthScore;
              return (
                <tr key={row.code} className={row.code === metrics.code ? 'bg-gray-50 dark:bg-gray-700/40' : undefined}>
                  <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-100">
                    <span className="inline-block h-2 w-2 rounded-full align-middle mr-2" style={{ backgroundColor: '#7C2D12' }} />
                    {row.name}
                  </td>
                  <td className="px-6 py-3 text-right font-medium" style={{ color: healthColor(health) }}>
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <span>{Math.round(health)}%</span>
                      {onOpenAudit && (
                        <button
                          type="button"
                          onClick={() => onOpenAudit(getHealthScoreAudit(row))}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                          title="View health score formula"
                        >
                          🧮
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <span>{Math.round(Number(employment) || 0)}%</span>
                      {onOpenAudit && (
                        <button
                          type="button"
                          onClick={() => onOpenAudit(getEmploymentRateAudit(row))}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                          title="View employment rate formula"
                        >
                          🧮
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <span>{Math.round(Number(alignment) || 0)}%</span>
                      {onOpenAudit && (
                        <button
                          type="button"
                          onClick={() => onOpenAudit(getAlignmentRateAudit(row))}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                          title="View alignment rate formula"
                        >
                          🧮
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default function PredictionDashboard({ alumni, departmentStats, selectedDepartment = 'CCS' }: PredictionDashboardProps) {
  const [activeCode, setActiveCode] = useState(selectedDepartment);
  const [activeTab, setActiveTab] = useState<TabKey>('workforce');
  const [aiInsights, setAiInsights] = useState<Record<string, any>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [auditModal, setAuditModal] = useState<CalculationAuditPayload | null>(null);

  const safeAlumni = useMemo(() => (Array.isArray(alumni) ? alumni : []), [alumni]);

  const { targetBatch, latestBatch, deptBuckets } = useMemo(() => {
    let maxBatch = -1;
    const buckets = new Map<string, any[]>();
    DEPARTMENTS.forEach(d => buckets.set(d.code, []));

    for (let i = 0; i < safeAlumni.length; i++) {
      const a = safeAlumni[i];
      const dept = normalizedDept(a);
      if (buckets.has(dept)) {
        buckets.get(dept)!.push(a);
      }
      const y = toBatchYear(a?.batch_year);
      if (y !== null && y > maxBatch) {
        maxBatch = y;
      }
    }

    const latest = maxBatch > 0 ? maxBatch : null;
    const target = maxBatch > 0 ? maxBatch + 1 : null;
    return { targetBatch: target, latestBatch: latest, deptBuckets: buckets };
  }, [safeAlumni]);

  const allMetrics = useMemo(
    () => DEPARTMENTS.map((dept) => computeDeptMetrics(deptBuckets.get(dept.code) || [], dept, targetBatch, latestBatch)),
    [deptBuckets, targetBatch, latestBatch]
  );

  const departmentsAnalyzed = useMemo(() => allMetrics.filter((m) => m.total > 0).length, [allMetrics]);
  const metrics = useMemo(() => allMetrics.find((m) => m.code === activeCode) ?? allMetrics[0], [allMetrics, activeCode]);

  const unclassifiedCount = useMemo(() => {
    const classifiedTotal = allMetrics.reduce((sum, m) => sum + m.total, 0);
    return Math.max(0, safeAlumni.length - classifiedTotal);
  }, [allMetrics, safeAlumni.length]);

  const totalGap = useMemo(() => {
    return allMetrics.reduce((sum, m) => sum + (m.gap > 0 ? m.gap : 0), 0);
  }, [allMetrics]);

  const avgEmployment = useMemo(() => {
    const withData = allMetrics.filter(m => m.total > 0);
    if (withData.length === 0) return 0;
    return Math.round(withData.reduce((sum, m) => sum + m.employmentRate, 0) / withData.length);
  }, [allMetrics]);

  const fetchAIInsights = useCallback(async (deptMetrics: DeptMetrics) => {
    const deptCode = deptMetrics.code;
    if (aiInsights[deptCode] || aiLoading[deptCode]) return;
    setAiLoading(prev => ({ ...prev, [deptCode]: true }));
    try {
      const realIndustries = deptMetrics.industries.filter(i => isRealIndustry(i.industry));
      const topValid = realIndustries[0];
      const topIndustriesList = realIndustries.slice(0, 3).map(i => ({
        name: i.industry,
        count: i.count,
        share: i.shareOfDept
      }));

      const request: PredictionInsightRequest = {
        department: deptMetrics.code,
        departmentName: deptMetrics.fullName,
        totalAlumni: deptMetrics.total,
        employedCount: deptMetrics.employed,
        inFieldCount: deptMetrics.inField,
        outOfFieldCount: Math.max(0, deptMetrics.employed - deptMetrics.inField),
        employmentRate: deptMetrics.employmentRate,
        alignmentRate: deptMetrics.alignmentRate,
        healthScore: deptMetrics.healthScore,
        demandScore: deptMetrics.demandScore,
        projection: deptMetrics.projection,
        growth: deptMetrics.growth,
        gap: deptMetrics.gap,
        targetBatch: deptMetrics.targetBatch,
        latestBatch: deptMetrics.latestBatch,
        topIndustry: topValid?.industry || null,
        topIndustryDemand: topValid?.demandScore || null,
        industriesCount: realIndustries.length,
        topIndustriesList,
        batchCount: deptMetrics.batchCount,
        isSmallSample: deptMetrics.isSmallSample,
        hasTrendData: deptMetrics.batchCount >= 2,
        trendDescription: deptMetrics.trendDescription || 'stable'
      };
      const result = await getPredictionInsights(request);
      setAiInsights(prev => ({ ...prev, [deptCode]: result.insights }));
    } catch (error) {
      console.error('Error fetching AI insights:', error);
    } finally {
      setAiLoading(prev => ({ ...prev, [deptCode]: false }));
    }
  }, [aiInsights, aiLoading]);

  useEffect(() => {
    if (metrics) {
      fetchAIInsights(metrics);
    }
  }, [metrics, fetchAIInsights]);

  const handleSelectDepartment = useCallback((code: string) => {
    setActiveCode(code);
    setActiveTab('workforce');
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workforce Demand Forecast</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Predictive analytics for alumni employment, industry demand, and workforce planning.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {targetBatch !== null && latestBatch !== null
              ? `Forecasting Batch ${targetBatch} needs based on Batch ${latestBatch} outcomes. ${safeAlumni.length} records, ${departmentsAnalyzed} departments.`
              : `Analyzing ${safeAlumni.length} alumni records across ${departmentsAnalyzed} departments.`}
          </p>
        </div>
        {totalGap > 0 && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-6 py-4">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Graduate Shortage</p>
            <p className="text-xl font-bold text-red-800 dark:text-red-200">{totalGap} additional graduates required</p>
          </div>
        )}
      </div>

      {targetBatch === null && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 px-6 py-4 text-sm text-amber-800 dark:text-amber-300">
          {safeAlumni.length === 0
            ? 'No alumni records provided. Add records to enable projections.'
            : 'No batch_year data found. Add batch_year (e.g. 2026) to enable projections.'}
        </div>
      )}

      {unclassifiedCount > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 px-6 py-4 text-sm text-amber-800 dark:text-amber-300">
          {unclassifiedCount} alumni records could not be matched to a department. Check department field for typos.
        </div>
      )}

      <div className="grid grid-cols-4 gap-6">
        <SummaryCard label="Total Alumni" value={safeAlumni.length} />
        <SummaryCard label="Departments" value={departmentsAnalyzed} />
        <SummaryCard label="Average Employment" value={`${avgEmployment}%`} />
        <SummaryCard 
          label="Forecast Batch" 
          value={targetBatch !== null ? String(targetBatch) : '—'} 
          sublabel={latestBatch !== null ? `Based on Batch ${latestBatch}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {allMetrics.map((m) => (
          <DepartmentCard
            key={m.code}
            metrics={m}
            isSelected={m.code === metrics.code}
            onSelect={() => handleSelectDepartment(m.code)}
            onAuditHealth={() => setAuditModal(getHealthScoreAudit(m))}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{metrics.name} ({metrics.code})</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {metrics.total} alumni · Latest Batch: {metrics.latestBatch || '—'} · Forecast Batch: {metrics.targetBatch || '—'}
                {metrics.isSmallSample && (
                  <span className="ml-3 inline-block rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium">
                    Small sample
                  </span>
                )}
                {aiLoading[metrics.code] && (
                  <span className="ml-3 inline-block text-xs text-gray-400">
                    Loading AI insights...
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-6 px-6 pt-4 border-b border-gray-100 dark:border-gray-700">
          {TABS.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'text-[#7C2D12] border-b-2 border-[#7C2D12]'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'workforce' && (
            <WorkforceTab 
              metrics={metrics} 
              aiInsights={aiInsights} 
              aiLoading={aiLoading[metrics.code]}
              onOpenAudit={setAuditModal}
            />
          )}
          {activeTab === 'industry' && (
            <IndustryTab 
              metrics={metrics} 
              aiInsights={aiInsights} 
              aiLoading={aiLoading[metrics.code]}
              onOpenAudit={setAuditModal}
            />
          )}
          {activeTab === 'health' && (
            <HealthTab 
              metrics={metrics} 
              allMetrics={allMetrics} 
              departmentStats={Array.isArray(departmentStats) ? departmentStats : []} 
              aiInsights={aiInsights}
              aiLoading={aiLoading[metrics.code]}
              onOpenAudit={setAuditModal}
            />
          )}
        </div>
      </div>

      {/* Interactive Calculation Audit Modal */}
      <CalculationAuditModal 
        auditData={auditModal} 
        onClose={() => setAuditModal(null)} 
      />
    </div>
  );
}
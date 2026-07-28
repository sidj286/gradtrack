// src/components/PredictionDashboard.tsx
import  { useMemo, useState } from 'react';

interface PredictionDashboardProps {
  alumni: any[];
  departmentStats: any[];
  selectedDepartment?: string;
}

/* ============================================================
   CONSTANTS
   ============================================================ */

const PROJECTION_YEAR = 2028;

const DEPARTMENTS = [
  { code: 'CCS', name: 'Computer Studies', color: '#3b82f6' },
  { code: 'CTE', name: 'Teacher Education', color: '#10b981' },
  { code: 'CCJE', name: 'Criminal Justice', color: '#ef4444' },
  { code: 'CBE', name: 'Business Education', color: '#f59e0b' },
  { code: 'PSY', name: 'Psychology', color: '#8b5cf6' },
];

type TabKey = 'overview' | 'workforce' | 'industry' | 'health';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'workforce', label: 'Workforce' },
  { key: 'industry', label: 'Industry' },
  { key: 'health', label: 'Health' },
];

/* ============================================================
   HELPERS
   ============================================================ */

const isEmployed = (a: any): boolean => Boolean(a) && a.employment_status === 'Employed';
const isInField = (a: any): boolean => Boolean(a) && a.career_alignment_status === 'In-Field';

const normalizedDept = (a: any): string =>
  typeof a?.department === 'string' ? a.department.trim().toUpperCase() : '';

const round1 = (n: number): number => Math.round(n * 10) / 10;

const classifyHealth = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Needs Improvement';
};

const healthColor = (score: number): string => {
  if (score >= 80) return '#10b981';
  if (score >= 70) return '#3b82f6';
  if (score >= 60) return '#f59e0b';
  if (score >= 50) return '#f97316';
  return '#ef4444';
};

const classifyDemand = (score: number): 'High Demand' | 'Moderate Demand' | 'Low Demand' => {
  if (score >= 70) return 'High Demand';
  if (score >= 40) return 'Moderate Demand';
  return 'Low Demand';
};

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number } | null {
  const n = x.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
  }
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/* ============================================================
   METRICS COMPUTATION (single source of truth, used by cards,
   the detail panel, and every tab)
   ============================================================ */

interface IndustryRow {
  industry: string;
  count: number;
  employmentRate: number;
  demandScore: number;
  demandLabel: 'High Demand' | 'Moderate Demand' | 'Low Demand';
  shareOfDept: number;
}

interface DeptMetrics {
  code: string;
  name: string;
  color: string;
  total: number;
  employed: number;
  inField: number;
  employmentRate: number;
  alignmentRate: number;
  demandScore: number;
  healthScore: number;
  batchCount: number;
  projection: number | null;
  growth: number | null;
  industries: IndustryRow[];
  supply: number;
  demand: number;
  gap: number;
}

function computeIndustries(deptAlumni: any[]): IndustryRow[] {
  const groups = new Map<string, any[]>();
  deptAlumni.forEach((a) => {
    const key = (typeof a?.industry === 'string' && a.industry.trim()) || 'Unspecified';
    const bucket = groups.get(key) ?? [];
    bucket.push(a);
    groups.set(key, bucket);
  });

  const total = deptAlumni.length;
  return Array.from(groups.entries())
    .map(([industry, records]) => {
      const employed = records.filter(isEmployed).length;
      const inField = records.filter(isInField).length;
      const employmentRate = records.length > 0 ? round1((employed / records.length) * 100) : 0;
      const alignmentRate = records.length > 0 ? (inField / records.length) * 100 : 0;
      const demandScore = round1(employmentRate * 0.6 + alignmentRate * 0.4);
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

function computeDeptMetrics(alumni: any[], dept: (typeof DEPARTMENTS)[number]): DeptMetrics {
  const deptAlumni = alumni.filter((a) => normalizedDept(a) === dept.code);
  const total = deptAlumni.length;
  const employed = deptAlumni.filter(isEmployed).length;
  const inField = deptAlumni.filter(isInField).length;
  const employmentRate = total > 0 ? round1((employed / total) * 100) : 0;
  const alignmentRate = total > 0 ? round1((inField / total) * 100) : 0;
  const demandScore = round1(employmentRate * 0.6 + alignmentRate * 0.4);
  const healthScore = round1((employmentRate + alignmentRate) / 2);

  const batchYears = Array.from(
    new Set(deptAlumni.map((a) => a.batch_year).filter((y) => typeof y === 'number' && Number.isFinite(y)))
  ).sort((a, b) => a - b) as number[];

  let projection: number | null = null;
  let growth: number | null = null;

  if (batchYears.length >= 2) {
    const rates = batchYears.map((year) => {
      const batchAlumni = deptAlumni.filter((a) => a.batch_year === year);
      return batchAlumni.length > 0
        ? (batchAlumni.filter(isInField).length / batchAlumni.length) * 100
        : 0;
    });
    const regression = linearRegression(batchYears, rates);
    if (regression) {
      const predicted = regression.slope * PROJECTION_YEAR + regression.intercept;
      projection = round1(Math.max(0, Math.min(100, predicted)));
      growth = round1(projection - alignmentRate);
    }
  }

  const industries = computeIndustries(deptAlumni);
  const supply = total;
  const demand = Math.round(total * (demandScore / 100) * 1.1);

  return {
    code: dept.code,
    name: dept.name,
    color: dept.color,
    total,
    employed,
    inField,
    employmentRate,
    alignmentRate,
    demandScore,
    healthScore,
    batchCount: batchYears.length,
    projection,
    growth,
    industries,
    supply,
    demand,
    gap: demand - supply,
  };
}

/* ============================================================
   INTERPRETATION / INSIGHT GENERATION
   These read the metrics that are already calculated above and
   turn them into short, decision-oriented statements. No new
   statistics are invented here — every number quoted comes
   directly from the DeptMetrics object.
   ============================================================ */

function generateProjectionInsight(metrics: DeptMetrics): string {
  if (metrics.total === 0) {
    return `No alumni records are available yet for ${metrics.name}.`;
  }
  if (metrics.projection === null || metrics.growth === null) {
    return 'Projection unavailable. At least two historical graduating batches are required.';
  }

  const current = metrics.alignmentRate;
  const projected = metrics.projection;
  const growth = metrics.growth;

  // Meaningful growth: strategies are working, reinforce them.
  if (growth > 1) {
    return `Career alignment is projected to increase from ${current}% to ${projected}% by ${PROJECTION_YEAR} (+${growth}%). Current placement strategies appear effective. Continue strengthening employer partnerships.`;
  }

  // Sharp decline: flag urgency and name concrete next steps.
  if (growth < -10) {
    return `Career alignment is projected to decline from ${current}% to ${projected}% by ${PROJECTION_YEAR} (${growth}%). This indicates weakening workforce alignment. Immediate curriculum review and industry collaboration are recommended.`;
  }

  // Mild decline: a watch-list signal rather than a crisis.
  if (growth < -1) {
    return `Career alignment is projected to decrease slightly from ${current}% to ${projected}% by ${PROJECTION_YEAR} (${growth}%). Monitor curriculum relevance and employer engagement.`;
  }

  // Within +/-1%: treat as effectively flat.
  return `Career alignment is expected to remain stable near ${projected}% through ${PROJECTION_YEAR}. Maintain current placement and internship initiatives.`;
}

function generateWorkforceInsight(metrics: DeptMetrics): string {
  const lead = metrics.industries[0];
  if (!lead) {
    return `No industry placement data is available for ${metrics.name} yet.`;
  }

  const leadSentence = `The ${lead.industry.toLowerCase()} sector currently employs ${lead.shareOfDept}% of ${metrics.code} graduates.`;

  if (metrics.gap > 0) {
    return `${leadSentence} Projected workforce demand exceeds graduate supply by ${metrics.gap} graduates. Expanding enrollment and strengthening internship programs may help meet employer demand.`;
  }
  if (metrics.gap < 0) {
    return `${leadSentence} Graduate supply currently exceeds estimated workforce demand by ${Math.abs(metrics.gap)} graduates. Focus on increasing employer partnerships and expanding employment opportunities.`;
  }
  return `${leadSentence} Graduate supply is closely aligned with estimated workforce demand.`;
}

function generateIndustryInsight(metrics: DeptMetrics): string {
  const industries = metrics.industries;
  if (industries.length === 0) {
    return `No industry distribution data is available for ${metrics.name} graduates yet.`;
  }

  const top = industries[0];
  let concentrationSentence: string;
  if (top.shareOfDept >= 40) {
    concentrationSentence = `The ${top.industry.toLowerCase()} industry employs ${top.shareOfDept}% of ${metrics.code} graduates, indicating strong specialization in this sector.`;
  } else if (industries.length >= 3) {
    concentrationSentence = `Employment is distributed across ${industries.length} industries, reducing dependence on a single sector.`;
  } else {
    concentrationSentence = `${top.industry} is the leading employer for ${metrics.code} graduates at ${top.shareOfDept}% of alumni.`;
  }

  if (metrics.alignmentRate < 50) {
    return `${concentrationSentence} Most graduates work outside their intended field, suggesting opportunities to strengthen career alignment.`;
  }
  if (metrics.alignmentRate >= 70) {
    return `${concentrationSentence} Career alignment remains strong across current placements.`;
  }
  return concentrationSentence;
}

function generateHealthInsight(metrics: DeptMetrics): string {
  if (metrics.total === 0) {
    return `No alumni records are available yet to assess ${metrics.name} health.`;
  }

  const classificationText: Record<string, string> = {
    Excellent: 'Department performance is consistently strong across employment and career alignment.',
    'Very Good': 'Employment and career alignment outcomes are strong, with minor room for improvement.',
    Good: 'Employment outcomes remain healthy, although career alignment has room for improvement.',
    Fair: 'Graduate employability is acceptable, but alignment with degree-related careers should improve.',
    'Needs Improvement':
      'Low employment and alignment suggest the department should review curriculum relevance, internships, and employer engagement.',
  };

  // Strategic recommendation depends on the employment/alignment combination,
  // not the blended health score alone, so two departments with the same
  // score can still get different advice.
  const employmentHigh = metrics.employmentRate >= 70;
  const alignmentHigh = metrics.alignmentRate >= 70;
  let recommendation: string;
  if (employmentHigh && !alignmentHigh) {
    recommendation = 'Improve curriculum alignment with industry.';
  } else if (!employmentHigh && alignmentHigh) {
    recommendation = 'Strengthen job placement and employer recruitment.';
  } else if (!employmentHigh && !alignmentHigh) {
    recommendation = 'Review curriculum, internships, and career services.';
  } else {
    recommendation = 'Maintain existing partnerships while expanding opportunities.';
  }

  const classification = classifyHealth(metrics.healthScore);
  return `${classificationText[classification] ?? ''} ${recommendation}`;
}

function generateProductivityInsight(metrics: DeptMetrics): string {
  if (metrics.total === 0) {
    return `No alumni records are available yet for ${metrics.name}.`;
  }
  const base = `${metrics.inField} of ${metrics.total} graduates (${metrics.alignmentRate}%) are currently working in careers aligned with their degree.`;
  if (metrics.alignmentRate >= 80) {
    return `${base} Continue current internship and employer-partnership efforts to sustain this level.`;
  }
  return `${base} Improving internship placement and employer partnerships may further increase industry readiness.`;
}

/* ============================================================
   SMALL PRESENTATIONAL PIECES
   ============================================================ */

function DeptBadge({ code, color, size = 10 }: { code: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ backgroundColor: color, width: `${size * 4}px`, height: `${size * 4}px`, fontSize: `${size * 1.1}px` }}
    >
      {code.slice(0, 2)}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${clamped}%`, backgroundColor: color }} />
    </div>
  );
}

function StatTile({ label, value, accent, sublabel }: { label: string; value: string; accent?: string; sublabel?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  );
}

/* ============================================================
   DEPARTMENT CARD (grid)
   ============================================================ */

function DepartmentCard({ metrics, isSelected, onSelect }: { metrics: DeptMetrics; isSelected: boolean; onSelect: () => void }) {
  const projectionLabel = metrics.projection === null ? 'Insufficient data' : `${metrics.projection}%`;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-xl p-4 border transition-all duration-200 ${
        isSelected
          ? 'border-transparent shadow-md ring-1'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      style={isSelected ? { boxShadow: `0 0 0 1.5px ${metrics.color}` } : undefined}
    >
      <div className="flex items-center gap-3">
        <DeptBadge code={metrics.code} color={metrics.color} />
        <div className="min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{metrics.name}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">{metrics.total} alumni</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Career alignment</span>
          <span className="font-medium text-gray-700 dark:text-gray-200">{metrics.alignmentRate}%</span>
        </div>
        <Bar value={metrics.alignmentRate} color={metrics.color} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-gray-400">{PROJECTION_YEAR} projection</span>
        <span className="font-semibold" style={{ color: metrics.color }}>
          {projectionLabel}
        </span>
      </div>
    </button>
  );
}

/* ============================================================
   TABS
   ============================================================ */

function OverviewTab({ metrics }: { metrics: DeptMetrics }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Alumni" value={String(metrics.total)} />
        <StatTile label="Employment" value={`${metrics.employmentRate}%`} accent={metrics.color} />
        <StatTile label="Alignment" value={`${metrics.alignmentRate}%`} accent={metrics.color} />
        <StatTile label="Demand" value={`${metrics.demandScore}%`} accent={metrics.color} />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{PROJECTION_YEAR} Projection</p>
        <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">{generateProjectionInsight(metrics)}</p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Health Score</p>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: healthColor(metrics.healthScore) }}
          >
            {classifyHealth(metrics.healthScore)}
          </span>
        </div>
        <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{metrics.healthScore}</p>
        <div className="mt-2">
          <Bar value={metrics.healthScore} color={healthColor(metrics.healthScore)} />
        </div>
      </div>
    </div>
  );
}

function WorkforceTab({ metrics }: { metrics: DeptMetrics }) {
  const leadInsight = generateWorkforceInsight(metrics);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Supply" value={String(metrics.supply)} accent={metrics.color} />
        <StatTile label="Demand" value={String(metrics.demand)} accent={metrics.color} />
        <StatTile label="Gap" value={`${metrics.gap > 0 ? '+' : ''}${metrics.gap}`} accent={metrics.gap > 0 ? '#ef4444' : '#10b981'} />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-5">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{leadInsight}</p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Top Industries by Alumni Count</p>
        <ul className="space-y-3">
          {metrics.industries.slice(0, 5).map((industry) => (
            <li key={industry.industry}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-gray-700 dark:text-gray-200">{industry.industry}</span>
                <span className="text-gray-500 dark:text-gray-400">{industry.count} alumni</span>
              </div>
              <Bar value={industry.shareOfDept} color={metrics.color} />
            </li>
          ))}
          {metrics.industries.length === 0 && (
            <li className="text-sm text-gray-500 dark:text-gray-400">No industry records available.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

const demandBadgeStyles: Record<IndustryRow['demandLabel'], string> = {
  'High Demand': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Moderate Demand': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Low Demand': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function IndustryTab({ metrics }: { metrics: DeptMetrics }) {
  const insight = generateIndustryInsight(metrics);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-5">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{insight}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Industry</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Alumni</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Demand</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Employment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {metrics.industries.map((industry) => (
              <tr key={industry.industry}>
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{industry.industry}</td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{industry.count}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${demandBadgeStyles[industry.demandLabel]}`}>
                    {industry.demandLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{industry.employmentRate}%</td>
              </tr>
            ))}
            {metrics.industries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                  No industry records available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HealthTab({ metrics, allMetrics, departmentStats }: { metrics: DeptMetrics; allMetrics: DeptMetrics[]; departmentStats: any[] }) {
  const hasExternalStats = Array.isArray(departmentStats) && departmentStats.length > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Employment" value={`${metrics.employmentRate}%`} accent={metrics.color} />
        <StatTile label="Alignment" value={`${metrics.alignmentRate}%`} accent={metrics.color} />
        <StatTile label="Demand" value={`${metrics.demandScore}%`} accent={metrics.color} />
        <StatTile label="Health Score" value={String(metrics.healthScore)} accent={healthColor(metrics.healthScore)} />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Health Score · {classifyHealth(metrics.healthScore)}
        </p>
        <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">{generateHealthInsight(metrics)}</p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Productivity</p>
        <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">{generateProductivityInsight(metrics)}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Department</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Health</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Employment</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Alignment</th>
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
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    <span className="inline-block h-2 w-2 rounded-full align-middle mr-2" style={{ backgroundColor: row.color }} />
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{Math.round(health)}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{Math.round(Number(employment) || 0)}%</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{Math.round(Number(alignment) || 0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function PredictionDashboard({ alumni, departmentStats, selectedDepartment = 'CCS' }: PredictionDashboardProps) {
  const [activeCode, setActiveCode] = useState(selectedDepartment);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const allMetrics = useMemo(
    () => DEPARTMENTS.map((dept) => computeDeptMetrics(Array.isArray(alumni) ? alumni : [], dept)),
    [alumni]
  );

  const departmentsAnalyzed = useMemo(() => allMetrics.filter((m) => m.total > 0).length, [allMetrics]);
  const metrics = allMetrics.find((m) => m.code === activeCode) ?? allMetrics[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Predictive Career Alignment</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Forecasting {PROJECTION_YEAR} outcomes from {Array.isArray(alumni) ? alumni.length : 0} alumni records across {departmentsAnalyzed} departments.
        </p>
      </div>

      {/* Department grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {allMetrics.map((m) => (
          <DepartmentCard
            key={m.code}
            metrics={m}
            isSelected={m.code === metrics.code}
            onSelect={() => {
              setActiveCode(m.code);
              setActiveTab('overview');
            }}
          />
        ))}
      </div>

      {/* Detail panel */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <DeptBadge code={metrics.code} color={metrics.color} size={9} />
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">{metrics.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {metrics.total} alumni · {metrics.batchCount} batch{metrics.batchCount === 1 ? '' : 'es'} analyzed
            </p>
          </div>
        </div>

        <div className="flex gap-1 px-3 pt-2 border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
          {TABS.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
                  selected ? 'text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                style={selected ? { borderBottom: `2px solid ${metrics.color}` } : { borderBottom: '2px solid transparent' }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === 'overview' && <OverviewTab metrics={metrics} />}
          {activeTab === 'workforce' && <WorkforceTab metrics={metrics} />}
          {activeTab === 'industry' && <IndustryTab metrics={metrics} />}
          {activeTab === 'health' && (
            <HealthTab metrics={metrics} allMetrics={allMetrics} departmentStats={Array.isArray(departmentStats) ? departmentStats : []} />
          )}
        </div>
      </div>
    </div>
  );
}
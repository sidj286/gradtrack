import { useState } from 'react';
import { supabase } from './lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportsPanel() {
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState<'master' | 'employment' | null>(null);

  // ============================================================
  // REPORT 1: ALUMNI MASTER LIST
  // ============================================================
  const exportMasterList = async () => {
    setLoading(true);
    setExportType('master');
    
    try {
      // Fetch all alumni with their email from users table
      const { data: alumni, error } = await supabase
        .from('alumni_profiles')
        .select(`
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
          career_alignment_bool,
          ai_confidence_score,
          profile_completion,
          created_at,
          updated_at
        `)
        .order('batch_year', { ascending: false });

      if (error) throw error;

      // Format data for Excel
      const formattedData = alumni?.map(alum => ({
        'Full Name': alum.full_name || '—',
        'Course': alum.course || '—',
        'Department': alum.department || '—',
        'Batch Year': alum.batch_year || '—',
        'Employment Status': alum.employment_status || '—',
        'Job Title': alum.job_title || '—',
        'Company': alum.company || '—',
        'Industry': alum.industry || '—',
        'Location': alum.location || '—',
        'LinkedIn': alum.linkedin_url || '—',
        'Career Alignment': alum.career_alignment_bool === true ? 'In-Field' : 
                          alum.career_alignment_bool === false ? 'Out-of-Field' : 'Pending',
        'AI Confidence': alum.ai_confidence_score ? `${Math.round(alum.ai_confidence_score * 100)}%` : '—',
        'Profile Completion': `${alum.profile_completion || 0}%`,
        'Registered': alum.created_at ? new Date(alum.created_at).toLocaleDateString() : '—',
        'Last Updated': alum.updated_at ? new Date(alum.updated_at).toLocaleDateString() : '—'
      }));

      // Create Excel file
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Alumni Master List');
      
      // Auto-size columns
      ws['!cols'] = [{wch:20}, {wch:25}, {wch:15}, {wch:12}, {wch:18}, {wch:25}, {wch:25}, {wch:20}, {wch:20}, {wch:30}, {wch:15}, {wch:15}, {wch:18}, {wch:12}, {wch:12}];
      
      // Download file
      XLSX.writeFile(wb, `Alumni_Master_List_${new Date().toISOString().split('T')[0]}.xlsx`);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export master list');
    } finally {
      setLoading(false);
      setExportType(null);
    }
  };

  // ============================================================
  // REPORT 2: EMPLOYMENT SUMMARY
  // ============================================================
  const exportEmploymentSummary = async () => {
  setLoading(true);
  setExportType('employment');
  
  try {
    const { data: alumni, error } = await supabase
      .from('alumni_profiles')
      .select('employment_status, department, batch_year, course');

    if (error) throw error;

    const total = alumni.length;
    const employed = alumni.filter(a => a.employment_status === 'Employed').length;
    const unemployed = alumni.filter(a => a.employment_status === 'Unemployed').length;
    const employmentRate = total > 0 ? ((employed / total) * 100).toFixed(2) : 0;

    // By Department
    const departments = [...new Set(alumni.map(a => a.department).filter(Boolean))];
    const deptStats = departments.map(dept => {
      const deptAlumni = alumni.filter(a => a.department === dept);
      const deptTotal = deptAlumni.length;
      const deptEmployed = deptAlumni.filter(a => a.employment_status === 'Employed').length;
      return [dept, deptTotal.toString(), deptEmployed.toString(), (deptTotal - deptEmployed).toString(), `${((deptEmployed / deptTotal) * 100).toFixed(2)}%`];
    });

    // By Batch Year
    const batchYears = [...new Set(alumni.map(a => a.batch_year).filter(Boolean))].sort((a,b) => b - a);
    const batchStats = batchYears.map(batch => {
      const batchAlumni = alumni.filter(a => a.batch_year === batch);
      const batchTotal = batchAlumni.length;
      const batchEmployed = batchAlumni.filter(a => a.employment_status === 'Employed').length;
      return [batch.toString(), batchTotal.toString(), batchEmployed.toString(), (batchTotal - batchEmployed).toString(), `${((batchEmployed / batchTotal) * 100).toFixed(2)}%`];
    });

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(128, 0, 0);
    doc.text('Employment Summary Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 30, { align: 'center' });
    
    // Overall Summary
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Overall Summary', 14, 45);
    
    autoTable(doc, {
      startY: 50,
      head: [['Total Alumni', 'Employed', 'Unemployed', 'Employment Rate']],
      body: [[total.toString(), employed.toString(), unemployed.toString(), `${employmentRate}%`]],
      theme: 'striped',
      headStyles: { fillColor: [128, 0, 0], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    });
    
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // By Department
    doc.setFontSize(14);
    doc.text('By Department', 14, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Department', 'Total', 'Employed', 'Unemployed', 'Rate']],
      body: deptStats,
      theme: 'striped',
      headStyles: { fillColor: [128, 0, 0], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    });
    
    finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // By Batch Year
    doc.setFontSize(14);
    doc.text('By Batch Year', 14, finalY);
    
    autoTable(doc, {
      startY: finalY + 5,
      head: [['Batch Year', 'Total', 'Employed', 'Unemployed', 'Rate']],
      body: batchStats,
      theme: 'striped',
      headStyles: { fillColor: [128, 0, 0], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    });
    
    // Save PDF
    doc.save(`Employment_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
    
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export employment summary');
  } finally {
    setLoading(false);
    setExportType(null);
  }
};
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          📊 Reports & Export Center
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Download alumni data in Excel format
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Report 1: Alumni Master List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-2xl">
              📋
            </div>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
              Excel Export
            </span>
          </div>
          
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Alumni Master List
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Complete list of all registered alumni with profile fields including name, course, employment, and career alignment data.
          </p>
          
          <button
            onClick={exportMasterList}
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-[#800000] to-[#a10000] text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && exportType === 'master' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export to Excel
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
            Includes all alumni profile data • ~15 columns
          </p>
        </div>

        {/* Report 2: Employment Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-2xl">
              📊
            </div>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
              Multi-Sheet Export
            </span>
          </div>
          
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Employment Summary
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Employment statistics and rates broken down by department, batch year, and course.
          </p>
          
          <button
            onClick={exportEmploymentSummary}
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-[#800000] to-[#a10000] text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && exportType === 'employment' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to PDF
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
            Multiple sheets • Summary + Department + Batch + Course
          </p>
        </div>
      </div>

      {/* Note Section */}
      <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <span>ℹ️</span>
          Exported files are saved to your Downloads folder. Excel files are compatible with Microsoft Excel and Google Sheets.
        </p>
      </div>
    </div>
  );
}
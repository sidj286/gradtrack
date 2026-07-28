import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

interface JobHistoryProps {
  alumniId: string;
}

interface JobHistoryEntry {
  id: string;
  company: string;
  job_title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  industry: string | null;
  location: string | null;
}

const JobHistory: React.FC<JobHistoryProps> = ({ alumniId }) => {
  const [jobs, setJobs] = useState<JobHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!alumniId) return;
    fetchJobs();
  }, [alumniId]);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('alumni_job_history')
        .select('*')
        .eq('alumni_id', alumniId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching job history:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FULL DATE: Day/Month/Year
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse p-4 bg-gray-100 rounded-lg">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-500">No career history yet</p>
        <p className="text-xs text-gray-400 mt-1">History auto-tracks when you update your job</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">💼</span>
        <h4 className="text-lg font-semibold text-gray-900">Career History</h4>
        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
          {jobs.length}
        </span>
      </div>

      <div className="space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className={`p-4 rounded-xl border ${
            job.is_current ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
          }`}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-900">{job.job_title}</span>
                <span className="text-gray-400">at</span>
                <span className="font-semibold">{job.company}</span>
                {job.is_current && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Current</span>
                )}
              </div>
              
              {/* ✅ DISPLAY: Day Month Year → Present or Day Month Year → Day Month Year */}
              <div className="text-sm text-gray-600">
                <span className="font-medium">📅</span>
                {formatDate(job.start_date)} 
                <span className="mx-2">→</span>
                {job.is_current ? 'Present' : job.end_date ? formatDate(job.end_date) : 'Unknown'}
              </div>
              
              {(job.industry || job.location) && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {job.industry && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-100">
                      {job.industry}
                    </span>
                  )}
                  {job.location && (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full border border-purple-100">
                      📍 {job.location}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobHistory;
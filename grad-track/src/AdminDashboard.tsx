// AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

interface AlumniStats {
  total: number;
  employed: number;
  unemployed: number;
  inField: number;
  outOfField: number;
  byCourse: Record<string, { total: number; employed: number }>;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  target_type: string;
  target_course: string;
  target_batch_year: number;
  created_at: string;
  published: boolean;
}

interface Alumni {
  id: string;
  full_name: string;
  course: string;
  batch_year: number;
  employment_status: string;
  job_title: string;
  company: string;
  career_alignment_status: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AlumniStats>({
    total: 0,
    employed: 0,
    unemployed: 0,
    inField: 0,
    outOfField: 0,
    byCourse: {},
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [filteredAlumni, setFilteredAlumni] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    category: 'alumni_events',
    target_type: 'all',
    target_course: '',
    target_batch_year: '',
  });
  const [filters, setFilters] = useState({
    course: '',
    batch_year: '',
    employment_status: '',
    alignment: '',
  });
  const [courses, setCourses] = useState<string[]>([]);
  const [batchYears, setBatchYears] = useState<number[]>([]);

  useEffect(() => {
    fetchStats();
    fetchAnnouncements();
    fetchAlumni();
  }, []);

  const fetchStats = async () => {
    try {
      // Get all alumni profiles
      const { data: profiles } = await supabase
        .from('alumni_profiles')
        .select('*');

      if (profiles) {
        const total = profiles.length;
        const employed = profiles.filter(p => p.employment_status === 'Employed').length;
        const unemployed = profiles.filter(p => p.employment_status === 'Unemployed').length;
        
        // Calculate by course
        const byCourse: Record<string, { total: number; employed: number }> = {};
        profiles.forEach(p => {
          if (p.course) {
            if (!byCourse[p.course]) byCourse[p.course] = { total: 0, employed: 0 };
            byCourse[p.course].total++;
            if (p.employment_status === 'Employed') byCourse[p.course].employed++;
          }
        });

        setStats({
          total,
          employed,
          unemployed,
          inField: 0, // Calculate based on AI alignment
          outOfField: 0,
          byCourse,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAnnouncements(data);
  };

  const fetchAlumni = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('alumni_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setAlumni(data);
      setFilteredAlumni(data);
      
      // Extract unique courses and batch years for filters
      const uniqueCourses = [...new Set(data.map(a => a.course).filter(Boolean))] as string[];
      const uniqueYears = [...new Set(data.map(a => a.batch_year).filter(Boolean))] as number[];
      setCourses(uniqueCourses);
      setBatchYears(uniqueYears.sort((a, b) => b - a));
    }
    setLoading(false);
  };

  const createAnnouncement = async () => {
    const { error } = await supabase
      .from('announcements')
      .insert({
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        category: newAnnouncement.category,
        target_type: newAnnouncement.target_type,
        target_course: newAnnouncement.target_type === 'course' ? newAnnouncement.target_course : null,
        target_batch_year: newAnnouncement.target_type === 'batch_year' ? parseInt(newAnnouncement.target_batch_year) : null,
        published: true,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });

    if (!error) {
      setShowCreateModal(false);
      setNewAnnouncement({
        title: '',
        content: '',
        category: 'alumni_events',
        target_type: 'all',
        target_course: '',
        target_batch_year: '',
      });
      fetchAnnouncements();
    }
  };

  const toggleAnnouncementStatus = async (id: string, currentStatus: boolean) => {
    await supabase
      .from('announcements')
      .update({ published: !currentStatus })
      .eq('id', id);
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      await supabase.from('announcements').delete().eq('id', id);
      fetchAnnouncements();
    }
  };

  const applyFilters = () => {
    let filtered = [...alumni];
    
    if (filters.course) {
      filtered = filtered.filter(a => a.course === filters.course);
    }
    if (filters.batch_year) {
      filtered = filtered.filter(a => a.batch_year === parseInt(filters.batch_year));
    }
    if (filters.employment_status) {
      filtered = filtered.filter(a => a.employment_status === filters.employment_status);
    }
    if (filters.alignment) {
      filtered = filtered.filter(a => a.career_alignment_status === filters.alignment);
    }
    
    setFilteredAlumni(filtered);
  };

  const resetFilters = () => {
    setFilters({ course: '', batch_year: '', employment_status: '', alignment: '' });
    setFilteredAlumni(alumni);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      alumni_events: '🎉 Alumni Event',
      job_fairs: '💼 Job Fair',
      seminars: '📚 Seminar',
      career_opportunities: '🎯 Career Opportunity',
    };
    return labels[category] || category;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#800000] to-[#a10000] rounded-xl flex items-center justify-center text-white font-bold">ADMIN</div>
              <h1 className="text-xl font-bold text-gray-900">GradTrack Admin</h1>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-3xl mb-2">👥</div>
            <p className="text-sm text-gray-500">Total Alumni</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-3xl mb-2">💼</div>
            <p className="text-sm text-gray-500">Employed</p>
            <p className="text-3xl font-bold text-emerald-600">{stats.employed}</p>
            <p className="text-sm text-gray-500">{stats.total ? ((stats.employed / stats.total) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-sm text-gray-500">Unemployed</p>
            <p className="text-3xl font-bold text-amber-600">{stats.unemployed}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-3xl mb-2">🎯</div>
            <p className="text-sm text-gray-500">In-Field</p>
            <p className="text-3xl font-bold text-blue-600">{stats.inField}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-3xl mb-2">🔄</div>
            <p className="text-sm text-gray-500">Out-of-Field</p>
            <p className="text-3xl font-bold text-purple-600">{stats.outOfField}</p>
          </div>
        </div>

        {/* Course Statistics */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Employment by Course</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Course</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Total Alumni</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Employed</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Employment Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(stats.byCourse).map(([course, data]) => (
                  <tr key={course} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{course}</td>
                    <td className="px-4 py-3 text-gray-600">{data.total}</td>
                    <td className="px-4 py-3 text-gray-600">{data.employed}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${data.total ? (data.employed / data.total) * 100 : 0}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{data.total ? ((data.employed / data.total) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Announcements Management */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-[#6a0000] transition"
            >
              + Create Announcement
            </button>
          </div>

          <div className="space-y-4">
            {announcements.map(ann => (
              <div key={ann.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700">
                        {getCategoryLabel(ann.category)}
                      </span>
                      <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700">
                        Target: {ann.target_type === 'all' ? 'All Alumni' : ann.target_type === 'course' ? ann.target_course : `Batch ${ann.target_batch_year}`}
                      </span>
                      {!ann.published && <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-red-100 text-red-700">Draft</span>}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{ann.title}</h3>
                    <p className="text-gray-600 mb-2">{ann.content}</p>
                    <p className="text-xs text-gray-400">{new Date(ann.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAnnouncementStatus(ann.id, ann.published)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      {ann.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      onClick={() => deleteAnnouncement(ann.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alumni Table with Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Alumni Directory</h2>
          
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <select
              value={filters.course}
              onChange={e => setFilters({ ...filters, course: e.target.value })}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Courses</option>
              {courses.map(course => <option key={course} value={course}>{course}</option>)}
            </select>
            
            <select
              value={filters.batch_year}
              onChange={e => setFilters({ ...filters, batch_year: e.target.value })}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Batch Years</option>
              {batchYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            
            <select
              value={filters.employment_status}
              onChange={e => setFilters({ ...filters, employment_status: e.target.value })}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Employment Status</option>
              <option value="Employed">Employed</option>
              <option value="Unemployed">Unemployed</option>
              <option value="Self-Employed">Self-Employed</option>
              <option value="Freelancer">Freelancer</option>
            </select>
            
            <select
              value={filters.alignment}
              onChange={e => setFilters({ ...filters, alignment: e.target.value })}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Alignment</option>
              <option value="In-Field">In-Field</option>
              <option value="Out-of-Field">Out-of-Field</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          
          <div className="flex gap-2 mb-4">
            <button onClick={applyFilters} className="px-4 py-2 bg-[#800000] text-white rounded-lg">Apply Filters</button>
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg">Reset</button>
          </div>
          
          {/* Alumni Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Course</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Batch Year</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Employment Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Job Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Company</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Alignment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAlumni.map(alum => (
                  <tr key={alum.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{alum.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{alum.course}</td>
                    <td className="px-4 py-3 text-gray-600">{alum.batch_year}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        alum.employment_status === 'Employed' ? 'bg-emerald-100 text-emerald-700' :
                        alum.employment_status === 'Unemployed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {alum.employment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{alum.job_title || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{alum.company || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        alum.career_alignment_status === 'In-Field' ? 'bg-green-100 text-green-700' :
                        alum.career_alignment_status === 'Out-of-Field' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {alum.career_alignment_status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold">Create Announcement</h3>
            </div>
            <div className="p-6 space-y-4">
              <input
                value={newAnnouncement.title}
                onChange={e => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                placeholder="Announcement Title"
                className="w-full px-4 py-2 border rounded-lg"
              />
              
              <textarea
                value={newAnnouncement.content}
                onChange={e => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                placeholder="Announcement Content"
                rows={4}
                className="w-full px-4 py-2 border rounded-lg"
              />
              
              <select
                value={newAnnouncement.category}
                onChange={e => setNewAnnouncement({...newAnnouncement, category: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="alumni_events">🎉 Alumni Events</option>
                <option value="job_fairs">💼 Job Fairs</option>
                <option value="seminars">📚 Seminars</option>
                <option value="career_opportunities">🎯 Career Opportunities</option>
              </select>
              
              <select
                value={newAnnouncement.target_type}
                onChange={e => setNewAnnouncement({...newAnnouncement, target_type: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="all">Send to All Alumni</option>
                <option value="course">Send by Course</option>
                <option value="batch_year">Send by Batch Year</option>
              </select>
              
              {newAnnouncement.target_type === 'course' && (
                <select
                  value={newAnnouncement.target_course}
                  onChange={e => setNewAnnouncement({...newAnnouncement, target_course: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select Course</option>
                  {courses.map(course => <option key={course} value={course}>{course}</option>)}
                </select>
              )}
              
              {newAnnouncement.target_type === 'batch_year' && (
                <select
                  value={newAnnouncement.target_batch_year}
                  onChange={e => setNewAnnouncement({...newAnnouncement, target_batch_year: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select Batch Year</option>
                  {batchYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              )}
              
              <div className="flex gap-3 pt-4">
                <button onClick={createAnnouncement} className="flex-1 px-4 py-2 bg-[#800000] text-white rounded-lg">Create</button>
                <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
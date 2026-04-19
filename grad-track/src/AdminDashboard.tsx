// src/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts';

// ==================== TYPES ====================
interface AlumniProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  course: string | null;
  batch_year: number | null;
  company: string | null;
  job_title: string | null;
  industry: string | null;
  location: string | null;
  employment_status: string | null;
  linkedin_url: string | null;
  career_alignment_status: string | null;
  ai_confidence_score: number | null;
  profile_completion: number;
  registered_at?: string; // Changed from created_at to match your schema
  updated_at?: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  target_type: string;
  target_course: string | null;
  target_batch_year: number | null;
  created_at: string;
  published: boolean;
}

interface Activity {
  id: string;
  user_id: string;
  activity_type: string;
  description: string;
  created_at: string;
  full_name?: string; // Changed to handle joined data differently
}

// ==================== REUSABLE COMPONENTS ====================
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-6 ${className}`}>
    {children}
  </div>
);

const StatCard: React.FC<{ title: string; value: number; icon: string; color: string; trend?: number }> = ({ 
  title, value, icon, color, trend 
}) => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-2xl`}>
        {icon}
      </div>
      {trend !== undefined && (
        <span className={`text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <h3 className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</h3>
    <p className="text-sm text-gray-500 mt-1">{title}</p>
  </div>
);

const Button: React.FC<{
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}> = ({ children, variant = 'primary', size = 'md', onClick, disabled, loading, className = '' }) => {
  const variants = {
    primary: 'bg-gradient-to-r from-[#800000] to-[#a10000] hover:from-[#6a0000] hover:to-[#8a0000] text-white',
    secondary: 'bg-white border-2 border-gray-200 hover:border-[#800000]/50 text-gray-700',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    success: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${variants[variant]} ${sizes[size]} font-semibold rounded-xl transition-all duration-300 active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : children}
    </button>
  );
};

const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${sizes[size]} w-full bg-white rounded-2xl shadow-2xl`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// ==================== MAIN ADMIN DASHBOARD ====================
export default function AdminDashboard({ session }: { session: Session }) {
  const [alumni, setAlumni] = useState<AlumniProfile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    category: 'alumni_events',
    target_type: 'all',
    target_course: '',
    target_batch_year: '',
  });
  const [filterCourse, setFilterCourse] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [courses, setCourses] = useState<string[]>([]);
  const [batchYears, setBatchYears] = useState<number[]>([]);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    employed: 0,
    unemployed: 0,
    inField: 0,
    outOfField: 0,
  });

  // Chart data
  const [employmentChartData, setEmploymentChartData] = useState([
    { name: 'Employed', value: 0, color: '#10b981' },
    { name: 'Unemployed', value: 0, color: '#ef4444' },
  ]);
  const [alignmentChartData, setAlignmentChartData] = useState([
    { name: 'In-Field', value: 0, color: '#800000' },
    { name: 'Out-of-Field', value: 0, color: '#f59e0b' },
    { name: 'Pending', value: 0, color: '#6b7280' },
  ]);
  const [courseStats, setCourseStats] = useState<{ course: string; total: number; inField: number; rate: number }[]>([]);
  const [weeklyActivities, setWeeklyActivities] = useState<{ day: string; count: number }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      console.log("🔍 Fetching alumni profiles...");
      
      // FIX 1: Remove order by created_at since column doesn't exist yet
      // Add fallback sorting by registered_at or id
      const { data: alumniData, error: alumniError } = await supabase
        .from('alumni_profiles')
        .select('*')
        .order('registered_at', { ascending: false }); // Changed from 'created_at' to 'registered_at'
      
      if (alumniError) {
        console.error("❌ Error fetching alumni:", alumniError);
        console.error("❌ Error details:", alumniError.message, alumniError.details, alumniError.hint);
        
        // Fallback: try fetching without ordering
        if (alumniError.message.includes('column') && alumniError.message.includes('does not exist')) {
          console.log("🔄 Trying fallback query without ordering...");
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('alumni_profiles')
            .select('*');
          
          if (!fallbackError && fallbackData) {
            setAlumni(fallbackData);
            processAlumniData(fallbackData);
          } else {
            console.error("❌ Fallback also failed:", fallbackError);
            setAlumni([]);
          }
        }
      } else if (alumniData && alumniData.length > 0) {
        console.log("✅ Alumni data received:", alumniData?.length, "records");
        console.log("📊 Alumni data sample:", alumniData?.slice(0, 2));
        setAlumni(alumniData);
        processAlumniData(alumniData);
      } else {
        console.log("⚠️ No alumni data found");
        setAlumni([]);
        resetStats();
      }
      
      console.log("🔍 Fetching announcements...");
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (announcementsError) {
        console.error("❌ Error fetching announcements:", announcementsError);
      } else {
        console.log("✅ Announcements received:", announcementsData?.length);
      }
      if (announcementsData) setAnnouncements(announcementsData);
      
      console.log("🔍 Fetching activities...");
      // FIX 2: Fix the activities query to properly join with alumni_profiles
      // First, get activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('alumni_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (activitiesError) {
        console.error("❌ Error fetching activities:", activitiesError);
        console.error("❌ Error details:", activitiesError.message);
        
        // Try to get activities without the join
        const { data: fallbackActivities, error: fallbackError } = await supabase
          .from('alumni_activities')
          .select('*')
          .limit(20);
        
        if (!fallbackError && fallbackActivities) {
          console.log("✅ Activities received (without join):", fallbackActivities?.length);
          // Get user names separately
          const userIds = [...new Set(fallbackActivities.map(a => a.user_id).filter(Boolean))];
          if (userIds.length > 0) {
            const { data: userNames } = await supabase
              .from('alumni_profiles')
              .select('user_id, full_name')
              .in('user_id', userIds);
            
            const nameMap = new Map(userNames?.map(u => [u.user_id, u.full_name]) || []);
            const activitiesWithNames = fallbackActivities.map(a => ({
              ...a,
              full_name: nameMap.get(a.user_id) || 'Someone'
            }));
            setActivities(activitiesWithNames);
          } else {
            setActivities(fallbackActivities);
          }
        } else {
          setActivities([]);
        }
      } else if (activitiesData && activitiesData.length > 0) {
        console.log("✅ Activities received:", activitiesData?.length);
        // Get user names for activities
        const userIds = [...new Set(activitiesData.map(a => a.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: userNames } = await supabase
            .from('alumni_profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);
          
          const nameMap = new Map(userNames?.map(u => [u.user_id, u.full_name]) || []);
          const activitiesWithNames = activitiesData.map(a => ({
            ...a,
            full_name: nameMap.get(a.user_id) || 'Someone'
          }));
          setActivities(activitiesWithNames);
        } else {
          setActivities(activitiesData);
        }
        
        // Calculate weekly activity trends
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          return date.toISOString().split('T')[0];
        }).reverse();
        
        const weeklyData = last7Days.map(day => {
          const count = activitiesData?.filter(a => a.created_at?.startsWith(day)).length || 0;
          return { day: day.slice(5), count };
        });
        setWeeklyActivities(weeklyData);
      } else {
        setActivities([]);
        setWeeklyActivities(Array.from({ length: 7 }, (_, i) => ({ 
          day: new Date(Date.now() - i * 86400000).toISOString().slice(5, 10), 
          count: 0 
        })).reverse());
      }
      
    } catch (error) {
      console.error("❌ CRITICAL ERROR in fetchData:", error);
    } finally {
      setLoading(false);
      console.log("🏁 fetchData completed, loading set to false");
    }
  };

  const processAlumniData = (alumniData: AlumniProfile[]) => {
    const total = alumniData.length;
    const employed = alumniData.filter(a => a.employment_status === 'Employed').length;
    const unemployed = alumniData.filter(a => a.employment_status === 'Unemployed').length;
    const inField = alumniData.filter(a => a.career_alignment_status === 'In-Field').length;
    const outOfField = alumniData.filter(a => a.career_alignment_status === 'Out-of-Field').length;
    
    setStats({ total, employed, unemployed, inField, outOfField });
    setEmploymentChartData([
      { name: 'Employed', value: employed, color: '#10b981' },
      { name: 'Unemployed', value: unemployed, color: '#ef4444' },
    ]);
    setAlignmentChartData([
      { name: 'In-Field', value: inField, color: '#800000' },
      { name: 'Out-of-Field', value: outOfField, color: '#f59e0b' },
      { name: 'Pending', value: total - inField - outOfField, color: '#6b7280' },
    ]);
    
    const uniqueCourses = [...new Set(alumniData.map(a => a.course).filter(Boolean))] as string[];
    const uniqueBatchYears = [...new Set(alumniData.map(a => a.batch_year).filter(Boolean))] as number[];
    setCourses(uniqueCourses);
    setBatchYears(uniqueBatchYears.sort((a, b) => b - a));
    
    const courseStatsData = uniqueCourses.map(course => {
      const courseAlumni = alumniData.filter(a => a.course === course);
      const total = courseAlumni.length;
      const inField = courseAlumni.filter(a => a.career_alignment_status === 'In-Field').length;
      const rate = total > 0 ? (inField / total) * 100 : 0;
      return { course: course || 'Unknown', total, inField, rate };
    });
    setCourseStats(courseStatsData);
  };

  const resetStats = () => {
    setStats({ total: 0, employed: 0, unemployed: 0, inField: 0, outOfField: 0 });
    setEmploymentChartData([
      { name: 'Employed', value: 0, color: '#10b981' },
      { name: 'Unemployed', value: 0, color: '#ef4444' },
    ]);
    setAlignmentChartData([
      { name: 'In-Field', value: 0, color: '#800000' },
      { name: 'Out-of-Field', value: 0, color: '#f59e0b' },
      { name: 'Pending', value: 0, color: '#6b7280' },
    ]);
    setCourses([]);
    setBatchYears([]);
    setCourseStats([]);
  };

  const createAnnouncement = async () => {
    const { error } = await supabase.from('announcements').insert({
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      category: newAnnouncement.category,
      target_type: newAnnouncement.target_type,
      target_course: newAnnouncement.target_type === 'course' ? newAnnouncement.target_course : null,
      target_batch_year: newAnnouncement.target_type === 'batch_year' ? parseInt(newAnnouncement.target_batch_year) : null,
      published: true,
      created_by: session.user.id,
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
      fetchData();
    }
  };

  const toggleAnnouncementStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('announcements').update({ published: !currentStatus }).eq('id', id);
    fetchData();
  };

  const deleteAnnouncement = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      await supabase.from('announcements').delete().eq('id', id);
      fetchData();
    }
  };

  const getFilteredAlumni = () => {
    let filtered = [...alumni];
    console.log("📊 Filtering - Original count:", alumni.length);
    console.log("📊 Filter - Course:", filterCourse || "All");
    console.log("📊 Filter - Batch:", filterBatch || "All");
    console.log("📊 Filter - Status:", filterStatus || "All");
    
    if (filterCourse) filtered = filtered.filter(a => a.course === filterCourse);
    if (filterBatch) filtered = filtered.filter(a => a.batch_year === parseInt(filterBatch));
    if (filterStatus) filtered = filtered.filter(a => a.employment_status === filterStatus);
    
    console.log("📊 Filtered count:", filtered.length);
    return filtered;
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

  const getTargetLabel = (ann: Announcement) => {
    if (ann.target_type === 'all') return 'All Alumni';
    if (ann.target_type === 'course') return `Course: ${ann.target_course}`;
    if (ann.target_type === 'batch_year') return `Batch: ${ann.target_batch_year}`;
    return 'All Alumni';
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      login: '🔐',
      profile_update: '✏️',
      employment_update: '💼',
      announcement_view: '📢',
      avatar_upload: '📷',
    };
    return icons[type] || '📌';
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        localStorage.clear();
        sessionStorage.clear();
      }
      window.location.href = '/';
    } catch (err) {
      console.error("Sign out error:", err);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredAlumni = getFilteredAlumni();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#800000] to-[#a10000] rounded-xl flex items-center justify-center text-white font-bold text-lg">
                GT
              </div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signOutLoading}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
            >
              {signOutLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing out...
                </>
              ) : (
                'Sign Out'
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard title="Total Alumni" value={stats.total} icon="👥" color="bg-blue-100" />
          <StatCard title="Employed" value={stats.employed} icon="💼" color="bg-emerald-100" />
          <StatCard title="Unemployed" value={stats.unemployed} icon="🔍" color="bg-red-100" />
          <StatCard title="In-Field" value={stats.inField} icon="🎯" color="bg-purple-100" />
          <StatCard title="Out-of-Field" value={stats.outOfField} icon="🔄" color="bg-amber-100" />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Employment Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={employmentChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {employmentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Career Alignment</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={alignmentChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {alignmentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Weekly Activity Trend Chart */}
        <Card className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Weekly Activity Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyActivities}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#800000" name="Activities" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Per-Course Statistics */}
        {courseStats.length > 0 && (
          <Card className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Per-Course Alignment Statistics</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Course</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Total Alumni</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">In-Field</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Alignment Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {courseStats.map((course, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{course.course}</td>
                      <td className="px-4 py-3 text-gray-600">{course.total}</td>
                      <td className="px-4 py-3 text-gray-600">{course.inField}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#800000] rounded-full" style={{ width: `${course.rate}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-gray-700">{course.rate.toFixed(1)}%</span>
                        </div>
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Recent Activities */}
        <Card className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Alumni Activities</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recent activities</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="text-2xl">{getActivityIcon(activity.activity_type)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">{activity.full_name || 'Someone'}</span>{' '}
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-400">{activity.created_at ? new Date(activity.created_at).toLocaleString() : 'Recently'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Announcements Management */}
        <Card className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">Announcements</h3>
            <Button onClick={() => setShowCreateModal(true)}>+ Create Announcement</Button>
          </div>

          <div className="space-y-4">
            {announcements.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No announcements yet</p>
            ) : (
              announcements.map(ann => (
                <div key={ann.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-2">
                        <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700">
                          {getCategoryLabel(ann.category)}
                        </span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700">
                          Target: {getTargetLabel(ann)}
                        </span>
                        {!ann.published && <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-red-100 text-red-700">Draft</span>}
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 mb-1">{ann.title}</h4>
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
              ))
            )}
          </div>
        </Card>

        {/* Alumni Table */}
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Alumni Directory</h3>
          
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <select
              value={filterCourse}
              onChange={e => setFilterCourse(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Courses</option>
              {courses.map(course => <option key={course} value={course}>{course}</option>)}
            </select>
            
            <select
              value={filterBatch}
              onChange={e => setFilterBatch(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Batch Years</option>
              {batchYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Employment Status</option>
              <option value="Employed">Employed</option>
              <option value="Unemployed">Unemployed</option>
              <option value="Self-Employed">Self-Employed</option>
              <option value="Freelancer">Freelancer</option>
            </select>
          </div>
          
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
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Career Alignment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAlumni.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-5xl mb-3">👥</div>
                        <p className="text-gray-500 font-medium">No alumni found</p>
                        <p className="text-sm text-gray-400 mt-1">Alumni will appear here after they register</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAlumni.map(alum => (
                    <tr key={alum.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{alum.full_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600">{alum.course || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600">{alum.batch_year || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          alum.employment_status === 'Employed' ? 'bg-emerald-100 text-emerald-700' :
                          alum.employment_status === 'Unemployed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {alum.employment_status || 'N/A'}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* Create Announcement Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Announcement" size="lg">
        <div className="space-y-4">
          <input
            type="text"
            value={newAnnouncement.title}
            onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
            placeholder="Announcement Title"
            className="w-full px-4 py-2 border rounded-lg"
          />
          <textarea
            value={newAnnouncement.content}
            onChange={e => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
            placeholder="Announcement Content"
            rows={4}
            className="w-full px-4 py-2 border rounded-lg"
          />
          <select
            value={newAnnouncement.category}
            onChange={e => setNewAnnouncement({ ...newAnnouncement, category: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="alumni_events">🎉 Alumni Events</option>
            <option value="job_fairs">💼 Job Fairs</option>
            <option value="seminars">📚 Seminars</option>
            <option value="career_opportunities">🎯 Career Opportunities</option>
          </select>
          <select
            value={newAnnouncement.target_type}
            onChange={e => setNewAnnouncement({ ...newAnnouncement, target_type: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="all">Send to All Alumni</option>
            <option value="course">Send by Course</option>
            <option value="batch_year">Send by Batch Year</option>
          </select>
          {newAnnouncement.target_type === 'course' && (
            <select
              value={newAnnouncement.target_course}
              onChange={e => setNewAnnouncement({ ...newAnnouncement, target_course: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="">Select Course</option>
              {courses.map(course => <option key={course} value={course}>{course}</option>)}
            </select>
          )}
          {newAnnouncement.target_type === 'batch_year' && (
            <select
              value={newAnnouncement.target_batch_year}
              onChange={e => setNewAnnouncement({ ...newAnnouncement, target_batch_year: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="">Select Batch Year</option>
              {batchYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          )}
          <div className="flex gap-3 pt-4">
            <Button onClick={createAnnouncement} className="flex-1">Create</Button>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
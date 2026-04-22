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
  registered_at?: string;
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
  full_name?: string;
}

// ==================== COMPONENTS ====================
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-xl ${className}`}>
    {children}
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
    primary: 'bg-gradient-to-r from-[#800000] to-[#a10000] hover:from-[#6a0000] hover:to-[#8a0000] text-white shadow-md hover:shadow-lg transition-all duration-300',
    secondary: 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-[#800000]/50 text-gray-700 dark:text-gray-300',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md',
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
      <div className={`${sizes[size]} w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// ==================== MAIN ADMIN DASHBOARD ====================
export default function AdminDashboard({ session }: { session: Session }) {
  // ============================================================
  // SECTION 1: STATE DECLARATIONS
  // ============================================================
  
  // 1.1 DATA STATE
  const [alumni, setAlumni] = useState<AlumniProfile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 1.2 UI STATE
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  // 1.3 FORM STATE
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    category: 'alumni_events',
    target_type: 'all',
    target_course: '',
    target_batch_year: '',
  });
  
  // 1.4 FILTER STATE
  const [filterCourse, setFilterCourse] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [courses, setCourses] = useState<string[]>([]);
  const [batchYears, setBatchYears] = useState<number[]>([]);
  
  // 1.5 ANNOUNCEMENT FILTER STATE
  const [announcementFilterType, setAnnouncementFilterType] = useState<'all' | 'course' | 'batch_year'>('all');
  const [announcementFilterCourse, setAnnouncementFilterCourse] = useState('');
  const [announcementFilterBatchYear, setAnnouncementFilterBatchYear] = useState('');
  
  // 1.6 CHART STATE
  const [chartKey, setChartKey] = useState(0);
  
  // 1.7 PROFILE STATE
  const [adminProfile, setAdminProfile] = useState({
    full_name: session.user.user_metadata?.full_name || 'Administrator',
    email: session.user.email || '',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailAnnouncements: true,
    emailActivityDigest: false,
    emailSecurityAlerts: true
  });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // 1.8 STATS STATE - These 5 numbers drive all cards
  const [stats, setStats] = useState({
    total: 0,
    employed: 0,
    unemployed: 0,
    inField: 0,
    outOfField: 0,
  });

  // 1.9 CHART DATA STATE
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

  // ============================================================
  // SECTION 2: useEffect HOOKS
  // ============================================================
  
  // 2.1 INITIALIZE DARK MODE
  useEffect(() => {
    const savedTheme = localStorage.getItem('adminTheme');
    const isDark = savedTheme === 'dark';
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // 2.2 LOAD INITIAL DATA
  useEffect(() => {
    fetchData();
    const savedSettings = localStorage.getItem('adminNotificationSettings');
    if (savedSettings) {
      setNotificationSettings(JSON.parse(savedSettings));
    }
  }, []);

  // 2.3 FORCE CHART RE-RENDER
  useEffect(() => {
    setChartKey(prev => prev + 1);
  }, [employmentChartData, alignmentChartData]);

  // 2.4 SAVE NOTIFICATION SETTINGS
  useEffect(() => {
    localStorage.setItem('adminNotificationSettings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // ============================================================
  // SECTION 3: HELPER FUNCTIONS
  // ============================================================
  
  // 3.1 SHOW TOAST MESSAGE
  const showSettingsToast = (message: string, type: 'success' | 'error' | 'info') => {
    setSettingsMessage({ type, text: message });
    setTimeout(() => setSettingsMessage(null), 3000);
  };

  // 3.2 TOGGLE DARK MODE
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('adminTheme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('adminTheme', 'light');
    }
    showSettingsToast(`${newDarkMode ? 'Dark' : 'Light'} mode enabled`, 'success');
  };

  // 3.3 UPDATE ADMIN PROFILE
  const updateAdminProfile = async (fullName: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });
      if (error) throw error;
      setAdminProfile(prev => ({ ...prev, full_name: fullName }));
      showSettingsToast('Profile updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showSettingsToast('Failed to update profile', 'error');
    }
  };

  // 3.4 UPDATE PASSWORD WITH VERIFICATION
  const updatePassword = async () => {
    if (!passwordForm.currentPassword) {
      showSettingsToast('Please enter your current password', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showSettingsToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showSettingsToast('New passwords do not match', 'error');
      return;
    }
    if (passwordForm.newPassword === passwordForm.currentPassword) {
      showSettingsToast('New password must be different from current password', 'error');
      return;
    }

    setIsChangingPassword(true);
    showSettingsToast('Verifying current password...', 'info');
    
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminProfile.email,
        password: passwordForm.currentPassword,
      });

      if (signInError) {
        showSettingsToast('Current password is incorrect', 'error');
        return;
      }
      
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (updateError) {
        showSettingsToast('Failed to update password', 'error');
        return;
      }

      setShowChangePassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showSettingsToast('Password updated successfully!', 'success');
      
    } catch (error) {
      showSettingsToast('An unexpected error occurred', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ============================================================
  // SECTION 4: DATA FETCHING FUNCTIONS
  // ============================================================
  
  // 4.1 MAIN DATA FETCHER
  const fetchData = async () => {
    setLoading(true);
    
    try {
      // FETCH alumni profiles
      const { data: alumniData, error: alumniError } = await supabase
        .from('alumni_profiles')
        .select('*');
      
      if (alumniError) {
        console.error("❌ Error fetching alumni:", alumniError);
        setAlumni([]);
        resetStats();
      } else if (alumniData && alumniData.length > 0) {
        setAlumni(alumniData);
        processAlumniData(alumniData);
      } else {
        setAlumni([]);
        resetStats();
      }
      
      // FETCH announcements
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!announcementsError && announcementsData) setAnnouncements(announcementsData);
      
      // FETCH activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('alumni_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (activitiesError) {
        setActivities([]);
      } else if (activitiesData && activitiesData.length > 0) {
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
      }
      
    } catch (error) {
      console.error("❌ CRITICAL ERROR in fetchData:", error);
    } finally {
      setLoading(false);
    }
  };

  // 4.2 PROCESS ALUMNI DATA INTO STATS
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

  // 4.3 RESET ALL STATS TO ZERO
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

  // ============================================================
  // SECTION 5: ANNOUNCEMENT FUNCTIONS
  // ============================================================
  
  // 5.1 CREATE ANNOUNCEMENT
  const createAnnouncement = async () => {
    let targetCourse = null;
    let targetBatchYear = null;
    
    if (newAnnouncement.target_type === 'course') {
      targetCourse = newAnnouncement.target_course;
      targetBatchYear = newAnnouncement.target_batch_year ? parseInt(newAnnouncement.target_batch_year) : null;
    } else if (newAnnouncement.target_type === 'batch_year') {
      targetBatchYear = parseInt(newAnnouncement.target_batch_year);
      targetCourse = newAnnouncement.target_course || null;
    } else if (newAnnouncement.target_type === 'all') {
      targetCourse = newAnnouncement.target_course || null;
      targetBatchYear = newAnnouncement.target_batch_year ? parseInt(newAnnouncement.target_batch_year) : null;
    }
    
    const { error } = await supabase.from('announcements').insert({
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      category: newAnnouncement.category,
      target_type: newAnnouncement.target_type,
      target_course: targetCourse,
      target_batch_year: targetBatchYear,
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
      showSettingsToast('Announcement created successfully!', 'success');
    } else {
      showSettingsToast('Failed to create announcement', 'error');
    }
  };

  // 5.2 TOGGLE ANNOUNCEMENT STATUS
  const toggleAnnouncementStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('announcements').update({ published: !currentStatus }).eq('id', id);
    fetchData();
  };

  // 5.3 DELETE ANNOUNCEMENT
  const deleteAnnouncement = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      await supabase.from('announcements').delete().eq('id', id);
      fetchData();
    }
  };

  // ============================================================
  // SECTION 6: FILTER FUNCTIONS
  // ============================================================
  
  // 6.1 FILTER ALUMNI
  const getFilteredAlumni = () => {
    let filtered = [...alumni];
    if (filterCourse) filtered = filtered.filter(a => a.course === filterCourse);
    if (filterBatch) filtered = filtered.filter(a => a.batch_year === parseInt(filterBatch));
    if (filterStatus) filtered = filtered.filter(a => a.employment_status === filterStatus);
    return filtered;
  };

  // 6.2 FILTER ANNOUNCEMENTS
  const getFilteredAnnouncements = () => {
    let filtered = [...announcements];
    
    if (announcementFilterType === 'all') {
      if (announcementFilterCourse) {
        filtered = filtered.filter(ann => 
          ann.target_type === 'all' && 
          (ann.target_course === announcementFilterCourse || !ann.target_course)
        );
      }
      if (announcementFilterBatchYear) {
        filtered = filtered.filter(ann => 
          ann.target_type === 'all' && 
          (ann.target_batch_year === parseInt(announcementFilterBatchYear) || !ann.target_batch_year)
        );
      }
      if (!announcementFilterCourse && !announcementFilterBatchYear) {
        filtered = filtered.filter(ann => ann.target_type === 'all');
      }
    } 
    else if (announcementFilterType === 'course') {
      filtered = filtered.filter(ann => ann.target_type === 'course');
      if (announcementFilterCourse) {
        filtered = filtered.filter(ann => ann.target_course === announcementFilterCourse);
      }
      if (announcementFilterBatchYear) {
        filtered = filtered.filter(ann => ann.target_batch_year === parseInt(announcementFilterBatchYear));
      }
    } 
    else if (announcementFilterType === 'batch_year') {
      filtered = filtered.filter(ann => ann.target_type === 'batch_year');
      if (announcementFilterBatchYear) {
        filtered = filtered.filter(ann => ann.target_batch_year === parseInt(announcementFilterBatchYear));
      }
      if (announcementFilterCourse) {
        filtered = filtered.filter(ann => ann.target_course === announcementFilterCourse);
      }
    }
    
    return filtered;
  };

  // ============================================================
  // SECTION 7: UI HELPER FUNCTIONS
  // ============================================================
  
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
    if (ann.target_type === 'all') {
      if (ann.target_course && ann.target_batch_year) {
        return `Course: ${ann.target_course}, Batch: ${ann.target_batch_year}`;
      } else if (ann.target_course) {
        return `Course: ${ann.target_course}`;
      } else if (ann.target_batch_year) {
        return `Batch: ${ann.target_batch_year}`;
      }
      return 'All Alumni';
    }
    if (ann.target_type === 'course') {
      return ann.target_batch_year ? `Course: ${ann.target_course}, Batch: ${ann.target_batch_year}` : `Course: ${ann.target_course}`;
    }
    if (ann.target_type === 'batch_year') {
      return ann.target_course ? `Batch: ${ann.target_batch_year}, Course: ${ann.target_course}` : `Batch: ${ann.target_batch_year}`;
    }
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

  // 7.1 SIGN OUT
  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      console.error("Sign out error:", err);
      window.location.href = '/';
    }
  };

  // ============================================================
  // SECTION 8: LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // SECTION 9: DATA PREPARATION FOR RENDER
  // ============================================================
  const filteredAlumni = getFilteredAlumni();
  const filteredAnnouncements = getFilteredAnnouncements();
  const nonZeroEmploymentData = employmentChartData.filter(item => item.value > 0);
  const nonZeroAlignmentData = alignmentChartData.filter(item => item.value > 0);

  // ============================================================
  // SECTION 10: MAIN UI RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      
      {/* ========================================================== */}
      {/* BLOCK 1: NAVIGATION BAR */}
      {/* ========================================================== */}
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            
            {/* LEFT: Logo and Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#800000] to-[#a10000] rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg sm:text-xl">GT</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Alumni Management System</p>
              </div>
            </div>

            {/* RIGHT: Date and Profile */}
            <div className="flex items-center gap-4">
              {/* Date Badge */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-full border border-gray-100 dark:border-gray-600">
                <svg className="w-4 h-4 text-[#800000] dark:text-[#a10000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="group flex items-center gap-2 px-2 py-2 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-[#800000]/30 transition-all duration-300 shadow-sm hover:shadow-md"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-[#800000] to-[#a10000] rounded-full flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">
                      {adminProfile.full_name?.[0]?.toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-semibold text-gray-800 dark:text-white">{adminProfile.full_name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{adminProfile.email?.split('@')[0]}</p>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-300 ${showProfileDropdown ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showProfileDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                      <div className="p-4 bg-gradient-to-r from-[#800000]/5 to-transparent border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-[#800000] to-[#a10000] rounded-full flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-lg">{adminProfile.full_name?.[0]?.toUpperCase() || 'A'}</span>
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{adminProfile.full_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{adminProfile.email}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold rounded-full">Admin Access</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2">
                        <button onClick={() => { setShowProfileDropdown(false); setShowProfileModal(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 group">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-[#800000]/10 transition-colors">
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-[#800000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 text-left"><p className="text-sm font-medium">My Profile</p><p className="text-xs text-gray-400">View and edit your profile</p></div>
                        </button>

                        <button onClick={() => { setShowProfileDropdown(false); setShowSettingsModal(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 group">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center group-hover:bg-[#800000]/10 transition-colors">
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-[#800000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 text-left"><p className="text-sm font-medium">Settings</p><p className="text-xs text-gray-400">Notifications & preferences</p></div>
                        </button>

                        <div className="my-2 border-t border-gray-100 dark:border-gray-700" />

                        <button onClick={handleSignOut} disabled={signOutLoading} className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 group">
                          <div className="w-8 h-8 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/50 transition-colors">
                            {signOutLoading ? <div className="w-4 h-4 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
                          </div>
                          <div className="flex-1 text-left"><p className="text-sm font-medium">Sign Out</p><p className="text-xs text-red-400">End your session</p></div>
                          {!signOutLoading && <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                        </button>
                      </div>

                      <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">GradTrack v1.0 | Alumni Management System</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ========================================================== */}
      {/* BLOCK 2: TOAST MESSAGES */}
      {/* ========================================================== */}
      {settingsMessage && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium ${settingsMessage.type === 'success' ? 'bg-emerald-500 text-white' : settingsMessage.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
            {settingsMessage.type === 'success' ? '✅' : settingsMessage.type === 'error' ? '❌' : 'ℹ️'} {settingsMessage.text}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* BLOCK 3: MAIN CONTENT */}
      {/* ========================================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ======================================================== */}
        {/* ROW 1: PROFESSIONAL STATS CARDS (DRIBBBLE STYLE) */}
        {/* ======================================================== */}
                {/* ======================================================== */}
        {/* ROW 1: STATS CARDS - MINIMALIST DRIBBBLE STYLE */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
          
          {/* CARD 1: Total Alumni */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">This month</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.total}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Alumni</p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">+0%</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">from last month</span>
              </div>
            </div>
          </div>

          {/* CARD 2: Employed */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">Employed</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.employed}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Currently Working</p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.total > 0 ? (stats.employed / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* CARD 3: Unemployed */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">Seeking</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.unemployed}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Currently Unemployed</p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${stats.total > 0 ? (stats.unemployed / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* CARD 4: In-Field */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">Aligned</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.inField}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Career Aligned</p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${stats.total > 0 ? (stats.inField / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* CARD 5: Out-of-Field */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">Misaligned</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.outOfField}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Career Misaligned</p>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${stats.total > 0 ? (stats.outOfField / stats.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* ROW 2: CHARTS - 2 COLUMN GRID */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* CHART 1: Employment Status Pie Chart */}
          <Card>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">Employment Status</h3>
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart key={`employment-${chartKey}`}>
                  <Pie data={nonZeroEmploymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`} labelLine={true}>
                    {nonZeroEmploymentData.map((entry, index) => (<Cell key={`emp-cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} alumni`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (<div className="h-80 flex items-center justify-center text-gray-400 dark:text-gray-500">No employment data available</div>)}
          </Card>

          {/* CHART 2: Career Alignment Pie Chart */}
          <Card>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 text-center">Career Alignment</h3>
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart key={`alignment-${chartKey}`}>
                  <Pie data={nonZeroAlignmentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`} labelLine={true}>
                    {nonZeroAlignmentData.map((entry, index) => (<Cell key={`align-cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} alumni`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (<div className="h-80 flex items-center justify-center text-gray-400 dark:text-gray-500">No career alignment data available</div>)}
          </Card>
        </div>

        {/* ======================================================== */}
        {/* ROW 3: WEEKLY ACTIVITY TREND - FULL WIDTH */}
        {/* ======================================================== */}
        <Card className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Weekly Activity Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyActivities}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#800000" name="Activities" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ======================================================== */}
        {/* ROW 4: PER-COURSE STATISTICS TABLE - CONDITIONAL */}
        {/* ======================================================== */}
        {courseStats.length > 0 && (
          <Card className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Per-Course Alignment Statistics</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Course</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Total Alumni</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">In-Field</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Alignment Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {courseStats.map((course, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{course.course}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{course.total}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{course.inField}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-[#800000] rounded-full" style={{ width: `${course.rate}%` }} /></div><span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{course.rate.toFixed(1)}%</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ======================================================== */}
        {/* ROW 5: RECENT ACTIVITIES FEED */}
        {/* ======================================================== */}
        <Card className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Alumni Activities</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recent activities</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition">
                  <div className="text-2xl">{getActivityIcon(activity.activity_type)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">{activity.full_name || 'Someone'}</span> {activity.description}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{activity.created_at ? new Date(activity.created_at).toLocaleString() : 'Recently'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* ======================================================== */}
        {/* ROW 6: ANNOUNCEMENTS MANAGEMENT */}
        {/* ======================================================== */}
        <Card className="mb-8">
          
          {/* Header with Create Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Announcements</h3>
            <Button onClick={() => setShowCreateModal(true)}>+ Create Announcement</Button>
          </div>

          {/* Filter Controls */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Filter Announcements</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target Type</label>
                <select value={announcementFilterType} onChange={(e) => { setAnnouncementFilterType(e.target.value as 'all' | 'course' | 'batch_year'); setAnnouncementFilterCourse(''); setAnnouncementFilterBatchYear(''); }} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="all">All Alumni</option>
                  <option value="course">Send by Course</option>
                  <option value="batch_year">Send by Batch Year</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{announcementFilterType === 'all' ? 'Course (Optional)' : announcementFilterType === 'course' ? 'Specific Course' : 'Course Filter'}</label>
                <select value={announcementFilterCourse} onChange={(e) => setAnnouncementFilterCourse(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="">All Courses</option>
                  {courses.map(course => (<option key={course} value={course}>{course}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{announcementFilterType === 'all' ? 'Batch Year (Optional)' : announcementFilterType === 'batch_year' ? 'Specific Batch Year' : 'Batch Year Filter'}</label>
                <select value={announcementFilterBatchYear} onChange={(e) => setAnnouncementFilterBatchYear(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="">All Batch Years</option>
                  {batchYears.map(year => (<option key={year} value={year}>{year}</option>))}
                </select>
              </div>
            </div>
            {(announcementFilterCourse || announcementFilterBatchYear || announcementFilterType !== 'all') && (
              <div className="mt-3 text-right">
                <button onClick={() => { setAnnouncementFilterType('all'); setAnnouncementFilterCourse(''); setAnnouncementFilterBatchYear(''); }} className="text-xs text-[#800000] hover:underline font-medium">Clear All Filters</button>
              </div>
            )}
          </div>

          {/* Announcements List */}
          <div className="space-y-4">
            {filteredAnnouncements.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-gray-500 dark:text-gray-400">No announcements match your filters</p>
                <button onClick={() => { setAnnouncementFilterType('all'); setAnnouncementFilterCourse(''); setAnnouncementFilterBatchYear(''); }} className="mt-2 text-sm text-[#800000] hover:underline">Clear filters to see all announcements</button>
              </div>
            ) : (
              filteredAnnouncements.map(ann => (
                <div key={ann.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{getCategoryLabel(ann.category)}</span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300">Target: {getTargetLabel(ann)}</span>
                        {!ann.published && <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">Draft</span>}
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1 break-words">{ann.title}</h4>
                      <p className="text-gray-600 dark:text-gray-400 mb-2 break-words">{ann.content}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(ann.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => toggleAnnouncementStatus(ann.id, ann.published)} className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500">{ann.published ? 'Unpublish' : 'Publish'}</button>
                      <button onClick={() => deleteAnnouncement(ann.id)} className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800">Delete</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* ======================================================== */}
        {/* ROW 7: ALUMNI DIRECTORY TABLE */}
        {/* ======================================================== */}
        <Card>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Alumni Directory</h3>
          
          {/* Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
              <option value="">All Courses</option>
              {courses.map(course => <option key={course} value={course}>{course}</option>)}
            </select>
            <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
              <option value="">All Batch Years</option>
              {batchYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
              <option value="">All Employment Status</option>
              <option value="Employed">Employed</option>
              <option value="Unemployed">Unemployed</option>
              <option value="Self-Employed">Self-Employed</option>
              <option value="Freelancer">Freelancer</option>
            </select>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Course</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Batch Year</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Employment Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Job Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Company</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">Career Alignment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredAlumni.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-5xl mb-3">👥</div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">No alumni found</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Alumni will appear here after they register</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAlumni.map(alum => (
                    <tr key={alum.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{alum.full_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{alum.course || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{alum.batch_year || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          alum.employment_status === 'Employed' ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' : 
                          alum.employment_status === 'Unemployed' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : 
                          'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}>
                          {alum.employment_status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{alum.job_title || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{alum.company || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          alum.career_alignment_status === 'In-Field' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 
                          alum.career_alignment_status === 'Out-of-Field' ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' : 
                          'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
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

      {/* ========================================================== */}
      {/* BLOCK 4: MODALS */}
      {/* ========================================================== */}
      
      {/* MODAL: Profile Details */}
      <Modal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} title="Profile Details" size="md">
        <div className="space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="w-20 h-20 bg-gradient-to-br from-[#800000] to-[#a10000] rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">{adminProfile.full_name?.[0]?.toUpperCase() || 'A'}</span>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white">{adminProfile.full_name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">{adminProfile.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-full">Admin Account</span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Display Name</label>
              <div className="flex gap-2">
                <input type="text" value={adminProfile.full_name} onChange={(e) => setAdminProfile(prev => ({ ...prev, full_name: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-[#800000] focus:ring-1 focus:ring-[#800000] outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                <button onClick={() => updateAdminProfile(adminProfile.full_name)} className="px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-[#6a0000] transition">Save</button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This name appears in the header</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
              <div className="flex items-center gap-2">
                <input type="email" value={adminProfile.email} disabled className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">Verified</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed. Contact support for assistance.</p>
            </div>
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button onClick={() => setShowProfileModal(false)} className="flex-1">Close</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Settings */}
      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Settings" size="lg">
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {/* Appearance */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Appearance</h3>
            </div>
            <div className="pl-10">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">Dark Mode</p>
                  <p className="text-xs text-gray-400">Switch between light and dark theme</p>
                </div>
                <button onClick={toggleDarkMode} className="relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none" style={{ backgroundColor: isDarkMode ? '#800000' : '#d1d5db' }}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 flex items-center justify-center text-xs ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}>
                    {isDarkMode ? '🌙' : '☀️'}
                  </span>
                </button>
              </label>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Notification Preferences</h3>
            </div>
            <div className="space-y-4 pl-10">
              <label className="flex items-center justify-between cursor-pointer">
                <div><p className="font-medium text-gray-700 dark:text-gray-300">Email Announcements</p><p className="text-xs text-gray-400">Receive email when new announcements are posted</p></div>
                <div className="relative">
                  <input type="checkbox" checked={notificationSettings.emailAnnouncements} onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailAnnouncements: e.target.checked }))} className="sr-only peer" />
                  <div className="w-10 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-[#800000] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div><p className="font-medium text-gray-700 dark:text-gray-300">Activity Digest</p><p className="text-xs text-gray-400">Weekly summary of alumni activity</p></div>
                <div className="relative">
                  <input type="checkbox" checked={notificationSettings.emailActivityDigest} onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailActivityDigest: e.target.checked }))} className="sr-only peer" />
                  <div className="w-10 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-[#800000] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div><p className="font-medium text-gray-700 dark:text-gray-300">Security Alerts</p><p className="text-xs text-gray-400">Get notified about login attempts and security events</p></div>
                <div className="relative">
                  <input type="checkbox" checked={notificationSettings.emailSecurityAlerts} onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailSecurityAlerts: e.target.checked }))} className="sr-only peer" />
                  <div className="w-10 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-[#800000] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </div>
              </label>
            </div>
          </div>

          {/* Security - Change Password */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Security</h3>
            </div>
            {!showChangePassword ? (
              <div className="pl-10">
                <button onClick={() => setShowChangePassword(true)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium text-sm">Change Password</button>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Your password will be updated immediately. You'll stay logged in.</p>
              </div>
            ) : (
              <div className="space-y-3 pl-10">
                <input type="password" placeholder="Current Password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-[#800000] focus:ring-1 focus:ring-[#800000] outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                <input type="password" placeholder="New Password (min 6 characters)" value={passwordForm.newPassword} onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-[#800000] focus:ring-1 focus:ring-[#800000] outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                <input type="password" placeholder="Confirm New Password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-[#800000] focus:ring-1 focus:ring-[#800000] outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                <div className="flex gap-2 pt-2">
                  <button onClick={updatePassword} disabled={isChangingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword || passwordForm.newPassword.length < 6} className="px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-[#6a0000] transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {isChangingPassword ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating...</>) : ('Update Password')}
                  </button>
                  <button onClick={() => { setShowChangePassword(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* System Information */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">System Information</h3>
            </div>
            <div className="pl-10 space-y-2 text-sm">
              <p><span className="font-medium text-gray-600 dark:text-gray-400">Version:</span> <span className="text-gray-900 dark:text-white">GradTrack v1.0.0</span></p>
              <p><span className="font-medium text-gray-600 dark:text-gray-400">Environment:</span> <span className="text-gray-900 dark:text-white">Production</span></p>
              <p><span className="font-medium text-gray-600 dark:text-gray-400">Session ID:</span> <span className="text-gray-500 dark:text-gray-400 text-xs">{session.user.id.slice(0, 8)}...</span></p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button onClick={() => setShowSettingsModal(false)} className="flex-1">Close</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Create Announcement */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Announcement" size="lg">
        <div className="space-y-4">
          <input type="text" value={newAnnouncement.title} onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} placeholder="Announcement Title" className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" />
          <textarea value={newAnnouncement.content} onChange={e => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })} placeholder="Announcement Content" rows={4} className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" />
          <select value={newAnnouncement.category} onChange={e => setNewAnnouncement({ ...newAnnouncement, category: e.target.value })} className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
            <option value="alumni_events">🎉 Alumni Events</option>
            <option value="job_fairs">💼 Job Fairs</option>
            <option value="seminars">📚 Seminars</option>
            <option value="career_opportunities">🎯 Career Opportunities</option>
          </select>
          <select value={newAnnouncement.target_type} onChange={e => setNewAnnouncement({ ...newAnnouncement, target_type: e.target.value, target_course: '', target_batch_year: '' })} className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
            <option value="all">Send to All Alumni</option>
            <option value="course">Send by Course</option>
            <option value="batch_year">Send by Batch Year</option>
          </select>

          {newAnnouncement.target_type === 'course' && (
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Advanced Targeting Options</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Select Course *</label>
                <select value={newAnnouncement.target_course} onChange={e => setNewAnnouncement({ ...newAnnouncement, target_course: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm" required>
                  <option value="">Select a course</option>
                  {courses.map(course => (<option key={course} value={course}>{course}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Year (Optional)</label>
                <select value={newAnnouncement.target_batch_year} onChange={e => setNewAnnouncement({ ...newAnnouncement, target_batch_year: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="">All Batch Years</option>
                  {batchYears.map(year => (<option key={year} value={year}>{year}</option>))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Leave empty to send to all batch years of this course</p>
              </div>
            </div>
          )}

          {newAnnouncement.target_type === 'batch_year' && (
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Advanced Targeting Options</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Select Batch Year *</label>
                <select value={newAnnouncement.target_batch_year} onChange={e => setNewAnnouncement({ ...newAnnouncement, target_batch_year: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm" required>
                  <option value="">Select a batch year</option>
                  {batchYears.map(year => (<option key={year} value={year}>{year}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Course (Optional)</label>
                <select value={newAnnouncement.target_course} onChange={e => setNewAnnouncement({ ...newAnnouncement, target_course: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="">All Courses</option>
                  {courses.map(course => (<option key={course} value={course}>{course}</option>))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Leave empty to send to all courses of this batch year</p>
              </div>
            </div>
          )}

          {newAnnouncement.target_type === 'all' && (
            <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Advanced Filtering (Optional)</p>
              <p className="text-xs text-gray-400 mb-2">Leave both empty to send to ALL alumni</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Course (Optional)</label>
                <select value={newAnnouncement.target_course} onChange={e => setNewAnnouncement({ ...newAnnouncement, target_course: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="">All Courses</option>
                  {courses.map(course => (<option key={course} value={course}>{course}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Batch Year (Optional)</label>
                <select value={newAnnouncement.target_batch_year} onChange={e => setNewAnnouncement({ ...newAnnouncement, target_batch_year: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="">All Batch Years</option>
                  {batchYears.map(year => (<option key={year} value={year}>{year}</option>))}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button onClick={createAnnouncement} className="flex-1" disabled={!newAnnouncement.title || !newAnnouncement.content || (newAnnouncement.target_type === 'course' && !newAnnouncement.target_course) || (newAnnouncement.target_type === 'batch_year' && !newAnnouncement.target_batch_year)}>Create Announcement</Button>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
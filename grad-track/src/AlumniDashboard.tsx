// src/AlumniDashboard.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { classifyCareerAlignment } from './lib/careerClassifier';
import phAddress from 'latest-ph-address-thanks-to-anehan';
import AnnouncementComments from './AnnouncementComments';
import {
  notifyCareerUpdated,
  notifyProfileUpdated,
  notifyNewRegistration,
  notifyEmploymentStatusChanged,
  notifyCommentAdded,
} from './lib/notificationUtils';
import NotificationBell from './NotificationBell';

// ==================== TYPES ====================
interface Profile {
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
  auto_sync_enabled: boolean;
  last_synced_at: string | null;
  career_alignment_status: string | null;
  ai_confidence_score: number | null;
  profile_completion: number;
  avatar_url: string | null;
  gender: 'Male' | 'Female' | null; 
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  viewed: boolean;
}

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
}

interface AnnouncementComment {
  id: string;
  announcement_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at?: string;
  full_name?: string;
  role?: string;
  replies?: AnnouncementComment[];
}

// ==================== REUSABLE COMPONENTS ====================
const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({
  children,
  className = '',
  onClick
}) => (
  <div
    onClick={onClick}
    className={`
      bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 
      hover:shadow-xl transition-all duration-300 
      ${onClick ? 'cursor-pointer hover:border-[#800000]/30 active:scale-[0.99]' : ''}
      ${className}
    `}
  >
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
  loadingText?: string;
  className?: string;
}> = ({ children, variant = 'primary', size = 'md', onClick, disabled, loading, loadingText, className = '' }) => {
  const variants = {
    primary: 'bg-gradient-to-r from-[#800000] to-[#a10000] hover:from-[#6a0000] hover:to-[#8a0000] text-white shadow-md hover:shadow-lg',
    secondary: 'bg-white border-2 border-gray-200 hover:border-[#800000]/50 text-gray-700 hover:bg-gray-50',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md',
    success: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm',
    md: 'px-4 py-2 text-sm sm:px-6 sm:py-2.5',
    lg: 'px-6 py-2.5 text-base sm:px-8 sm:py-3.5',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${variants[variant]} ${sizes[size]} font-bold rounded-xl 
        transition-all duration-300 active:scale-[0.98] 
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>{loadingText || 'Loading...'}</span>
        </div>
      ) : children}
    </button>
  );
};

const Input: React.FC<{
  label?: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
}> = ({ label, type = 'text', value, onChange, placeholder, required, disabled, readOnly, icon, hint, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {label && (
      <label className="block text-xs sm:text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={`
          w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-white border rounded-xl text-gray-900
          focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20
          outline-none transition-all duration-200 text-sm sm:text-base
          ${icon ? 'pl-8 sm:pl-10' : ''}
          ${disabled || readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200' : 'border-gray-200 hover:border-gray-300'}
        `}
      />
    </div>
    {hint && <p className="text-xs text-amber-600 flex items-center gap-1">🔒 {hint}</p>}
  </div>
);

const Badge: React.FC<{ children: React.ReactNode; variant?: 'success' | 'warning' | 'info' | 'danger' | 'default' }> = ({
  children,
  variant = 'default'
}) => {
  const variants = {
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
    danger: 'bg-red-100 text-red-700',
    default: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-lg ${variants[variant]}`}>
      {children}
    </span>
  );
};

const ProgressBar: React.FC<{ value: number; label?: string; showPercentage?: boolean }> = ({
  value,
  label,
  showPercentage = true
}) => (
  <div className="space-y-2">
    {(label || showPercentage) && (
      <div className="flex justify-between text-xs sm:text-sm">
        {label && <span className="font-medium text-gray-700">{label}</span>}
        {showPercentage && <span className="font-semibold text-[#800000]">{Math.min(100, value)}%</span>}
      </div>
    )}
    <div className="h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[#800000] to-[#a10000] rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  </div>
);

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
      <div className={`${sizes[size]} w-full bg-white rounded-xl sm:rounded-2xl shadow-2xl mx-4 sm:mx-0`}>
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[70vh]">{children}</div>
      </div>
    </div>
  );
};

// ==================== INFO BOX COMPONENT ====================
const InfoBox: React.FC<{ title: string; value: string | number | null | undefined; icon: string; hint?: string }> = ({
  title,
  value,
  icon,
  hint
}) => (
  <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-100">
    <div className="flex items-start gap-2 sm:gap-3">
      <div className="text-xl sm:text-2xl">{icon}</div>
      <div className="flex-1">
        <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
        <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{value || 'Not set'}</p>
        {hint && <p className="text-[10px] sm:text-xs text-amber-600 mt-2 flex items-center gap-1">🔒 {hint}</p>}
      </div>
    </div>
  </div>
);

// ==================== ACTIVITY TIMELINE COMPONENT ====================
const ActivityTimeline: React.FC<{ activities: Activity[]; loading: boolean }> = ({ activities, loading }) => {
  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      profile_update: '✏️',
      employment_update: '📊',
      verification: '✅',
      profile_completed: '🏆',
      announcement_view: '📢',
      login: '🔐',
      logout: '🔒',
      avatar_upload: '🖼️',
    };
    return icons[type] || '📌';
  };

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      profile_update: 'bg-blue-100 text-blue-700',
      employment_update: 'bg-emerald-100 text-emerald-700',
      verification: 'bg-green-100 text-green-700',
      profile_completed: 'bg-amber-100 text-amber-700',
      announcement_view: 'bg-purple-100 text-purple-700',
      login: 'bg-indigo-100 text-indigo-700',
      logout: 'bg-gray-100 text-gray-700',
      avatar_upload: 'bg-pink-100 text-pink-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-start gap-2 sm:gap-3 animate-pulse">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 rounded-lg" />
            <div className="flex-1">
              <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-6 sm:py-8">
        <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">📋</div>
        <p className="text-gray-500 font-medium text-sm sm:text-base">No recent activity</p>
        <p className="text-xs text-gray-400 mt-1">Update your profile to see activity here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id} className="flex items-start gap-2 sm:gap-3 group">
          <div className="relative">
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-sm transition-transform group-hover:scale-110 ${getActivityColor(activity.activity_type)}`}>
              {getActivityIcon(activity.activity_type)}
            </div>
            {index < activities.length - 1 && (
              <div className="absolute top-6 sm:top-8 left-3 sm:left-4 w-0.5 h-8 sm:h-12 bg-gray-200" />
            )}
          </div>
          <div className="flex-1 pt-0.5">
            <p className="text-xs sm:text-sm text-gray-700">{activity.description}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{formatTimeAgo(activity.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ==================== ANNOUNCEMENT PAGE COMPONENT ====================
const AnnouncementPage: React.FC<{
  announcements: Announcement[];
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  commentsByAnnouncement: Record<string, AnnouncementComment[]>;
  commentLoading: Record<string, boolean>;
  session: Session;
  isAdmin: boolean;
  onAddComment: (announcementId: string, content: string, parentCommentId: string | null) => Promise<void>;
  onDeleteComment: (commentId: string, announcementId: string) => Promise<void>;
  onEditComment: (commentId: string, announcementId: string, newContent: string) => Promise<void>;
}> = ({
  announcements,
  loading,
  onMarkAsRead,
  commentsByAnnouncement,
  commentLoading,
  session,
  isAdmin,
  onAddComment,
  onDeleteComment,
  onEditComment
}) => {
  const getCategoryBadge = (category: string) => {
    const badges: Record<string, string> = {
      alumni_events: 'bg-purple-100 text-purple-700',
      job_fairs: 'bg-blue-100 text-blue-700',
      seminars: 'bg-green-100 text-green-700',
      career_opportunities: 'bg-amber-100 text-amber-700',
    };
    return badges[category] || 'bg-gray-100 text-gray-700';
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

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-4 sm:p-6 border-b border-gray-100 animate-pulse">
            <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/4 mb-2 sm:mb-3" />
            <div className="h-4 sm:h-6 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 sm:h-4 bg-gray-200 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16">
        <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📭</div>
        <p className="text-gray-600 font-medium text-base sm:text-lg">No announcements yet</p>
        <p className="text-xs sm:text-sm text-gray-400 mt-2">Check back later for updates from the career office</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {announcements.map(ann => (
        <article
          key={ann.id}
          id={`announcement-${ann.id}`}  // ✅ ADDED THIS
          className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md sm:p-6 ${!ann.viewed ? 'bg-gradient-to-r from-blue-50/70 to-white' : ''}`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
            <div className="flex flex-wrap gap-2">
              <span className={`px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getCategoryBadge(ann.category)}`}>
                {getCategoryLabel(ann.category)}
              </span>
              {!ann.viewed && (
                <Badge variant="info">
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    New
                  </span>
                </Badge>
              )}
            </div>
            <span className="text-[10px] sm:text-xs text-gray-400">{new Date(ann.created_at).toLocaleDateString()}</span>
          </div>
          <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-2">{ann.title}</h3>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-line">{ann.content}</p>
          {!ann.viewed && (
            <button
              onClick={() => onMarkAsRead(ann.id)}
              className="mt-3 sm:mt-4 text-xs sm:text-sm text-[#800000] font-semibold hover:underline inline-flex items-center gap-1 group"
            >
              Mark as read
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          )}

          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
              <AnnouncementComments
                announcementId={ann.id}
                comments={commentsByAnnouncement[ann.id] || []}
                loading={commentLoading[ann.id] || false}
                session={session}
                isAdmin={isAdmin}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                onEditComment={onEditComment}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

// ==================== MAIN DASHBOARD COMPONENT ====================
export default function AlumniDashboard({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'announcements'>('overview');
  const [showEmploymentModal, setShowEmploymentModal] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Address state variables
  const [regions, setRegions] = useState<any[]>([]);
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [barangays, setBarangays] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('');
  const [street, setStreet] = useState<string>('');

  const [employmentForm, setEmploymentForm] = useState({
    job_title: '',
    company: '',
    employment_status: '',
    industry: '',
    location: '',
    linkedin_url: '',
  });

  const [saveLoading, setSaveLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [commentsByAnnouncement, setCommentsByAnnouncement] = useState<Record<string, AnnouncementComment[]>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      const { error: activityError } = await supabase.from('alumni_activities').insert({
        user_id: session.user.id,
        activity_type: 'logout',
        description: 'Signed out',
        metadata: { timestamp: new Date().toISOString() }
      });

      if (activityError) {
        console.error('Error logging logout activity:', activityError);
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        setSignOutLoading(false);
        showToast('Error signing out. Please try again.', 'error');
        return;
      }
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out exception:', error);
      setSignOutLoading(false);
      showToast('Error signing out. Please try again.', 'error');
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout triggered – forcing loading to false');
        setLoading(false);
      }
    }, 8000);

    fetchProfile();
    fetchAnnouncements();
    fetchActivities();
    addActivity('login', 'Signed in');

    return () => clearTimeout(timeoutId);
  }, [session.user.id]);

  // Announcement Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('alumni-announcements')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: 'published=eq.true'
        },
        (payload) => {
          console.log('New announcement!', payload);
          fetchAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Load regions when modal opens
  useEffect(() => {
    if (showEmploymentModal) {
      try {
        const regionList = phAddress.getRegions();
        if (Array.isArray(regionList)) {
          setRegions(regionList);
        } else {
          console.error('Regions API returned non-array:', regionList);
          setRegions([]);
        }
      } catch (error) {
        console.error('Error loading regions:', error);
        setRegions([]);
      }
    }
  }, [showEmploymentModal]);

  // Load provinces when region changes
  useEffect(() => {
    if (selectedRegion) {
      try {
        const provinceList = phAddress.getProvincesByRegion(selectedRegion);
        if (Array.isArray(provinceList)) {
          setProvinces(provinceList);
        } else {
          console.error('Provinces API returned non-array:', provinceList);
          setProvinces([]);
        }
        setSelectedProvince('');
        setSelectedCity('');
        setSelectedBarangay('');
        setStreet('');
      } catch (error) {
        console.error('Error loading provinces:', error);
        setProvinces([]);
      }
    } else {
      setProvinces([]);
    }
  }, [selectedRegion]);

  // Load cities when province changes
  useEffect(() => {
    if (selectedProvince) {
      try {
        const cityList = phAddress.getCitiesAndMunsByProvince(selectedProvince);
        if (Array.isArray(cityList)) {
          setCities(cityList);
        } else {
          console.error('Cities API returned non-array:', cityList);
          setCities([]);
        }
        setSelectedCity('');
        setSelectedBarangay('');
        setStreet('');
      } catch (error) {
        console.error('Error loading cities:', error);
        setCities([]);
      }
    } else {
      setCities([]);
    }
  }, [selectedProvince]);

  // Load barangays when city changes
  useEffect(() => {
    if (selectedCity) {
      try {
        const barangayList = phAddress.getBarangaysByCityOrMun(selectedCity);
        if (Array.isArray(barangayList)) {
          setBarangays(barangayList);
        } else {
          console.error('Barangays API returned non-array:', barangayList);
          setBarangays([]);
        }
        setSelectedBarangay('');
        setStreet('');
      } catch (error) {
        console.error('Error loading barangays:', error);
        setBarangays([]);
      }
    } else {
      setBarangays([]);
    }
  }, [selectedCity]);

  // Combine full address whenever address components change
  useEffect(() => {
    if (selectedCity && selectedProvince && selectedBarangay) {
      const regionObj = Array.isArray(regions) ? regions.find((r: any) => r?.psgc === selectedRegion) : null;
      const provinceObj = Array.isArray(provinces) ? provinces.find((p: any) => p?.psgc === selectedProvince) : null;
      const cityObj = Array.isArray(cities) ? cities.find((c: any) => c?.psgc === selectedCity) : null;
      const barangayObj = Array.isArray(barangays) ? barangays.find((b: any) => b?.psgc === selectedBarangay) : null;

      const regionName = regionObj?.name || '';
      const provinceName = provinceObj?.name || '';
      const cityName = cityObj?.name || '';
      const barangayName = barangayObj?.name || '';

      let fullAddress = '';
      if (street) fullAddress += `${street}, `;
      if (barangayName) fullAddress += `${barangayName}, `;
      if (cityName) fullAddress += `${cityName}, `;
      if (provinceName) fullAddress += `${provinceName}, `;
      if (regionName) fullAddress += `${regionName}`;

      setEmploymentForm(prev => ({ ...prev, location: fullAddress }));
    }
  }, [selectedRegion, selectedProvince, selectedCity, selectedBarangay, street, regions, provinces, cities, barangays]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

 const fetchProfile = async () => {
  try {
    console.log('Fetching profile for user:', session.user.id);
    const { data, error } = await supabase
      .from('alumni_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
      return;
    }

    if (!data) {
      console.log('No profile found, creating new profile...');
      
      // 🔍 Try to get gender from graduates_master
      let genderFromMaster = null;
      try {
        const { data: gradData } = await supabase
          .from('graduates_master')
          .select('gender')
          .eq('student_id', session.user.user_metadata?.student_id || '')
          .maybeSingle();
        
        if (gradData && (gradData.gender === 'Male' || gradData.gender === 'Female')) {
          genderFromMaster = gradData.gender;
        }
      } catch (err) {
        console.warn('Could not fetch gender from master:', err);
      }

      const newProfile = {
        user_id: session.user.id,
        full_name: session.user.user_metadata?.full_name || '',
        course: '',
        batch_year: null,
        company: '',
        job_title: '',
        industry: '',
        location: '',
        employment_status: 'Unemployed',
        linkedin_url: '',
        auto_sync_enabled: false,
        career_alignment_bool: null,
        ai_confidence_score: 0,
        profile_completion: 15,
        avatar_url: null,
        gender: genderFromMaster || null,
      };
      
      const { data: created, error: insertError } = await supabase
        .from('alumni_profiles')
        .insert(newProfile)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
        setLoading(false);
        return;
      }

      await notifyNewRegistration(
        created.full_name || 'New Alumni',
        created.course || 'Course not set',
        created.user_id
      );

      setProfile(created);
      console.log('Profile created successfully');
    } else {
      let avatarUrl = null;
      if (data.avatar_url) {
        const { data: publicUrlData } = supabase.storage
          .from('profile-pictures')
          .getPublicUrl(data.avatar_url);
        avatarUrl = publicUrlData.publicUrl;
      }
      
      let finalData = { ...data, avatar_url: avatarUrl };
      
      // 🔍 Sync gender from master if missing
      if (!data.gender) {
        try {
          const { data: gradData } = await supabase
            .from('graduates_master')
            .select('gender')
            .eq('student_id', data.student_id || '')
            .maybeSingle();
          
          if (gradData?.gender && (gradData.gender === 'Male' || gradData.gender === 'Female')) {
            await supabase
              .from('alumni_profiles')
              .update({ gender: gradData.gender })
              .eq('id', data.id);
            
            finalData.gender = gradData.gender;
            console.log('✅ Gender synced from master:', gradData.gender);
          }
        } catch (err) {
          console.warn('Could not sync gender from master:', err);
        }
      }
      
      setProfile(finalData);
      setEmploymentForm({
        job_title: data.job_title || '',
        company: data.company || '',
        employment_status: data.employment_status || 'Unemployed',
        industry: data.industry || '',
        location: data.location || '',
        linkedin_url: data.linkedin_url || '',
      });

      console.log('Profile loaded');
    }

    const { data: roleData } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    setIsAdmin(roleData?.role === 'Admin');
  } catch (err) {
    console.error('Unexpected error in fetchProfile:', err);
  } finally {
    setLoading(false);
    console.log('fetchProfile finished, loading set to false');
  }
};

 const fetchCommentsForAnnouncement = async (announcementId: string) => {
  setCommentLoading(prev => ({ ...prev, [announcementId]: true }));
  try {
    const { data, error } = await supabase
      .from('announcement_comments')
      .select('*')
      .eq('announcement_id', announcementId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const comments = (data as AnnouncementComment[] | null) || [];
    const userIds = [...new Set(comments.map(comment => comment.user_id))];
    let userMap: Record<string, { role?: string; full_name?: string }> = {};

    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, role, full_name')
        .in('id', userIds);

      userMap = usersData?.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}) || {};
    }

    const commentMap: Record<string, AnnouncementComment & { replies: AnnouncementComment[] }> = {};
    const rootComments: (AnnouncementComment & { replies: AnnouncementComment[] })[] = [];

    comments.forEach(comment => {
      const userRow = userMap[comment.user_id];
      const role = userRow?.role || 'Alumni';
      // Alumni always see "Admin" for admin commenters — real name never exposed here.
      const displayName = role === 'Admin'
        ? 'Admin'
        : (userRow?.full_name || 'Unknown Alumni');

      commentMap[comment.id] = {
        ...comment,
        full_name: displayName,
        role,
        replies: [],
      };
    });

    comments.forEach(comment => {
      if (comment.parent_comment_id) {
        const parent = commentMap[comment.parent_comment_id];
        if (parent) {
          parent.replies.push(commentMap[comment.id]);
        }
      } else {
        rootComments.push(commentMap[comment.id]);
      }
    });

    setCommentsByAnnouncement(prev => ({ ...prev, [announcementId]: rootComments }));
  } catch (error) {
    console.error('Error fetching comments:', error);
  } finally {
    setCommentLoading(prev => ({ ...prev, [announcementId]: false }));
  }
};

  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (announcementsData) {
        const { data: viewsData } = await supabase
          .from('announcement_views')
          .select('announcement_id')
          .eq('user_id', session.user.id);

        const viewedIds = new Set(viewsData?.map(v => v.announcement_id) || []);

        const nextAnnouncements = announcementsData.map(ann => ({
          ...ann,
          viewed: viewedIds.has(ann.id),
        }));

        setAnnouncements(nextAnnouncements);
        nextAnnouncements.forEach(ann => {
          fetchCommentsForAnnouncement(ann.id);
        });
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const fetchActivities = async () => {
    setActivitiesLoading(true);
    try {
      const { data } = await supabase
        .from('alumni_activities')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) setActivities(data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setActivitiesLoading(false);
    }
  };

 // src/AlumniDashboard.tsx - REPLACE addComment function

// src/AdminDashboard.tsx - REPLACE addComment function

const addComment = async (announcementId: string, content: string, parentCommentId: string | null = null) => {
  if (!content.trim()) return;

  try {
    const { error } = await supabase
      .from('announcement_comments')
      .insert({
        announcement_id: announcementId,
        user_id: session.user.id,
        content: content.trim(),
        parent_comment_id: parentCommentId,
      });

    if (error) throw error;

    const { data: announcement } = await supabase
      .from('announcements')
      .select('title')
      .eq('id', announcementId)
      .single();

    // Alumni commenting or replying — always notify all admins.
    // (Admin-to-alumni replies are handled separately, in AdminDashboard.tsx.)
    await notifyCommentAdded(
      profile?.full_name || 'An alumni',
      announcement?.title || 'announcement',
      content.trim(),
      announcementId,
      session.user.id
    );

    await fetchCommentsForAnnouncement(announcementId);
    showToast('Comment posted successfully.', 'success');
  } catch (error) {
    console.error('Error adding comment:', error);
    showToast('Unable to post comment right now.', 'error');
  }
};
  const deleteComment = async (commentId: string, announcementId: string) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await supabase.from('announcement_comments').delete().eq('parent_comment_id', commentId);
      const { error } = await supabase.from('announcement_comments').delete().eq('id', commentId);

      if (error) throw error;
      await fetchCommentsForAnnouncement(announcementId);
      showToast('Comment deleted.', 'success');
    } catch (error) {
      console.error('Error deleting comment:', error);
      showToast('Unable to delete comment.', 'error');
    }
  };

  // ✅ EDIT COMMENT FUNCTION - ADDED HERE
  const editComment = async (commentId: string, announcementId: string, newContent: string) => {
    if (!newContent.trim()) return;

    try {
      console.log('✏️ Alumni editing comment:', { commentId, announcementId, newContent });

      const { error } = await supabase
        .from('announcement_comments')
        .update({
          content: newContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .eq('user_id', session.user.id);

      if (error) {
        console.error('❌ Error editing comment:', error);
        showToast('Failed to edit comment', 'error');
        return;
      }

      console.log('✅ Comment updated successfully');
      await fetchCommentsForAnnouncement(announcementId);
      showToast('Comment updated successfully!', 'success');
    } catch (error) {
      console.error('❌ Error in editComment:', error);
      showToast('Failed to edit comment', 'error');
    }
  };

  const addActivity = async (type: string, description: string) => {
    try {
      await supabase.from('alumni_activities').insert({
        user_id: session.user.id,
        activity_type: type,
        description: description,
        metadata: { timestamp: new Date().toISOString() }
      });
      fetchActivities();
    } catch (error) {
      console.error('Error adding activity:', error);
    }
  };

  const markAnnouncementAsRead = async (announcementId: string) => {
    try {
      await supabase.from('announcement_views').insert({
        announcement_id: announcementId,
        user_id: session.user.id,
      });

      setAnnouncements(prev => prev.map(ann =>
        ann.id === announcementId ? { ...ann, viewed: true } : ann
      ));

      await addActivity('announcement_view', 'Read announcement');
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be less than 5MB', 'error');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/avatar.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('alumni_profiles')
        .update({ avatar_url: filePath })
        .eq('user_id', session.user.id);
      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);

      // ✅ #4 PROFILE UPDATED - Notify admins when profile picture is updated
      await notifyProfileUpdated(
        profile?.full_name || 'An alumni',
        session.user.id,
        'profile picture'
      );

      await addActivity('avatar_upload', 'Updated profile picture');
      showToast('Profile picture updated successfully!', 'success');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showToast('Error uploading profile picture', 'error');
    }
  };

  const removeAvatar = async () => {
    if (!profile?.avatar_url) return;

    try {
      const filePath = profile.avatar_url.includes('profile-pictures')
        ? profile.avatar_url.split('/profile-pictures/')[1]
        : profile.avatar_url;
      await supabase.storage.from('profile-pictures').remove([filePath]);
      await supabase.from('alumni_profiles').update({ avatar_url: null }).eq('user_id', session.user.id);
      setProfile(prev => prev ? { ...prev, avatar_url: null } : null);

      // ✅ #4 PROFILE UPDATED - Notify admins when profile picture is removed
      await notifyProfileUpdated(
        profile?.full_name || 'An alumni',
        session.user.id,
        'profile picture (removed)'
      );

      await addActivity('avatar_upload', 'Removed profile picture');
      showToast('Profile picture removed', 'success');
    } catch (error) {
      console.error('Error removing avatar:', error);
      showToast('Error removing profile picture', 'error');
    }
  };

  const calculateCompletion = (empData: typeof employmentForm) => {
    let score = 15;
    if (profile?.full_name) score += 15;
    if (profile?.course) score += 15;
    if (profile?.batch_year) score += 15;
    if (empData.job_title) score += 15;
    if (empData.company) score += 10;
    if (empData.industry) score += 5;
    if (empData.location) score += 5;
    if (empData.linkedin_url) score += 5;
    return Math.min(score, 100);
  };

  const handleSaveEmployment = async () => {
    setSaveLoading(true);
    const completionScore = calculateCompletion(employmentForm);

    const oldValues = {
      job_title: profile?.job_title || '',
      company: profile?.company || '',
      employment_status: profile?.employment_status || '',
      industry: profile?.industry || '',
      location: profile?.location || '',
      linkedin_url: profile?.linkedin_url || '',
    };

    const updateData: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
      profile_completion: completionScore,
    };

    if (employmentForm.job_title !== undefined) updateData.job_title = employmentForm.job_title || null;
    if (employmentForm.company !== undefined) updateData.company = employmentForm.company || null;
    if (employmentForm.employment_status !== undefined) updateData.employment_status = employmentForm.employment_status || null;
    if (employmentForm.industry !== undefined) updateData.industry = employmentForm.industry || null;
    if (employmentForm.location !== undefined) updateData.location = employmentForm.location || null;
    if (employmentForm.linkedin_url !== undefined) updateData.linkedin_url = employmentForm.linkedin_url || null;

    let classificationResult = null;

    // Always run classification if job title is not empty
    if (employmentForm.job_title && employmentForm.job_title.trim() !== '') {
      console.log('=== CLASSIFICATION TRIGGERED ===');
      console.log('Course:', profile?.course);
      console.log('Job Title:', employmentForm.job_title);

      classificationResult = await classifyCareerAlignment(
        profile?.course || '',
        employmentForm.job_title,
        ''
      );

      console.log('Classification Result:', classificationResult);

      if (classificationResult) {
        updateData.career_alignment_status = classificationResult.alignment_status;
        updateData.ai_confidence_score = classificationResult.confidence_score;
      }
    }

    const { error } = await supabase
      .from('alumni_profiles')
      .update(updateData)
      .eq('user_id', session.user.id);

    if (!error) {
      let activityDescription = '';

      // Check what changed for notification purposes
      const jobTitleChanged = employmentForm.job_title !== oldValues.job_title;
      const companyChanged = employmentForm.company !== oldValues.company;
      const statusChanged = employmentForm.employment_status !== oldValues.employment_status;

      if (jobTitleChanged) {
        const oldVal = oldValues.job_title || 'not set';
        const newVal = employmentForm.job_title || 'not set';
        activityDescription += `changed job title from "${oldVal}" to "${newVal}". `;
      }

      if (companyChanged) {
        const oldVal = oldValues.company || 'not set';
        const newVal = employmentForm.company || 'not set';
        activityDescription += `changed company from "${oldVal}" to "${newVal}". `;
      }

      if (statusChanged) {
        const oldVal = oldValues.employment_status || 'not set';
        const newVal = employmentForm.employment_status;
        activityDescription += `changed employment status from "${oldVal}" to "${newVal}". `;
      }

      if (classificationResult && classificationResult.alignment_status !== 'Pending') {
        activityDescription += ` AI classified as ${classificationResult.alignment_status} (${Math.round(classificationResult.confidence_score * 100)}% confidence).`;
      }

      if (!activityDescription) {
        activityDescription = 'updated career information';
      }

      // ✅ #3 CAREER UPDATED - Notify admins when job title or company changes
     if (jobTitleChanged || companyChanged) {
  await notifyCareerUpdated(
    profile?.full_name || 'An alumni',
    employmentForm.job_title || 'Not specified',
    employmentForm.company || 'Not specified',
    session.user.id,
    oldValues.job_title,     // ✅ ADD THIS
    oldValues.company        // ✅ ADD THIS
  );
}

      // ✅ #7 EMPLOYMENT STATUS CHANGED - Notify admins when employment status changes
     if (statusChanged) {
  await notifyEmploymentStatusChanged(
    profile?.full_name || 'An alumni',
    employmentForm.employment_status || 'Unemployed',
    employmentForm.company || '',
    employmentForm.job_title || '',
    session.user.id,
    oldValues.employment_status     // ✅ ADD THIS
  );
}

      // ✅ #4 PROFILE UPDATED - Notify admins for any other profile updates
      if (!jobTitleChanged && !companyChanged && !statusChanged) {
        await notifyProfileUpdated(
          profile?.full_name || 'An alumni',
          session.user.id,
          'career information'
        );
      }

      await addActivity('employment_update', activityDescription.trim());

      setProfile(prev => prev ? {
        ...prev,
        ...employmentForm,
        career_alignment_status: classificationResult?.alignment_status || prev.career_alignment_status,
        ai_confidence_score: classificationResult?.confidence_score || prev.ai_confidence_score
      } : null);

      setShowEmploymentModal(false);
      showToast('Career information updated successfully!', 'success');
    } else {
      showToast('Error updating career information', 'error');
    }
    setSaveLoading(false);
  };

  const getFirstName = (name: string | null | undefined) => name?.split(' ')[0] || 'Alumni';
  const unreadCount = announcements.filter(a => !a.viewed).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const completionScore = profile?.profile_completion || 15;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#800000] to-[#a10000] rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-md">
                GT
              </div>
              <div className="hidden xs:block">
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  GradTrack
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-500">Alumni Portal</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-4">
              <div className="flex md:hidden bg-gray-100 rounded-xl p-0.5 sm:p-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium text-[11px] sm:text-xs transition-all duration-200 ${activeTab === 'overview'
                      ? 'bg-white text-[#800000] shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  <span className="text-sm sm:text-base">📊</span>
                  <span className="hidden xs:inline">Overview</span>
                </button>
                <button
                  onClick={() => setActiveTab('announcements')}
                  className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium text-[11px] sm:text-xs transition-all duration-200 ${activeTab === 'announcements'
                      ? 'bg-white text-[#800000] shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  <span className="text-sm sm:text-base">📢</span>
                  <span className="hidden xs:inline">Announcements</span>
                </button>
              </div>

              <div className="hidden md:flex gap-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 sm:px-5 sm:py-2 rounded-xl font-medium text-sm sm:text-base transition-all duration-200 ${activeTab === 'overview'
                      ? 'bg-[#800000]/10 text-[#800000] shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('announcements')}
                  className={`px-4 py-2 sm:px-5 sm:py-2 rounded-xl font-medium text-sm sm:text-base transition-all duration-200 ${activeTab === 'announcements'
                      ? 'bg-[#800000]/10 text-[#800000] shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  Announcements
                </button>
              </div>

              

<NotificationBell
  userId={session.user.id}
  onNotificationClick={(notification) => {
    if (notification.link) {
      console.log('🔔 Notification clicked:', notification);
      
      // ✅ Extract announcement ID from link
      const linkParts = notification.link.split('/');
      const announcementId = linkParts[linkParts.length - 1];
      
      // ✅ Switch to announcements tab
      setActiveTab('announcements');
      
      // ✅ Scroll to the specific announcement after a short delay
      setTimeout(() => {
        const element = document.getElementById(`announcement-${announcementId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-[#800000]', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-[#800000]', 'ring-offset-2');
          }, 3000);
        }
      }, 300);
    }
  }}
/>

              {/* Sign Out Button with Confirmation */}
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowSignOutConfirm(true)}
                disabled={signOutLoading}
                className="!px-2 !py-1 sm:!px-3 sm:!py-1.5 text-[11px] sm:text-sm"
              >
                {signOutLoading ? 'Signing Out...' : 'Sign Out'}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {activeTab === 'overview' ? (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-[#800000]/5 via-transparent to-transparent rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <h2 className="text-base sm:text-2xl font-bold text-gray-900">
                Welcome back, {getFirstName(profile?.full_name)}! 👋
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Track your career journey and stay connected with your alma mater</p>
            </div>

           {/* Profile Header Card */}
<Card className="p-4 sm:p-6 hover:shadow-xl transition-all duration-300">
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="relative group">
        <img
          src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'A')}&background=800000&color=fff&rounded=true&size=80`}
          alt="Profile"
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg ring-4 ring-white"
        />
        <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <label className="cursor-pointer p-1 sm:p-1.5 bg-white rounded-full text-gray-700 hover:bg-gray-100 transition-colors text-xs sm:text-base">
            📷
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />
          </label>
          {profile?.avatar_url && (
            <button
              onClick={removeAvatar}
              className="p-1 sm:p-1.5 bg-white rounded-full text-red-500 hover:bg-gray-100 transition-colors text-xs sm:text-base"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h2 className="text-base sm:text-2xl font-bold text-gray-900">{profile?.full_name || 'Loading...'}</h2>
          <Badge variant="success">✓ Verified</Badge>
          {profile?.gender && (
            <Badge variant={profile.gender === 'Male' ? 'info' : 'warning'}>
              {profile.gender === 'Male' ? '' : ''} {profile.gender}
            </Badge>
          )}
        </div>
        <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
          {profile?.course || 'Course not set'} • Class of {profile?.batch_year || '----'}
        </p>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {profile?.employment_status && profile.employment_status !== 'Unemployed' && (
            <Badge variant="info">{profile.employment_status}</Badge>
          )}
          <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-lg bg-amber-50 text-amber-700">
             Verified from Master List
          </span>
        </div>
      </div>
    </div>
    <Button size="sm" onClick={() => setShowEmploymentModal(true)}>
      Update Career
    </Button>
  </div>
</Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <Card className="p-3 sm:p-6 cursor-pointer hover:border-[#800000]/30 transition-all group"  >
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 rounded-lg sm:rounded-xl flex items-center justify-center text-lg sm:text-2xl mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
                  💼
                </div>
                <h3 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Current Role</h3>
                <p className="text-sm sm:text-lg font-bold text-gray-900 truncate">{profile?.job_title || 'Not Set'}</p>
                <p className="text-[10px] sm:text-sm text-gray-500 mt-0.5 sm:mt-1 truncate">{profile?.company || 'Company not set'}</p>
              </Card>

              <Card className="p-3 sm:p-6 cursor-pointer hover:border-[#800000]/30 transition-all group"  >
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg sm:rounded-xl flex items-center justify-center text-lg sm:text-2xl mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
                  📊
                </div>
                <h3 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Employment</h3>
                <p className="text-sm sm:text-lg font-bold text-gray-900">{profile?.employment_status || 'Unemployed'}</p>
                <p className="text-[10px] sm:text-sm text-gray-500 mt-0.5 sm:mt-1">Status</p>
              </Card>

              <Card className="p-3 sm:p-6">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-100 rounded-lg sm:rounded-xl flex items-center justify-center text-lg sm:text-2xl mb-2 sm:mb-4">
                  🎯
                </div>
                <h3 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Alignment</h3>
                <div className="flex items-center gap-2">
                  {profile?.career_alignment_status === 'In-Field' ? (
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-green-100 text-green-700">✓ In-Field</span>
                  ) : profile?.career_alignment_status === 'Out-of-Field' ? (
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-amber-100 text-amber-700">⚠️ Out-of-Field</span>
                  ) : (
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-gray-100 text-gray-500">⏳ Pending</span>
                  )}
                </div>
                {profile?.ai_confidence_score && profile.ai_confidence_score > 0 && (
                  <p className="text-[10px] sm:text-sm text-gray-500 mt-1">{Math.round(profile.ai_confidence_score * 100)}% confidence</p>
                )}
              </Card>

              <Card className="p-3 sm:p-6">
                <ProgressBar value={completionScore} label="Profile Completion" showPercentage={true} />
                <p className="text-[10px] sm:text-xs text-gray-400 mt-2 sm:mt-3">
                  {completionScore === 100 ? 'Complete!' : `${100 - completionScore}% remaining`}
                </p>
              </Card>
            </div>

            {/* Verified Information Section */}
<Card className="p-4 sm:p-6 bg-gradient-to-r from-amber-50/30 to-transparent border-amber-100">
  <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-lg">
      🔒
    </div>
    <div>
      <h3 className="text-sm sm:text-lg font-bold text-gray-900">Verified Academic Records</h3>
      <p className="text-[10px] sm:text-xs text-gray-500">From Master List - Contact admin for corrections</p>
    </div>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
    <InfoBox
      title="Full Name"
      value={profile?.full_name}
      icon="👤"
      hint="Official records - Contact admin"
    />
    <InfoBox
      title="Gender"
      value={profile?.gender || 'Not specified'}
      icon={profile?.gender === 'Male' ? '' : profile?.gender === 'Female' ? '' : '🚻'}
      hint="Official records - Contact admin"
    />
    <InfoBox
      title="Course / Program"
      value={profile?.course}
      icon="📚"
      hint="Official records - Contact admin"
    />
    <InfoBox
      title="Batch Year"
      value={profile?.batch_year}
      icon="🎓"
      hint="Official records - Contact admin"
    />
  </div>
</Card>

            {/* Career Information Section */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#800000]/10 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-lg">
                    📋
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">Career Information</h3>
                  <Badge variant="default">✏️ Editable</Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowEmploymentModal(true)}>
                  Update Career Info
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Title</label>
                  <p className="text-sm sm:text-base text-gray-900 font-medium">{profile?.job_title || 'Not specified'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</label>
                  <p className="text-sm sm:text-base text-gray-900 font-medium">{profile?.company || 'Not specified'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Industry</label>
                  <p className="text-sm sm:text-base text-gray-900 font-medium">{profile?.industry || 'Not specified'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</label>
                  <p className="text-sm sm:text-base text-gray-900 font-medium">{profile?.location || 'Not specified'}</p>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">LinkedIn Profile</label>
                  {profile?.linkedin_url ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#800000] text-sm sm:text-base font-medium hover:underline inline-flex items-center gap-1 break-all"
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                        <span className="truncate max-w-[200px] sm:max-w-none">{profile.linkedin_url}</span>
                      </a>
                      <Badge variant="success">✓ Connected</Badge>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm sm:text-base">Not specified - <button onClick={() => setShowEmploymentModal(true)} className="text-[#800000] hover:underline">Add LinkedIn</button></p>
                  )}
                </div>
              </div>
            </Card>

            {/* Recent Activity Section */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#800000]/10 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-lg">
                  📋
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Recent Activity</h3>
              </div>
              <ActivityTimeline activities={activities} loading={activitiesLoading} />
            </Card>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#800000]/10 rounded-xl flex items-center justify-center text-xl sm:text-2xl">
                  📢
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Announcements</h2>
                  {unreadCount > 0 && (
                    <p className="text-xs sm:text-sm text-gray-500">You have {unreadCount} unread announcement{unreadCount !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => announcements.filter(a => !a.viewed).forEach(a => markAnnouncementAsRead(a.id))}
                >
                  Mark all as read
                </Button>
              )}
            </div>
            <Card>
              <AnnouncementPage
                announcements={announcements}
                loading={announcementsLoading}
                onMarkAsRead={markAnnouncementAsRead}
                commentsByAnnouncement={commentsByAnnouncement}
                commentLoading={commentLoading}
                session={session}
                isAdmin={isAdmin}
                onAddComment={addComment}
                onDeleteComment={deleteComment}
                onEditComment={editComment}
              />
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-8 sm:mt-12 py-6 sm:py-8 text-center">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#800000] to-[#a10000] rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg mx-auto mb-3 sm:mb-4 shadow-md">
            GT
          </div>
          <p className="text-xs sm:text-sm text-gray-600 font-medium">Cebu Roosevelt Memorial Colleges</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1">Alumni Relations & Career Tracking Platform</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-3 sm:mt-4">© 2026 All Rights Reserved</p>
        </div>
      </footer>

      {/* Career Information Modal */}
      <Modal isOpen={showEmploymentModal} onClose={() => setShowEmploymentModal(false)} title="Update Career Information" size="lg">
        <div className="space-y-3 sm:space-y-4">

          {/* Locked Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-amber-800 flex items-start gap-2">
              <span>🔒</span>
              <span><strong>Full Name, Course, and Batch Year</strong> are locked from the master list. Only career information can be updated.</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

            {/* EMPLOYMENT STATUS - Comes FIRST */}
            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Employment Status <span className="text-red-500">*</span>
              </label>
              <select
                value={employmentForm.employment_status}
                onChange={e => setEmploymentForm({ ...employmentForm, employment_status: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all text-gray-900 text-sm sm:text-base"
              >
                <option value="Employed">Full Time</option>
                <option value="Employed Part Time">Part Time</option>
                <option value="Self-Employed">Self-Employed</option>
                <option value="Freelancer">Independent Contractor</option>
                <option value="Seasonal Worker">Seasonal Worker</option>
                <option value="Unemployed">Unemployed</option>
              </select>
            </div>

            {/* CAREER FIELDS - Only show if NOT Unemployed/Seasonal Worker */}
            {employmentForm.employment_status !== 'Unemployed' &&
                (
                <>
                  <Input
                    label="Job Title"
                    value={employmentForm.job_title}
                    onChange={e => setEmploymentForm({ ...employmentForm, job_title: e.target.value })}
                    placeholder="e.g., Software Engineer"
                    icon="💼"
                  />

                  <Input
                    label="Company"
                    value={employmentForm.company}
                    onChange={e => setEmploymentForm({ ...employmentForm, company: e.target.value })}
                    placeholder="Company name"
                    icon="🏢"
                  />

                  {/* Industry Dropdown */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Industry
                    </label>
                    <select
                      value={employmentForm.industry}
                      onChange={e => setEmploymentForm({ ...employmentForm, industry: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select Industry</option>
                      <option value="Information Technology (IT) / BPO">Information Technology (IT) / BPO</option>
                      <option value="Education">Education</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Government / Public Sector">Government / Public Sector</option>
                      <option value="Business / Finance / Banking">Business / Finance / Banking</option>
                      <option value="Retail / Sales / E-commerce">Retail / Sales / E-commerce</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Construction / Engineering">Construction / Engineering</option>
                      <option value="Hospitality / Tourism / Food Service">Hospitality / Tourism / Food Service</option>
                      <option value="Agriculture / Fisheries">Agriculture / Fisheries</option>
                      <option value="Telecommunications">Telecommunications</option>
                      <option value="Transportation / Logistics">Transportation / Logistics</option>
                      <option value="Media / Entertainment">Media / Entertainment</option>
                      <option value="Real Estate / Property">Real Estate / Property</option>
                      <option value="Legal / Law Firm">Legal / Law Firm</option>
                      <option value="Non-Profit / NGO">Non-Profit / NGO</option>
                      <option value="Energy / Utilities">Energy / Utilities</option>
                      <option value="Mining / Oil / Gas">Mining / Oil / Gas</option>
                      <option value="Pharmaceutical / Biotech">Pharmaceutical / Biotech</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Consulting / Professional Services">Consulting / Professional Services</option>
                      <option value="Research & Development">Research & Development</option>
                      <option value="Arts / Design / Creative">Arts / Design / Creative</option>
                      <option value="Sports / Recreation">Sports / Recreation</option>
                      <option value="Military / Defense">Military / Defense</option>
                      <option value="Religious / Faith-Based Organizations">Religious / Faith-Based Organizations</option>
                    </select>
                  </div>

                  {/* PHILIPPINE ADDRESS SELECTOR */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Work Location
                    </label>

                    {/* Region Dropdown */}
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white mb-2"
                    >
                      <option value="">Select Region</option>
                      {Array.isArray(regions) && regions.map((region: any) => (
                        <option key={region?.psgc || Math.random()} value={region?.psgc || ''}>
                          {region?.name || 'Unknown Region'}
                        </option>
                      ))}
                    </select>

                    {/* Province Dropdown */}
                    {selectedRegion && Array.isArray(provinces) && provinces.length > 0 && (
                      <select
                        value={selectedProvince}
                        onChange={(e) => setSelectedProvince(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white mb-2"
                      >
                        <option value="">Select Province</option>
                        {provinces.map((province: any) => (
                          <option key={province?.psgc || Math.random()} value={province?.psgc || ''}>
                            {province?.name || 'Unknown Province'}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* City/Municipality Dropdown */}
                    {selectedProvince && Array.isArray(cities) && cities.length > 0 && (
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white mb-2"
                      >
                        <option value="">Select City/Municipality</option>
                        {cities.map((city: any) => (
                          <option key={city?.psgc || Math.random()} value={city?.psgc || ''}>
                            {city?.name || 'Unknown City'}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Barangay Dropdown */}
                    {selectedCity && Array.isArray(barangays) && barangays.length > 0 && (
                      <select
                        value={selectedBarangay}
                        onChange={(e) => setSelectedBarangay(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white mb-2"
                      >
                        <option value="">Select Barangay</option>
                        {barangays.map((barangay: any) => (
                          <option key={barangay?.psgc || Math.random()} value={barangay?.psgc || ''}>
                            {barangay?.name || 'Unknown Barangay'}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Street/Sitio/Purok Input */}
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Street / Sitio / Purok / Subdivision (optional)"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                    />

                    <p className="text-xs text-gray-400 mt-1">
                      Select region, province, city/municipality, and barangay. Add street if applicable.
                    </p>
                  </div>
                </>
            )}

            {/* MESSAGE FOR UNEMPLOYED / SEASONAL WORKER */}
            {(employmentForm.employment_status === 'Unemployed' ||
              employmentForm.employment_status === 'Seasonal Worker') && (
                <div className="sm:col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    ℹ️ Since you are currently <strong>{employmentForm.employment_status}</strong>, you don't need to fill in career details.
                    You can update this later when your status changes.
                  </p>
                </div>
              )}

            {/* LINKEDIN - Always Visible */}
            <div className="sm:col-span-2">
              <Input
                label="LinkedIn Profile URL"
                value={employmentForm.linkedin_url}
                onChange={e => setEmploymentForm({ ...employmentForm, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/yourusername"
                icon="🔗"
              />
              {employmentForm.linkedin_url && (
                <div className="mt-2">
                  <a
                    href={employmentForm.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs sm:text-sm text-[#800000] hover:underline inline-flex items-center gap-1"
                  >
                    <span>🔗</span> View your LinkedIn profile →
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Save/Cancel Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-3 sm:pt-4">
            <Button onClick={handleSaveEmployment} loading={saveLoading} className="flex-1">
              Save Career Info
            </Button>
            <Button variant="secondary" onClick={() => setShowEmploymentModal(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className={`px-4 py-2 sm:px-6 sm:py-3 rounded-xl shadow-lg flex items-center gap-2 text-white font-medium text-xs sm:text-sm ${toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`}>
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* BLOCK: SIGN OUT CONFIRMATION MODAL */}
      {/* ========================================================== */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full mx-4 p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sign Out</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Are you sure you want to sign out? You'll need to log in again to access your dashboard.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={signOutLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {signOutLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing out...
                    </>
                  ) : (
                    'Yes, Sign Out'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
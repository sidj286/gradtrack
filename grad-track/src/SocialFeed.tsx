// src/SocialFeed.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { 
  notifyCommentAdded, 
  notifyReplyAdded, 
  sendNotification 
} from './lib/notificationUtils';

interface Post {
  id: string;
  user_id: string;
  content: string;
  post_type: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  alumni_profiles: {
    full_name: string;
    avatar_url: string | null;
    course: string | null;
    batch_year: number | null;
    employment_status: string | null;
    job_title: string | null;
    company: string | null;
  };
  alumni_likes: { user_id: string }[];
  alumni_comments: Comment[];
  alumni_shares: { user_id: string }[];
  like_count: number;
  comment_count: number;
  share_count: number;
  user_liked: boolean;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  alumni_profiles: {
    full_name: string;
    avatar_url: string | null;
  };
  replies?: CommentReply[];
  reply_count?: number;
  user_liked?: boolean;
}

interface CommentReply {
  id: string;
  comment_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  alumni_profiles: {
    full_name: string;
    avatar_url: string | null;
  };
  user_liked?: boolean;
}

interface AlumniDirectoryEntry {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  course: string | null;
  batch_year: number | null;
  employment_status: string | null;
  job_title: string | null;
  company: string | null;
  matchReason: string;
}

interface AlumniFullProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  course: string | null;
  batch_year: number | null;
  employment_status: string | null;
  job_title: string | null;
  company: string | null;
  industry: string | null;
  location: string | null;
  linkedin_url: string | null;
  gender: string | null;
}

interface SocialFeedProps {
  session: Session;
  profile: any;
}

interface SearchResult {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  course: string | null;
  batch_year: number | null;
  employment_status: string | null;
  job_title: string | null;
  company: string | null;
}

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ children, onClick, disabled, loading, size = 'md', className = '' }) => {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`bg-[#800000] hover:bg-[#6a0000] text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${className}`}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

// Three Dots Menu Component
const ThreeDotsMenu: React.FC<{
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  isOwner: boolean;
  menuPosition?: 'left' | 'right';
}> = ({ onEdit, onDelete, onCopy, isOwner, menuPosition = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="text-gray-400 hover:text-gray-600 transition text-sm p-1 rounded-full hover:bg-gray-100"
        title="More options"
      >
        ⋮
      </button>
      {isOpen && (
        <div className={`absolute ${menuPosition === 'right' ? 'right-0' : 'left-0'} mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50`}>
          {isOwner && onEdit && (
            <button
              onClick={() => { onEdit(); setIsOpen(false); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              ✏️ Edit
            </button>
          )}
          {onCopy && (
            <button
              onClick={() => { onCopy(); setIsOpen(false); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              📋 Copy
            </button>
          )}
          {isOwner && onDelete && (
            <button
              onClick={() => { onDelete(); setIsOpen(false); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
            >
              🗑️ Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Alumni Directory component
const AlumniDirectory: React.FC<{
  entries: AlumniDirectoryEntry[];
  loading: boolean;
  onSelect: (userId: string) => void;
}> = ({ entries, loading, onSelect }) => {
  if (loading) {
    return (
      <Card className="p-4 mb-4">
        <div className="flex gap-3 overflow-x-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-20 animate-pulse">
              <div className="w-14 h-14 rounded-full bg-gray-200 mx-auto" />
              <div className="h-2 bg-gray-200 rounded mt-2 w-3/4 mx-auto" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (entries.length === 0) return null;

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🤝</span>
        <h3 className="text-sm font-bold text-gray-900">People you may know</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {entries.map((entry) => (
          <button
            key={entry.user_id}
            onClick={() => onSelect(entry.user_id)}
            className="flex-shrink-0 w-20 text-center group"
          >
            <img
              src={
                entry.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  entry.full_name || 'A'
                )}&background=800000&color=fff&rounded=true&size=56`
              }
              alt={entry.full_name || 'Alumni'}
              className="w-14 h-14 rounded-full object-cover mx-auto ring-2 ring-transparent group-hover:ring-[#800000]/40 transition-all"
            />
            <p className="text-[11px] font-semibold text-gray-800 mt-1.5 truncate">
              {entry.full_name || 'Alumni'}
            </p>
            <p className="text-[10px] text-[#800000] truncate">{entry.matchReason}</p>
          </button>
        ))}
      </div>
    </Card>
  );
};

// ============================================================
// PROFILE MODAL - WITHOUT MAROON HEADER
// ============================================================
const ProfileModal: React.FC<{
  loading: boolean;
  profile: AlumniFullProfile | null;
  onClose: () => void;
}> = ({ loading, profile, onClose }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto">
        {/* Close button - top right, no maroon header */}
        <div className="sticky top-0 z-20 bg-white pt-4 px-4 flex justify-end">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition"
          >
            ×
          </button>
        </div>

        {/* Profile Content */}
        <div className="px-6 pb-6">
          {loading || !profile ? (
            <div className="space-y-3 animate-pulse">
              <div className="w-20 h-20 rounded-full bg-gray-200 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
              <div className="h-3 bg-gray-200 rounded w-1/3 mx-auto" />
              <div className="h-3 bg-gray-200 rounded w-2/3 mx-auto" />
            </div>
          ) : (
            <>
              {/* Avatar - Centered */}
              <div className="flex justify-center">
                <img
                  src={
                    profile.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      profile.full_name || 'A'
                    )}&background=800000&color=fff&rounded=true&size=80`
                  }
                  alt={profile.full_name || 'Alumni'}
                  className="w-20 h-20 rounded-full object-cover border-4 border-gray-200 shadow-md"
                />
              </div>

              {/* Name and Course */}
              <div className="text-center mt-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {profile.full_name || 'Alumni'}
                </h3>
                <p className="text-sm text-gray-500">
                  {profile.course || 'Course not set'}
                  {profile.batch_year ? ` • Class of ${profile.batch_year}` : ''}
                </p>
              </div>

              {/* Profile Details */}
              <div className="grid grid-cols-1 gap-3 mt-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Current Role
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {profile.job_title || 'Not specified'}
                    {profile.company ? ` at ${profile.company}` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {profile.employment_status || 'Not specified'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      Industry
                    </p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">
                      {profile.industry || 'Not specified'}
                    </p>
                  </div>
                </div>

                {profile.location && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      Location
                    </p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{profile.location}</p>
                  </div>
                )}

                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#800000] font-semibold hover:underline inline-flex items-center justify-center gap-1 bg-gray-50 rounded-xl p-3 transition hover:bg-gray-100"
                  >
                    🔗 View LinkedIn Profile →
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SEARCH ALUMNI COMPONENT
// ============================================================
const SearchAlumni: React.FC<{
  onSelect: (userId: string) => void;
  currentUserId: string;
}> = ({ onSelect, currentUserId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performSearch(searchTerm.trim());
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const performSearch = async (term: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alumni_profiles')
        .select('user_id, full_name, avatar_url, course, batch_year, employment_status, job_title, company')
        .neq('user_id', currentUserId)
        .or(`full_name.ilike.%${term}%,course.ilike.%${term}%,job_title.ilike.%${term}%,company.ilike.%${term}%`)
        .limit(20);

      if (error) throw error;

      const resultsWithAvatars = data?.map((item: any) => ({
        ...item,
        avatar_url: item.avatar_url 
          ? (item.avatar_url.startsWith('http') 
              ? item.avatar_url 
              : supabase.storage.from('profile-pictures').getPublicUrl(item.avatar_url).data.publicUrl)
          : null
      })) || [];

      setResults(resultsWithAvatars);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching alumni:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (userId: string) => {
    setSearchTerm('');
    setResults([]);
    setShowResults(false);
    onSelect(userId);
  };

  return (
    <div className="relative" ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search alumni by name, course, job title, or company..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-100 hover:bg-gray-200 focus:bg-white border border-transparent focus:border-[#800000] rounded-full text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#800000]/20 transition-all duration-200 outline-none"
          onFocus={() => searchTerm.trim().length >= 2 && setShowResults(true)}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin" />
          </div>
        )}
        {searchTerm && !loading && (
          <button
            onClick={() => {
              setSearchTerm('');
              setResults([]);
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-80 overflow-y-auto z-50">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block w-5 h-5 border-2 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin mr-2" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm.trim().length >= 2 ? 'No alumni found' : 'Type at least 2 characters to search'}
            </div>
          ) : (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={result.user_id}
                  onClick={() => handleSelect(result.user_id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors duration-150 text-left"
                >
                  <img
                    src={
                      result.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        result.full_name || 'A'
                      )}&background=800000&color=fff&rounded=true&size=40`
                    }
                    alt={result.full_name || 'Alumni'}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {result.full_name || 'Unknown Alumni'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {result.course && <span className="truncate">{result.course}</span>}
                      {result.batch_year && <span>• Class of {result.batch_year}</span>}
                    </div>
                    {result.job_title && (
                      <p className="text-xs text-gray-400 truncate">
                        {result.job_title}{result.company ? ` at ${result.company}` : ''}
                      </p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function SocialFeed({ session, profile }: SocialFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showPostModal, setShowPostModal] = useState(false);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState('');

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [editingCommentPostId, setEditingCommentPostId] = useState<string | null>(null);

  const [showReplyInput, setShowReplyInput] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyContent, setEditingReplyContent] = useState('');
  const [editingReplyCommentId, setEditingReplyCommentId] = useState<string | null>(null);
  const [editingReplyPostId, setEditingReplyPostId] = useState<string | null>(null);

  const [alumniDirectory, setAlumniDirectory] = useState<AlumniDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [viewProfile, setViewProfile] = useState<AlumniFullProfile | null>(null);
  const [viewProfileLoading, setViewProfileLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // New state for search profile modal
  const [showSearchProfileModal, setShowSearchProfileModal] = useState(false);
  const [searchViewProfile, setSearchViewProfile] = useState<AlumniFullProfile | null>(null);
  const [searchViewProfileLoading, setSearchViewProfileLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const POSTS_PER_PAGE = 10;

  const resolveAvatar = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('profile-pictures').getPublicUrl(path);
    return data.publicUrl;
  };

  // FETCH POSTS
  const fetchPosts = async (reset = true) => {
    if (reset) {
      setPage(0);
      setPosts([]);
    }

    try {
      setLoading(true);
      setError(null);
      const from = reset ? 0 : page * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      const { data: postsData, error: postsError } = await supabase
        .from('alumni_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (postsError) {
        console.error('Posts error:', postsError);
        setError(`Database error: ${postsError.message}`);
        throw postsError;
      }

      if (!postsData || postsData.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      const userIds = postsData.map(post => post.user_id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('alumni_profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Profiles error:', profilesError);
        throw profilesError;
      }

      const postIds = postsData.map(post => post.id);
      
      const { data: likesData, error: likesError } = await supabase
        .from('alumni_likes')
        .select('*')
        .in('post_id', postIds);

      if (likesError) console.error('Likes error:', likesError);

      const { data: commentsData, error: commentsError } = await supabase
        .from('alumni_comments')
        .select('*')
        .in('post_id', postIds);

      if (commentsError) console.error('Comments error:', commentsError);

      const commenterIds = commentsData ? commentsData.map(c => c.user_id) : [];
      let commenterProfiles = [];
      if (commenterIds.length > 0) {
        const { data: cpData } = await supabase
          .from('alumni_profiles')
          .select('*')
          .in('user_id', commenterIds);
        commenterProfiles = cpData || [];
      }

      let commentLikesData: any[] = [];
      if (commentsData && commentsData.length > 0) {
        const commentIds = commentsData.map(c => c.id);
        const { data: clData } = await supabase
          .from('comment_likes')
          .select('*')
          .in('comment_id', commentIds);
        commentLikesData = clData || [];
      }

      let repliesData: any[] = [];
      if (commentsData && commentsData.length > 0) {
        const commentIds = commentsData.map(c => c.id);
        const { data: rData } = await supabase
          .from('comment_replies')
          .select('*')
          .in('comment_id', commentIds)
          .order('created_at', { ascending: true });
        repliesData = rData || [];
      }

      let replyProfiles = [];
      if (repliesData && repliesData.length > 0) {
        const replyUserIds = repliesData.map(r => r.user_id);
        const { data: rpData } = await supabase
          .from('alumni_profiles')
          .select('*')
          .in('user_id', replyUserIds);
        replyProfiles = rpData || [];
      }

      let replyLikesData: any[] = [];
      if (repliesData && repliesData.length > 0) {
        const replyIds = repliesData.map(r => r.id);
        const { data: rlData } = await supabase
          .from('reply_likes')
          .select('*')
          .in('reply_id', replyIds);
        replyLikesData = rlData || [];
      }

      const { data: sharesData, error: sharesError } = await supabase
        .from('alumni_shares')
        .select('*')
        .in('post_id', postIds);

      if (sharesError) console.error('Shares error:', sharesError);

      const transformedPosts = postsData.map((post: any) => {
        const profile = profilesData?.find((p: any) => p.user_id === post.user_id);
        const likes = likesData?.filter((l: any) => l.post_id === post.id) || [];
        const shares = sharesData?.filter((s: any) => s.post_id === post.id) || [];
        
        const comments = (commentsData || [])
          .filter((c: any) => c.post_id === post.id)
          .map((comment: any) => {
            const commenterProfile = commenterProfiles.find((p: any) => p.user_id === comment.user_id);
            const commentLikes = commentLikesData.filter((cl: any) => cl.comment_id === comment.id);
            const replies = (repliesData || [])
              .filter((r: any) => r.comment_id === comment.id)
              .map((reply: any) => {
                const replyProfile = replyProfiles.find((p: any) => p.user_id === reply.user_id);
                const replyLikes = replyLikesData.filter((rl: any) => rl.reply_id === reply.id);
                return {
                  ...reply,
                  alumni_profiles: replyProfile || {
                    full_name: 'Unknown User',
                    avatar_url: null
                  },
                  user_liked: replyLikes.some((rl: any) => rl.user_id === session.user.id) || false,
                };
              });

            return {
              ...comment,
              alumni_profiles: commenterProfile || {
                full_name: 'Unknown User',
                avatar_url: null
              },
              replies: replies,
              reply_count: replies.length,
              user_liked: commentLikes.some((cl: any) => cl.user_id === session.user.id) || false,
            };
          });

        return {
          ...post,
          alumni_profiles: profile || {
            full_name: 'Unknown User',
            avatar_url: null,
            course: null,
            batch_year: null,
            employment_status: null,
            job_title: null,
            company: null
          },
          alumni_likes: likes,
          alumni_comments: comments,
          alumni_shares: shares,
          like_count: likes.length,
          comment_count: comments.length,
          share_count: shares.length,
          user_liked: likes.some((like: any) => like.user_id === session.user.id) || false,
          user_shared: shares.some((share: any) => share.user_id === session.user.id) || false,
        };
      });

      if (reset) {
        setPosts(transformedPosts);
        setPage(1);
      } else {
        setPosts([...posts, ...transformedPosts]);
        setPage(page + 1);
      }

      setHasMore(transformedPosts.length === POSTS_PER_PAGE);
    } catch (error: any) {
      console.error('Error fetching posts:', error);
      setError(error.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  // FETCH ALUMNI DIRECTORY
  const fetchAlumniDirectory = async () => {
    setDirectoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('alumni_profiles')
        .select(
          'user_id, full_name, avatar_url, course, batch_year, employment_status, job_title, company'
        )
        .neq('user_id', session.user.id)
        .limit(40);

      if (error) throw error;
      if (!data) return;

      const course = profile?.course ?? null;
      const batchYear = profile?.batch_year ?? null;
      const employmentStatus = profile?.employment_status ?? null;

      const scored = data.map((p: any) => {
        let score = 0;
        let reason = 'New alumni';

        if (course && p.course === course) {
          score += 3;
          reason = `Also studied ${p.course}`;
        }
        if (batchYear && p.batch_year === batchYear) {
          score += 2;
          reason = score <= 2 ? `Batch ${p.batch_year}` : `${reason} • Batch ${p.batch_year}`;
        }
        if (employmentStatus && p.employment_status === employmentStatus) {
          score += 1;
          if (score <= 1) reason = `Also ${p.employment_status}`;
        }

        return {
          ...p,
          avatar_url: resolveAvatar(p.avatar_url),
          matchReason: reason,
          score,
        };
      });

      scored.sort((a: any, b: any) => b.score - a.score);
      setAlumniDirectory(scored.slice(0, 12));
    } catch (error) {
      console.error('Error fetching alumni directory:', error);
    } finally {
      setDirectoryLoading(false);
    }
  };

  // OPEN PROFILE
  const openProfile = async (userId: string) => {
    setShowProfileModal(true);
    setViewProfile(null);
    setViewProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('alumni_profiles')
        .select(
          'user_id, full_name, avatar_url, course, batch_year, employment_status, job_title, company, industry, location, linkedin_url, gender'
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setViewProfile({ ...data, avatar_url: resolveAvatar(data.avatar_url) });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setViewProfileLoading(false);
    }
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setViewProfile(null);
  };

  // OPEN PROFILE FROM SEARCH
  const openSearchProfile = async (userId: string) => {
    setShowSearchProfileModal(true);
    setSearchViewProfile(null);
    setSearchViewProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('alumni_profiles')
        .select(
          'user_id, full_name, avatar_url, course, batch_year, employment_status, job_title, company, industry, location, linkedin_url, gender'
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSearchViewProfile({ ...data, avatar_url: resolveAvatar(data.avatar_url) });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setSearchViewProfileLoading(false);
    }
  };

  const closeSearchProfileModal = () => {
    setShowSearchProfileModal(false);
    setSearchViewProfile(null);
  };

  // CREATE POST
  const handleCreatePost = async () => {
    if (!newPost.trim() && !imageFile) return;

    setSubmitting(true);
    setError(null);
    try {
      let imageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('alumni_posts').insert({
        user_id: session.user.id,
        content: newPost.trim(),
        image_url: imageUrl,
        post_type: 'status',
      });

      if (error) throw error;

      setNewPost('');
      setImageFile(null);
      setImagePreview(null);
      setShowPostModal(false);
      await fetchPosts(true);
    } catch (error: any) {
      console.error('Error creating post:', error);
      setError(error.message || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  // EDIT POST
  const handleEditPost = async (postId: string) => {
    if (!editingPostContent.trim()) {
      alert('Content cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('alumni_posts')
        .update({ 
          content: editingPostContent.trim(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', postId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setPosts(
        posts.map((p) =>
          p.id === postId ? { ...p, content: editingPostContent.trim(), updated_at: new Date().toISOString() } : p
        )
      );

      setEditingPostId(null);
      setEditingPostContent('');
    } catch (error) {
      console.error('Error editing post:', error);
      alert('Failed to edit post');
    }
  };

  // EDIT COMMENT
  const handleEditComment = async (commentId: string, postId: string) => {
    if (!editingCommentContent.trim()) {
      alert('Content cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('alumni_comments')
        .update({ 
          content: editingCommentContent.trim(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', commentId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setPosts(
        posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                alumni_comments: p.alumni_comments.map((c) =>
                  c.id === commentId ? { ...c, content: editingCommentContent.trim(), updated_at: new Date().toISOString() } : c
                ),
              }
            : p
        )
      );

      setEditingCommentId(null);
      setEditingCommentContent('');
      setEditingCommentPostId(null);
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Failed to edit comment');
    }
  };

  // EDIT REPLY
  const handleEditReply = async (postId: string, commentId: string, replyId: string) => {
    if (!editingReplyContent.trim()) {
      alert('Content cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('comment_replies')
        .update({ 
          content: editingReplyContent.trim(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', replyId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setPosts(
        posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                alumni_comments: p.alumni_comments.map((c) =>
                  c.id === commentId
                    ? {
                        ...c,
                        replies: c.replies?.map((r) =>
                          r.id === replyId ? { ...r, content: editingReplyContent.trim(), updated_at: new Date().toISOString() } : r
                        ) || [],
                      }
                    : c
                ),
              }
            : p
        )
      );

      setEditingReplyId(null);
      setEditingReplyContent('');
      setEditingReplyCommentId(null);
      setEditingReplyPostId(null);
    } catch (error) {
      console.error('Error editing reply:', error);
      alert('Failed to edit reply');
    }
  };

  // LIKE/UNLIKE POST
  const handleLike = async (postId: string) => {
    try {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      if (post.user_liked) {
        await supabase
          .from('alumni_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', session.user.id);

        setPosts(
          posts.map((p) =>
            p.id === postId ? { ...p, user_liked: false, like_count: p.like_count - 1 } : p
          )
        );
      } else {
        await supabase.from('alumni_likes').insert({
          post_id: postId,
          user_id: session.user.id,
        });

        const currentUserFullName = profile?.full_name || 'Someone';
        if (post.user_id !== session.user.id) {
          await sendNotification(
            post.user_id,
            'comment', 
            '❤️ New Like',
            `${currentUserFullName} liked your post.`,
            `/feed/${postId}`,
            { post_id: postId, liker_id: session.user.id }
          );
        }

        setPosts(
          posts.map((p) =>
            p.id === postId ? { ...p, user_liked: true, like_count: p.like_count + 1 } : p
          )
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // LIKE/UNLIKE COMMENT
  const handleCommentLike = async (commentId: string, postId: string) => {
    try {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      const comment = post.alumni_comments.find((c) => c.id === commentId);
      if (!comment) return;

      if (comment.user_liked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', session.user.id);

        setPosts(
          posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  alumni_comments: p.alumni_comments.map((c) =>
                    c.id === commentId ? { ...c, user_liked: false } : c
                  ),
                }
              : p
          )
        );
      } else {
        await supabase.from('comment_likes').insert({
          comment_id: commentId,
          user_id: session.user.id,
        });

        setPosts(
          posts.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  alumni_comments: p.alumni_comments.map((c) =>
                    c.id === commentId ? { ...c, user_liked: true } : c
                  ),
                }
              : p
          )
        );
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  // ADD COMMENT
  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const { data: commentData, error: insertError } = await supabase
        .from('alumni_comments')
        .insert({
          post_id: postId,
          user_id: session.user.id,
          content: commentText.trim(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: profileData, error: profileError } = await supabase
        .from('alumni_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', session.user.id)
        .single();

      const fullComment = {
        ...commentData,
        alumni_profiles: profileData || {
          full_name: 'Unknown User',
          avatar_url: null
        },
        replies: [],
        reply_count: 0,
        user_liked: false,
      };

      setPosts(
        posts.map((p) =>
          p.id === postId
            ? { 
                ...p, 
                alumni_comments: [...p.alumni_comments, fullComment], 
                comment_count: p.comment_count + 1 
              }
            : p
        )
      );

      setCommentText('');
      setShowCommentInput(null);

      const currentUserFullName = profile?.full_name || 'Someone';
      const currentUserId = session.user.id;
      const post = posts.find(p => p.id === postId);

      await notifyCommentAdded(
        currentUserFullName, 
        "Social Feed Post", 
        commentText.trim(), 
        postId, 
        currentUserId
      );

      if (post && post.user_id !== currentUserId) {
        await sendNotification(
          post.user_id, 
          'comment', 
          '💬 New Comment', 
          `${currentUserFullName} commented on your post: "${commentText.trim().substring(0, 50)}..."`,
          `/feed/${postId}`,
          { post_id: postId, commenter_id: currentUserId }
        );
      }

    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // ADD REPLY
  const handleAddReply = async (commentId: string, postId: string) => {
    if (!replyText.trim()) return;

    setSubmittingReply(true);
    try {
      const { data: replyData, error: insertError } = await supabase
        .from('comment_replies')
        .insert({
          comment_id: commentId,
          user_id: session.user.id,
          content: replyText.trim(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: profileData, error: profileError } = await supabase
        .from('alumni_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', session.user.id)
        .single();

      const fullReply = {
        ...replyData,
        alumni_profiles: profileData || {
          full_name: 'Unknown User',
          avatar_url: null
        },
        user_liked: false,
      };

      setPosts(
        posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                alumni_comments: p.alumni_comments.map((c) =>
                  c.id === commentId
                    ? { 
                        ...c, 
                        replies: [...(c.replies || []), fullReply],
                        reply_count: (c.reply_count || 0) + 1
                      }
                    : c
                ),
              }
            : p
        )
      );

      setReplyText('');
      setShowReplyInput(null);

      const currentUserFullName = profile?.full_name || 'Someone';
      const post = posts.find(p => p.id === postId);
      const comment = post?.alumni_comments.find(c => c.id === commentId);

      if (comment && comment.user_id !== session.user.id) {
        await notifyReplyAdded(
          comment.user_id, 
          currentUserFullName, 
          "Social Feed", 
          replyText.trim(), 
          postId
        );
      }

    } catch (error) {
      console.error('Error adding reply:', error);
    } finally {
      setSubmittingReply(false);
    }
  };

  // DELETE POST
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await supabase.from('alumni_posts').delete().eq('id', postId).eq('user_id', session.user.id);
      setPosts(posts.filter((p) => p.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  };

  // DELETE COMMENT
  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await supabase
        .from('alumni_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', session.user.id);

      setPosts(
        posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                alumni_comments: p.alumni_comments.filter((c) => c.id !== commentId),
                comment_count: p.comment_count - 1,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    }
  };

  // DELETE REPLY
  const handleDeleteReply = async (postId: string, commentId: string, replyId: string) => {
    if (!window.confirm('Delete this reply?')) return;

    try {
      await supabase
        .from('comment_replies')
        .delete()
        .eq('id', replyId)
        .eq('user_id', session.user.id);

      setPosts(
        posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                alumni_comments: p.alumni_comments.map((c) =>
                  c.id === commentId
                    ? {
                        ...c,
                        replies: c.replies?.filter((r) => r.id !== replyId) || [],
                        reply_count: (c.reply_count || 0) - 1,
                      }
                    : c
                ),
              }
            : p
        )
      );
    } catch (error) {
      console.error('Error deleting reply:', error);
      alert('Failed to delete reply');
    }
  };

  // COPY TO CLIPBOARD
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Copied to clipboard!');
    });
  };

  // HANDLE IMAGE SELECT
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // TIME AGO FORMATTER
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  // Initial load
  useEffect(() => {
    fetchPosts(true);
    fetchAlumniDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FACEBOOK-STYLE INFINITE SCROLL (Using Window)
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;

      if (scrollTop + windowHeight >= fullHeight - 200 && hasMore && !loading) {
        fetchPosts(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading]);

  // SCROLL TO TOP FUNCTION
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 pt-4">
      
      <div className="max-w-2xl mx-auto px-3 sm:px-4 relative">
        
        {/* ============================================================ */}
        {/* SEARCH BAR - Added above create post */}
        {/* ============================================================ */}
        <div className="mb-4">
          <SearchAlumni 
            onSelect={openSearchProfile} 
            currentUserId={session.user.id}
          />
        </div>

        {/* ============================================================ */}
        {/* FACEBOOK-STYLE CREATE POST - Photo icon on same row */}
        {/* ============================================================ */}
        <div className="mb-4">
          {error && (
            <Card className="p-4 mb-4 bg-red-50 border-red-200">
              <p className="text-red-600 text-sm">❌ Error: {error}</p>
              <button 
                onClick={() => { setError(null); fetchPosts(true); }} 
                className="text-red-600 underline text-sm mt-2"
              >
                Retry
              </button>
            </Card>
          )}

          <Card className="p-4 shadow-md">
            {/* Single row: Avatar + "What's on your mind" + Photo icon */}
            <div className="flex items-center gap-3">
              <img
                src={
                  profile?.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    profile?.full_name || 'A'
                  )}&background=800000&color=fff&rounded=true&size=40`
                }
                alt="Profile"
                className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer"
                onClick={() => openProfile(session.user.id)}
              />
              
              {/* Input with photo icon inside it - on the right */}
              <div className="flex-1 relative">
                <button
                  onClick={() => setShowPostModal(true)}
                  className="w-full text-left px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-500 transition-colors pr-12"
                >
                  What's on your mind, {profile?.full_name?.split(' ')[0] || 'Alumni'}?
                </button>
                {/* Photo icon - positioned inside the input on the right */}
                <button
                  onClick={() => {
                    setShowPostModal(true);
                    setTimeout(() => {
                      const textarea = document.getElementById('modal-post-textarea');
                      if (textarea) textarea.focus();
                    }, 100);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition text-lg"
                  title="Add Photo"
                >
                  📷
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* CREATE POST MODAL - Facebook Style */}
        {/* ============================================================ */}
        {showPostModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowPostModal(false);
                setNewPost('');
                setImageFile(null);
                setImagePreview(null);
              }
            }}
          >
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-scaleIn max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-lg font-bold text-gray-900">Create Post</h3>
                <button
                  onClick={() => {
                    setShowPostModal(false);
                    setNewPost('');
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xl transition"
                >
                  ×
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="p-6 overflow-y-auto flex-1">
                {/* User Info */}
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={
                      profile?.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        profile?.full_name || 'A'
                      )}&background=800000&color=fff&rounded=true&size=40`
                    }
                    alt="Profile"
                    className="w-10 h-10 rounded-full flex-shrink-0"
                  />
                  <div>
                    <p className="font-semibold text-sm">{profile?.full_name || 'Alumni'}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span>🌐 Public</span>
                      <span>•</span>
                      <span>📅</span>
                    </div>
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  id="modal-post-textarea"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder={`What's on your mind, ${profile?.full_name?.split(' ')[0] || 'Alumni'}?`}
                  className="w-full border-0 focus:ring-0 resize-none text-lg min-h-[120px] outline-none placeholder-gray-400"
                  rows={4}
                  autoFocus
                />

                {/* Image Preview */}
                {imagePreview && (
                  <div className="relative mt-2 border border-gray-200 rounded-lg overflow-hidden">
                    <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain" />
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/80 transition"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Add to your post - Photo only */}
                <div className="mt-4 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Add to your post</span>
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                      className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-2xl transition"
                    >
                      📷
                    </button>
                  </div>
                </div>

                {/* Post Button */}
                <Button
                  onClick={handleCreatePost}
                  disabled={(!newPost.trim() && !imageFile) || submitting}
                  loading={submitting}
                  className="w-full mt-4 !py-3 text-base"
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SCROLLING FEED */}
        {/* ============================================================ */}
        <div className="space-y-4">
          
          {loading && posts.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="inline-block w-8 h-8 border-4 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin" />
              <p className="text-gray-500 mt-2">Loading feed...</p>
            </div>
          ) : posts.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-600 font-medium">No posts yet</p>
              <p className="text-sm text-gray-400 mt-1">Be the first to share something!</p>
            </Card>
          ) : (
            <>
              <AlumniDirectory entries={alumniDirectory} loading={directoryLoading} onSelect={openProfile} />

              {posts.map((post) => (
                <Card key={post.id} className="p-4 hover:shadow-md transition">
                  {/* Post Header */}
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() => openProfile(post.user_id)}
                      className="flex items-center gap-3 text-left group"
                    >
                      <img
                        src={
                          post.alumni_profiles?.avatar_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            post.alumni_profiles?.full_name || 'A'
                          )}&background=800000&color=fff&rounded=true&size=40`
                        }
                        alt={post.alumni_profiles?.full_name}
                        className="w-10 h-10 rounded-full flex-shrink-0 group-hover:ring-2 group-hover:ring-[#800000]/40 transition-all"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm sm:text-base group-hover:underline">
                            {post.alumni_profiles?.full_name}
                          </span>
                          {post.alumni_profiles?.employment_status === 'Employed' && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                              Working
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{post.alumni_profiles?.course || 'Alumni'}</span>
                          {post.alumni_profiles?.batch_year && <span>• Class of {post.alumni_profiles.batch_year}</span>}
                          <span>• {timeAgo(post.created_at)}</span>
                          {post.updated_at !== post.created_at && (
                            <span className="text-gray-400 text-[10px]">(edited)</span>
                          )}
                        </div>
                      </div>
                    </button>

                    <ThreeDotsMenu
                      isOwner={post.user_id === session.user.id}
                      onEdit={() => {
                        setEditingPostId(post.id);
                        setEditingPostContent(post.content);
                      }}
                      onDelete={() => handleDeletePost(post.id)}
                      onCopy={() => copyToClipboard(post.content)}
                      menuPosition="right"
                    />
                  </div>

                  {/* Post Content */}
                  <div className="mt-3">
                    {editingPostId === post.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingPostContent}
                          onChange={(e) => setEditingPostContent(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEditPost(post.id)}
                            size="sm"
                            className="!px-3 !py-1"
                          >
                            Save
                          </Button>
                          <button
                            onClick={() => {
                              setEditingPostId(null);
                              setEditingPostContent('');
                            }}
                            className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm sm:text-base text-gray-800 whitespace-pre-wrap">
                        {post.content}
                      </p>
                    )}
                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Post image"
                        className="mt-3 rounded-lg max-h-96 w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>

                  {/* Post Stats */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs sm:text-sm text-gray-500">
                    <span>❤️ {post.like_count}</span>
                    <span>💬 {post.comment_count}</span>
                    <span>↗️ {post.share_count || 0}</span>
                  </div>

                  {/* Post Actions */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition flex items-center justify-center gap-1 ${
                        post.user_liked ? 'text-[#800000] bg-[#800000]/5' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {post.user_liked ? '❤️' : '🤍'} Like
                    </button>
                    <button
                      onClick={() => setShowCommentInput(showCommentInput === post.id ? null : post.id)}
                      className="flex-1 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition flex items-center justify-center gap-1"
                    >
                      💬 Comment
                    </button>
                    <button className="flex-1 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition flex items-center justify-center gap-1">
                      ↗️ Share
                    </button>
                  </div>

                  {/* Comments */}
                  {showCommentInput === post.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {/* Comment Input */}
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            profile?.avatar_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              profile?.full_name || 'A'
                            )}&background=800000&color=fff&rounded=true&size=32`
                          }
                          alt="Your avatar"
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Write a comment..."
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-full focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddComment(post.id);
                              }
                            }}
                          />
                          <Button
                            onClick={() => handleAddComment(post.id)}
                            disabled={!commentText.trim() || submittingComment}
                            loading={submittingComment}
                            size="sm"
                            className="!px-3 !py-1 text-sm rounded-full"
                          >
                            Post
                          </Button>
                        </div>
                      </div>

                      {/* Comments List */}
                      <div className="mt-3 space-y-3 max-h-60 overflow-y-auto">
                        {post.alumni_comments.map((comment: Comment) => (
                          <div key={comment.id} className="flex items-start gap-2">
                            <button onClick={() => openProfile(comment.user_id)}>
                              <img
                                src={
                                  comment.alumni_profiles?.avatar_url ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    comment.alumni_profiles?.full_name || 'A'
                                  )}&background=800000&color=fff&rounded=true&size=32`
                                }
                                alt="Commenter"
                                className="w-7 h-7 rounded-full flex-shrink-0"
                              />
                            </button>
                            <div className="flex-1 bg-gray-50 rounded-lg p-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openProfile(comment.user_id)}
                                    className="text-xs font-semibold hover:underline"
                                  >
                                    {comment.alumni_profiles?.full_name}
                                  </button>
                                  <span className="text-xs text-gray-400">
                                    {timeAgo(comment.created_at)}
                                  </span>
                                  {comment.updated_at !== comment.created_at && (
                                    <span className="text-[10px] text-gray-400">(edited)</span>
                                  )}
                                </div>
                                <ThreeDotsMenu
                                  isOwner={comment.user_id === session.user.id}
                                  onEdit={() => {
                                    setEditingCommentId(comment.id);
                                    setEditingCommentContent(comment.content);
                                    setEditingCommentPostId(post.id);
                                  }}
                                  onDelete={() => handleDeleteComment(post.id, comment.id)}
                                  onCopy={() => copyToClipboard(comment.content)}
                                  menuPosition="right"
                                />
                              </div>
                              
                              {editingCommentId === comment.id && editingCommentPostId === post.id ? (
                                <div className="mt-1 space-y-2">
                                  <input
                                    type="text"
                                    value={editingCommentContent}
                                    onChange={(e) => setEditingCommentContent(e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditComment(comment.id, post.id)}
                                      className="text-xs text-[#800000] font-semibold hover:underline"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingCommentId(null);
                                        setEditingCommentContent('');
                                        setEditingCommentPostId(null);
                                      }}
                                      className="text-xs text-gray-500 hover:underline"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm mt-1">{comment.content}</p>
                              )}

                              {/* Comment Actions - Like & Reply */}
                              <div className="flex items-center gap-3 mt-1">
                                <button
                                  onClick={() => handleCommentLike(comment.id, post.id)}
                                  className={`text-xs flex items-center gap-1 ${
                                    comment.user_liked ? 'text-[#800000]' : 'text-gray-400 hover:text-gray-600'
                                  }`}
                                >
                                  {comment.user_liked ? '❤️' : '🤍'} Like
                                </button>
                                <button
                                  onClick={() => setShowReplyInput(showReplyInput === comment.id ? null : comment.id)}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Reply
                                </button>
                                {comment.reply_count && comment.reply_count > 0 && (
                                  <span className="text-xs text-gray-400">
                                    • {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
                                  </span>
                                )}
                              </div>

                              {/* Replies */}
                              {comment.replies && comment.replies.length > 0 && (
                                <div className="mt-2 ml-6 space-y-2 border-l-2 border-gray-200 pl-3">
                                  {comment.replies.map((reply: CommentReply) => (
                                    <div key={reply.id} className="flex items-start gap-2">
                                      <button onClick={() => openProfile(reply.user_id)}>
                                        <img
                                          src={
                                            reply.alumni_profiles?.avatar_url ||
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                              reply.alumni_profiles?.full_name || 'A'
                                            )}&background=800000&color=fff&rounded=true&size=24`
                                          }
                                          alt="Replier"
                                          className="w-6 h-6 rounded-full flex-shrink-0"
                                        />
                                      </button>
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => openProfile(reply.user_id)}
                                              className="text-xs font-semibold hover:underline"
                                            >
                                              {reply.alumni_profiles?.full_name}
                                            </button>
                                            <span className="text-xs text-gray-400">
                                              {timeAgo(reply.created_at)}
                                            </span>
                                            {reply.updated_at !== reply.created_at && (
                                              <span className="text-[10px] text-gray-400">(edited)</span>
                                            )}
                                          </div>
                                          <ThreeDotsMenu
                                            isOwner={reply.user_id === session.user.id}
                                            onEdit={() => {
                                              setEditingReplyId(reply.id);
                                              setEditingReplyContent(reply.content);
                                              setEditingReplyCommentId(comment.id);
                                              setEditingReplyPostId(post.id);
                                            }}
                                            onDelete={() => handleDeleteReply(post.id, comment.id, reply.id)}
                                            onCopy={() => copyToClipboard(reply.content)}
                                            menuPosition="right"
                                          />
                                        </div>
                                        
                                        {editingReplyId === reply.id && 
                                         editingReplyCommentId === comment.id && 
                                         editingReplyPostId === post.id ? (
                                          <div className="mt-1 space-y-2">
                                            <input
                                              type="text"
                                              value={editingReplyContent}
                                              onChange={(e) => setEditingReplyContent(e.target.value)}
                                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none"
                                            />
                                            <div className="flex gap-2">
                                              <button
                                                onClick={() => handleEditReply(post.id, comment.id, reply.id)}
                                                className="text-xs text-[#800000] font-semibold hover:underline"
                                              >
                                                Save
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingReplyId(null);
                                                  setEditingReplyContent('');
                                                  setEditingReplyCommentId(null);
                                                  setEditingReplyPostId(null);
                                                }}
                                                className="text-xs text-gray-500 hover:underline"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-sm mt-0.5">{reply.content}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Reply Input */}
                              {showReplyInput === comment.id && (
                                <div className="mt-2 ml-6 flex items-center gap-2">
                                  <img
                                    src={
                                      profile?.avatar_url ||
                                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        profile?.full_name || 'A'
                                      )}&background=800000&color=fff&rounded=true&size=24`
                                    }
                                    alt="Your avatar"
                                    className="w-6 h-6 rounded-full flex-shrink-0"
                                  />
                                  <div className="flex-1 flex gap-2">
                                    <input
                                      type="text"
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder="Write a reply..."
                                      className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-full focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleAddReply(comment.id, post.id);
                                        }
                                      }}
                                    />
                                    <Button
                                      onClick={() => handleAddReply(comment.id, post.id)}
                                      disabled={!replyText.trim() || submittingReply}
                                      loading={submittingReply}
                                      size="sm"
                                      className="!px-2 !py-0.5 text-xs rounded-full"
                                    >
                                      Reply
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </>
          )}

          {loading && posts.length > 0 && (
            <div className="text-center py-4">
              <div className="inline-block w-6 h-6 border-2 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin" />
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-gray-400 mb-3">You've seen all posts 🎉</p>
              
              <button
                onClick={scrollToTop}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#800000] hover:bg-[#6a0000] text-white text-sm font-medium rounded-full shadow-md transition-all duration-200 hover:scale-105"
              >
                <span>⬆</span> Back to Top
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* PROFILE VIEW MODAL - FROM POSTS/PEOPLE YOU MAY KNOW */}
      {/* ============================================================ */}
      {showProfileModal && (
        <ProfileModal loading={viewProfileLoading} profile={viewProfile} onClose={closeProfileModal} />
      )}

      {/* ============================================================ */}
      {/* PROFILE VIEW MODAL - FROM SEARCH */}
      {/* ============================================================ */}
      {showSearchProfileModal && (
        <ProfileModal loading={searchViewProfileLoading} profile={searchViewProfile} onClose={closeSearchProfileModal} />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
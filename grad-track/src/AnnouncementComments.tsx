// src/AnnouncementComments.tsx
import { useState } from 'react';
import { supabase } from './lib/supabase';

interface Comment {
  id: string;
  announcement_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  full_name?: string;
  role?: string;
  replies?: Comment[];
}

interface AnnouncementCommentsProps {
  announcementId: string;
  comments: Comment[];
  loading: boolean;
  session: any;
  isAdmin?: boolean;
  onAddComment: (announcementId: string, content: string, parentCommentId: string | null) => Promise<void>;
  onDeleteComment: (commentId: string, announcementId: string) => Promise<void>;
}

export default function AnnouncementComments({
  announcementId,
  comments,
  loading,
  session,
  isAdmin = false,
  onAddComment,
  onDeleteComment,
}: AnnouncementCommentsProps) {
  const isSupabaseReady = Boolean(supabase);
  const [commentContent, setCommentContent] = useState('');
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [visibleCommentCount, setVisibleCommentCount] = useState<Record<string, number>>({});
  const [visibleReplyCount, setVisibleReplyCount] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleAddComment = async (parentCommentId: string | null = null) => {
    const content = parentCommentId ? replyContent[parentCommentId] : commentContent;
    if (!content?.trim()) return;

    setSubmitting(true);
    try {
      await onAddComment(announcementId, content, parentCommentId);
      if (parentCommentId) {
        setReplyContent(prev => ({ ...prev, [parentCommentId]: '' }));
        setReplyingTo(null);
      } else {
        setCommentContent('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReplyInput = (commentId: string) => {
    if (replyingTo === commentId) {
      setReplyingTo(null);
      return;
    }

    setReplyingTo(commentId);
    setReplyContent(prev => ({ ...prev, [commentId]: prev[commentId] ?? '' }));
  };

  const showMoreComments = () => {
    setVisibleCommentCount(prev => ({
      ...prev,
      [announcementId]: (prev[announcementId] || 3) + 5,
    }));
  };

  const showMoreReplies = (commentId: string) => {
    setVisibleReplyCount(prev => ({
      ...prev,
      [commentId]: (prev[commentId] || 3) + 3,
    }));
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isCommentOwner = session?.user?.id === comment.user_id;
    const canDelete = isAdmin || isCommentOwner;
    const visibleReplies = (comment.replies || []).slice(0, visibleReplyCount[comment.id] || 3);
    const hasMoreReplies = (comment.replies || []).length > visibleReplies.length;

    return (
      <div key={comment.id} className={`${isReply ? 'ml-6 sm:ml-10 mt-3' : 'mt-3'}`}>
        <div className={`${isReply ? 'border-l-2 border-gray-200 dark:border-gray-700 pl-3 sm:pl-4' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">
                  {comment.full_name || 'Unknown Alumni'}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  comment.role === 'Admin'
                    ? 'bg-[#800000]/10 text-[#800000]'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {comment.role === 'Admin' ? '🛡️ Admin' : '🎓 Alumni'}
                </span>
                <span className="text-xs text-gray-400">{formatTimeAgo(comment.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words">
                {comment.content}
              </p>
            </div>
            {canDelete && (
              <button
                onClick={() => onDeleteComment(comment.id, announcementId)}
                className="text-red-400 hover:text-red-600 text-xs flex-shrink-0"
              >
                Delete
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => toggleReplyInput(comment.id)}
              className="text-xs font-medium text-[#800000] hover:underline"
            >
              {replyingTo === comment.id ? 'Cancel' : 'Reply'}
            </button>
            {hasMoreReplies && (
              <button
                onClick={() => showMoreReplies(comment.id)}
                className="text-xs font-medium text-gray-500 hover:text-[#800000]"
              >
                Show previous replies
              </button>
            )}
          </div>

          {replyingTo === comment.id && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={replyContent[comment.id] || ''}
                onChange={(e) => setReplyContent(prev => ({ ...prev, [comment.id]: e.target.value }))}
                placeholder={`Reply to ${comment.full_name || 'this comment'}...`}
                className="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (replyContent[comment.id] || '').trim()) {
                    e.preventDefault();
                    handleAddComment(comment.id);
                  }
                }}
              />
              <button
                onClick={() => handleAddComment(comment.id)}
                disabled={submitting || !replyContent[comment.id]?.trim()}
                className="px-3 py-1.5 text-sm bg-[#800000] text-white rounded-lg hover:bg-[#6a0000] disabled:opacity-50"
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          )}

          {visibleReplies.length > 0 && (
            <div className="mt-2">
              {visibleReplies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isSupabaseReady || loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="w-5 h-5 border-2 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin" />
      </div>
    );
  }

  const visibleRootComments = comments.slice(0, visibleCommentCount[announcementId] || 3);
  const hasMoreComments = comments.length > visibleRootComments.length;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          💬 {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && commentContent.trim()) {
              e.preventDefault();
              handleAddComment();
            }
          }}
        />
        <button
          onClick={() => handleAddComment()}
          disabled={submitting || !commentContent.trim()}
          className="px-4 py-2 text-sm bg-[#800000] text-white rounded-lg hover:bg-[#6a0000] disabled:opacity-50"
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
      </div>

      <div className="mt-3 max-h-96 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first to comment!</p>
        ) : (
          <>
            {visibleRootComments.map(comment => renderComment(comment, false))}
            {hasMoreComments && (
              <button
                onClick={showMoreComments}
                className="mt-3 text-sm font-medium text-[#800000] hover:underline"
              >
                See more comments
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
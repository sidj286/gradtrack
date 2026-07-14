// src/components/AnnouncementComments.tsx
import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';

interface AnnouncementComment {
  id: string;
  announcement_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at?: string;
  // ✅ These come flat on the comment object, populated by the parent
  // dashboard's fetchComments/fetchCommentsForAnnouncement — NOT nested
  // under `.profiles` or `.user` (there is no `profiles` table in this
  // schema; names/roles are resolved from `users` + `alumni_profiles`
  // by the parent, then attached directly here).
  full_name?: string;
  role?: string;
  replies?: AnnouncementComment[];
}

interface AnnouncementCommentsProps {
  announcementId: string;
  comments: AnnouncementComment[];
  loading: boolean;
  session: Session;
  isAdmin?: boolean;
  onAddComment: (announcementId: string, content: string, parentCommentId: string | null) => Promise<void>;
  onDeleteComment: (commentId: string, announcementId: string) => Promise<void>;
  onEditComment?: (commentId: string, announcementId: string, newContent: string) => Promise<void>;
}

// ==================== 3-DOTS MENU COMPONENT ====================
const CommentMenu: React.FC<{
  comment: AnnouncementComment;
  session: Session;
  isAdmin?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ comment, session, isAdmin, onEdit, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);

  const isCommentOwner = comment.user_id === session.user.id;

  const canEdit = isCommentOwner;
  const canDelete = isCommentOwner || isAdmin;

  if (!canEdit && !canDelete) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        title="More options"
      >
        <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
            {canEdit && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onEdit();
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Comment
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onDelete();
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Comment
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ==================== SINGLE COMMENT COMPONENT ====================
const CommentItem: React.FC<{
  comment: AnnouncementComment;
  session: Session;
  isAdmin?: boolean;
  level: number;
  onAddComment: (announcementId: string, content: string, parentCommentId: string | null) => Promise<void>;
  onDeleteComment: (commentId: string, announcementId: string) => Promise<void>;
  onEditComment?: (commentId: string, announcementId: string, newContent: string) => Promise<void>;
  announcementId: string;
}> = ({
  comment,
  session,
  isAdmin,
  level,
  onAddComment,
  onDeleteComment,
  onEditComment,
  announcementId
}) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReply = async () => {
    if (!replyContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddComment(announcementId, replyContent, comment.id);
      setReplyContent('');
      setShowReplyInput(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim() || isSubmitting || !onEditComment) return;
    setIsSubmitting(true);
    try {
      await onEditComment(comment.id, announcementId, editContent);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      await onDeleteComment(comment.id, announcementId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const isCommentOwner = comment.user_id === session.user.id;

  // ✅ FIXED: full_name and role are attached directly on the comment
  // object by the parent dashboard (AdminDashboard.tsx / AlumniDashboard.tsx
  // fetchComments), not nested under `.user` or `.profiles`. Those nested
  // shapes never existed in this schema — reading them always fell through
  // to the 'Unknown' default, which was the actual bug.
  const commentRole = comment.role || 'Alumni';
  const commentFullName = comment.full_name || 'Unknown';

  // Display name logic: alumni viewers never see an admin's real name —
  // the parent already applies this masking for AlumniDashboard's fetch,
  // but this guards the admin dashboard's own comment list too, in case
  // isAdmin is false for some other viewer context.
  const displayName = commentRole === 'Admin' && !isAdmin
    ? 'Admin'
    : commentFullName;

  return (
    <div className={`${level > 0 ? 'ml-4 sm:ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-3 sm:pl-4' : ''}`}>
      <div className={`rounded-lg p-3 ${isCommentOwner ? 'bg-[#800000]/5 border border-[#800000]/10' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {displayName}
            </span>
            {commentRole === 'Admin' && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#800000] text-white flex-shrink-0">
                SASO Admin
              </span>
            )}
            <span className="text-xs text-gray-400 flex-shrink-0">
              {formatDate(comment.created_at)}
            </span>
            {comment.updated_at && comment.updated_at !== comment.created_at && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">(edited)</span>
            )}
          </div>

          <CommentMenu
            comment={comment}
            session={session}
            isAdmin={isAdmin}
            onEdit={() => setIsEditing(true)}
            onDelete={handleDelete}
          />
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-[#800000] focus:ring-1 focus:ring-[#800000] outline-none resize-none"
              rows={2}
              placeholder="Edit your comment..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                disabled={isSubmitting || !editContent.trim()}
                className="px-3 py-1 text-xs bg-[#800000] text-white rounded-lg hover:bg-[#6a0000] transition disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
                className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}

        {!isEditing && (
          <button
            onClick={() => setShowReplyInput(!showReplyInput)}
            className="mt-2 text-xs text-[#800000] hover:underline font-medium"
          >
            {showReplyInput ? 'Cancel Reply' : 'Reply'}
          </button>
        )}
      </div>

      {showReplyInput && (
        <div className="mt-2 ml-4 sm:ml-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-[#800000] focus:ring-1 focus:ring-[#800000] outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleReply();
                }
              }}
            />
            <button
              onClick={handleReply}
              disabled={isSubmitting || !replyContent.trim()}
              className="px-3 py-1.5 text-sm bg-[#800000] text-white rounded-lg hover:bg-[#6a0000] transition disabled:opacity-50 whitespace-nowrap"
            >
              {isSubmitting ? '...' : 'Reply'}
            </button>
          </div>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              session={session}
              isAdmin={isAdmin}
              level={level + 1}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
              onEditComment={onEditComment}
              announcementId={announcementId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export default function AnnouncementComments({
  announcementId,
  comments: initialComments,
  loading,
  session,
  isAdmin = false,
  onAddComment,
  onDeleteComment,
  onEditComment
}: AnnouncementCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState<AnnouncementComment[]>(initialComments);

  // ✅ Always mirror whatever the parent passes down. The parent
  // (AdminDashboard.tsx / AlumniDashboard.tsx) owns the source of truth
  // for comments — including the correctly-resolved full_name/role —
  // and refetches after every add/edit/delete via onAddComment /
  // onEditComment / onDeleteComment. This component should never fetch
  // or process comments on its own; doing so previously caused both the
  // "Unknown" name bug (wrong join target) and duplicate notifications.
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const handleAddComment = async () => {
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // ✅ FIXED: just delegate to the parent's onAddComment. The parent
      // (AdminDashboard.tsx's addComment / AlumniDashboard.tsx's addComment)
      // already handles: inserting the row, resolving the commenter's name
      // from `users`/`alumni_profiles`, sending the correct notification
      // (notifyCommentAdded for alumni, or the admin-specific fan-out for
      // admin comments/replies), and refetching comments into its own
      // state — which flows back down here via the `comments` prop.
      //
      // Previously this function ALSO called notifyCommentAdded directly
      // and ran its own broken `profiles!inner` refetch, which caused
      // duplicate notifications and fed this component data structured
      // in a way getUserData() could never actually read.
      await onAddComment(announcementId, newComment.trim(), null);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-[#800000] focus:ring-1 focus:ring-[#800000] outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddComment();
            }
          }}
        />
        <button
          onClick={handleAddComment}
          disabled={isSubmitting || !newComment.trim()}
          className="px-3 py-1 text-white bg-[#800000] rounded-lg hover:bg-[#6a0000] transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send comment"
        >
          {isSubmitting ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-2xl leading-none">⮚</span>
          )}
        </button>
      </div>

      {/* Comments List */}
      {comments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              session={session}
              isAdmin={isAdmin}
              level={0}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
              onEditComment={onEditComment}
              announcementId={announcementId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
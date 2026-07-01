// src/lib/notificationUtils.ts
import { supabase } from './supabase';

// ============================================================
// NOTIFICATION UTILITY FUNCTIONS
// ============================================================

// Send notification to a specific user
export async function sendNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  metadata?: any
) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        link: link || null,
        metadata: metadata || {},
        is_read: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
}

// Get all notifications for a user
export async function getNotifications(userId: string) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

// Get unread count for a user
export async function getUnreadCount(userId: string) {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
}

// Mark a notification as read
export async function markAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

// Mark all notifications as read for a user
export async function markAllAsRead(userId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking all as read:', error);
    return false;
  }
}

// Delete a notification
export async function deleteNotification(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
}

// ============================================================
// NOTIFICATION GENERATORS (for different events)
// ============================================================

// When a comment is added
export async function notifyNewComment(
  adminId: string,
  alumniName: string,
  announcementTitle: string,
  commentContent: string,
  announcementId: string
) {
  return sendNotification(
    adminId,
    'comment',
    '💬 New Comment',
    `${alumniName} commented on "${announcementTitle}": "${commentContent.substring(0, 60)}..."`,
    `/admin/announcements/${announcementId}`,
    { announcement_id: announcementId, comment_preview: commentContent }
  );
}

// When admin replies to a comment
export async function notifyReplyToComment(
  alumniId: string,
  adminName: string,
  announcementTitle: string,
  replyContent: string,
  announcementId: string
) {
  return sendNotification(
    alumniId,
    'reply',
    '📩 Admin Replied to Your Comment',
    `${adminName} replied to your comment on "${announcementTitle}": "${replyContent.substring(0, 60)}..."`,
    `/alumni/announcements/${announcementId}`,
    { announcement_id: announcementId, reply_preview: replyContent }
  );
}

// When career is updated
export async function notifyCareerUpdate(
  adminId: string,
  alumniName: string,
  jobTitle: string,
  company: string,
  alumniId: string
) {
  return sendNotification(
    adminId,
    'career_update',
    '📊 Career Update',
    `${alumniName} updated job title to "${jobTitle}" at ${company}`,
    `/admin/alumni/${alumniId}`,
    { alumni_id: alumniId, job_title: jobTitle, company: company }
  );
}

// When profile is updated
export async function notifyProfileUpdate(
  adminId: string,
  alumniName: string,
  alumniId: string
) {
  return sendNotification(
    adminId,
    'profile_update',
    '✏️ Profile Update',
    `${alumniName} updated their profile information`,
    `/admin/alumni/${alumniId}`,
    { alumni_id: alumniId }
  );
}

// When new alumni registers
export async function notifyNewRegistration(
  adminId: string,
  alumniName: string,
  course: string,
  alumniId: string
) {
  return sendNotification(
    adminId,
    'registration',
    '🎉 New Alumni Registered',
    `${alumniName} (${course}) just registered on GradTrack`,
    `/admin/alumni/${alumniId}`,
    { alumni_id: alumniId, course: course }
  );
}

// When new announcement is posted
export async function notifyNewAnnouncement(
  alumniIds: string[],
  title: string,
  announcementId: string
) {
  const notifications = alumniIds.map((userId) =>
    sendNotification(
      userId,
      'announcement',
      '📢 New Announcement',
      `New announcement posted: "${title}"`,
      `/alumni/announcements/${announcementId}`,
      { announcement_id: announcementId }
    )
  );
  return Promise.all(notifications);
}
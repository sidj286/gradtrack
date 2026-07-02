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
    console.log('📨 SEND NOTIFICATION:', { userId, type, title, message });

    // Validate userId
    if (!userId) {
      console.error('❌ No userId provided!');
      return null;
    }

    const notificationData = {
      user_id: userId,
      type,
      title,
      message,
      link: link || null,
      metadata: metadata || {},
      is_read: false,
      created_at: new Date().toISOString()
    };

    console.log('📝 Inserting notification:', notificationData);

    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insert error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return null;
    }

    console.log('✅ Notification inserted successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ sendNotification caught error:', error);
    return null;
  }
}

// Send notification to ALL admins
export async function sendNotificationToAllAdmins(
  type: string,
  title: string,
  message: string,
  link?: string,
  metadata?: any
) {
  try {
    console.log('📨 SENDING TO ALL ADMINS:', { type, title, message });

    // Get all admin users
    const { data: admins, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('role', 'Admin');

    if (error) {
      console.error('❌ Error fetching admins:', error);
      return [];
    }

    console.log('👥 Admins found:', admins?.length || 0);
    console.log('👥 Admin IDs:', admins?.map(a => a.id) || []);

    if (!admins || admins.length === 0) {
      console.warn('⚠️ No admin users found!');
      return [];
    }

    const notificationPromises = admins.map((admin) => {
      console.log(`📨 Sending to admin: ${admin.id} (${admin.email})`);
      return sendNotification(admin.id, type, title, message, link, metadata);
    });

    const results = await Promise.all(notificationPromises);
    console.log('✅ All notifications sent:', results?.length || 0);
    return results;
  } catch (error) {
    console.error('❌ sendNotificationToAllAdmins error:', error);
    return [];
  }
}

// Get all notifications for a user
export async function getNotifications(userId: string) {
  try {
    console.log('🔔 getNotifications called for user:', userId);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      return [];
    }
    console.log('📋 Notifications found:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ getNotifications error:', error);
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

    if (error) {
      console.error('❌ Error fetching unread count:', error);
      return 0;
    }
    return count || 0;
  } catch (error) {
    console.error('❌ getUnreadCount error:', error);
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
// NOTIFICATION GENERATORS (ALL 10 ACTIVITIES)
// ============================================================

// 1. COMMENT ADDED - Alumni comments on announcement
export async function notifyCommentAdded(
  alumniName: string,
  announcementTitle: string,
  commentContent: string,
  announcementId: string,
  alumniId: string
) {
  console.log('🔔 notifyCommentAdded called!');
  const message = `${alumniName} commented on "${announcementTitle}": "${commentContent.substring(0, 60)}${commentContent.length > 60 ? '...' : ''}"`;
  return sendNotificationToAllAdmins(
    'comment',
    '💬 New Comment',
    message,
    `/admin/announcements/${announcementId}`,
    { announcement_id: announcementId, alumni_id: alumniId, comment_preview: commentContent }
  );
}

// 2. REPLY ADDED - Admin replies to alumni comment
export async function notifyReplyAdded(
  alumniId: string,
  adminName: string,
  announcementTitle: string,
  replyContent: string,
  announcementId: string
) {
  console.log('🔔 notifyReplyAdded called!');
  const message = `${adminName} replied to your comment on "${announcementTitle}": "${replyContent.substring(0, 60)}${replyContent.length > 60 ? '...' : ''}"`;
  return sendNotification(
    alumniId,
    'reply',
    '📩 Admin Replied to You',
    message,
    `/alumni/announcements/${announcementId}`,
    { announcement_id: announcementId, reply_preview: replyContent }
  );
}

// 3. CAREER UPDATED - Alumni updates job title or company
export async function notifyCareerUpdated(
  alumniName: string,
  jobTitle: string,
  company: string,
  alumniId: string
) {
  console.log('🔔 notifyCareerUpdated called!', { alumniName, jobTitle, company });
  const message = `${alumniName} updated job title to "${jobTitle}" at ${company}`;
  return sendNotificationToAllAdmins(
    'career_update',
    '📊 Career Update',
    message,
    `/admin/alumni/${alumniId}`,
    { alumni_id: alumniId, job_title: jobTitle, company: company }
  );
}

// 4. PROFILE UPDATED - Alumni updates profile picture or info
export async function notifyProfileUpdated(
  alumniName: string,
  alumniId: string,
  updateType: string = 'profile information'
) {
  console.log('🔔 notifyProfileUpdated called!', { alumniName, updateType });
  const message = `${alumniName} updated their ${updateType}`;
  return sendNotificationToAllAdmins(
    'profile_update',
    '✏️ Profile Update',
    message,
    `/admin/alumni/${alumniId}`,
    { alumni_id: alumniId, update_type: updateType }
  );
}

// 5. NEW REGISTRATION - New alumni registers
export async function notifyNewRegistration(
  alumniName: string,
  course: string,
  alumniId: string
) {
  console.log('🔔 notifyNewRegistration called!', { alumniName, course });
  const message = `${alumniName} (${course}) just registered on GradTrack`;
  return sendNotificationToAllAdmins(
    'registration',
    '🎉 New Alumni Registered',
    message,
    `/admin/alumni/${alumniId}`,
    { alumni_id: alumniId, course: course }
  );
}

// 6. NEW ANNOUNCEMENT - Admin posts new announcement
export async function notifyNewAnnouncement(
  alumniIds: string[],
  title: string,
  announcementId: string
) {
  console.log('🔔 notifyNewAnnouncement called!', { alumniCount: alumniIds.length, title });
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

// 7. EMPLOYMENT STATUS CHANGED - Alumni changes employment status
export async function notifyEmploymentStatusChanged(
  alumniName: string,
  employmentStatus: string,
  company: string,
  jobTitle: string,
  alumniId: string
) {
  console.log('🔔 notifyEmploymentStatusChanged called!', { alumniName, employmentStatus, company, jobTitle });
  let message = `${alumniName} changed status to "${employmentStatus}"`;
  if (company && jobTitle) {
    message = `${alumniName} is now ${employmentStatus} at ${company} as ${jobTitle}`;
  } else if (company) {
    message = `${alumniName} is now ${employmentStatus} at ${company}`;
  }
  return sendNotificationToAllAdmins(
    'career_update',
    '🔄 Employment Status Changed',
    message,
    `/admin/alumni/${alumniId}`,
    { alumni_id: alumniId, employment_status: employmentStatus, company: company, job_title: jobTitle }
  );
}

// 8. ANNOUNCEMENT EDITED - Admin edits an announcement
export async function notifyAnnouncementEdited(
  adminId: string,
  title: string,
  announcementId: string
) {
  console.log('🔔 notifyAnnouncementEdited called!', { adminId, title });
  const message = `You updated announcement: "${title}"`;
  return sendNotification(
    adminId,
    'announcement',
    '📝 Announcement Updated',
    message,
    `/admin/announcements/${announcementId}`,
    { announcement_id: announcementId }
  );
}

// 9. ALUMNI VERIFIED - Alumni verified from master list
export async function notifyAlumniVerified(
  alumniName: string,
  alumniId: string
) {
  console.log('🔔 notifyAlumniVerified called!', { alumniName });
  const message = `${alumniName} has been verified as a CRMC graduate`;
  return sendNotificationToAllAdmins(
    'registration',
    '✅ Alumni Verified',
    message,
    `/admin/alumni/${alumniId}`,
    { alumni_id: alumniId }
  );
}

// 10. MASTER LIST IMPORTED - Admin imports master list
export async function notifyMasterListImported(
  adminId: string,
  recordCount: number
) {
  console.log('🔔 notifyMasterListImported called!', { adminId, recordCount });
  const message = `Master list imported: ${recordCount} new records added`;
  return sendNotification(
    adminId,
    'announcement',
    '📥 Master List Imported',
    message,
    '/admin/masterlist',
    { record_count: recordCount }
  );
}

// ============================================================
// EXPORT ALL FUNCTIONS
// ============================================================

export default {
  sendNotification,
  sendNotificationToAllAdmins,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  notifyCommentAdded,
  notifyReplyAdded,
  notifyCareerUpdated,
  notifyProfileUpdated,
  notifyNewRegistration,
  notifyNewAnnouncement,
  notifyEmploymentStatusChanged,
  notifyAnnouncementEdited,
  notifyAlumniVerified,
  notifyMasterListImported
};
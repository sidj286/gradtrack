// src/NotificationBell.tsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification } from './lib/notificationUtils';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

interface NotificationBellProps {
  userId: string;
  onNotificationClick?: (notification: Notification) => void;
}

export default function NotificationBell({ userId, onNotificationClick }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current user role - FIXED: use 'users' table and 'Admin' casing
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // ✅ FIX: Use 'users' table, not 'profiles'
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        // ✅ FIX: Use 'Admin' with capital A
        setCurrentUser({ ...user, role: userData?.role || 'Alumni' });
      }
    };
    getUser();
  }, []);

  const fetchNotifications = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const data = await getNotifications(userId);
      
      // Process notifications based on user role
      const processedData = data?.map(notification => {
        let processedMessage = notification.message;
        
        // ✅ FIX: Use 'Admin' with capital A
        if (currentUser?.role === 'Admin') {
          processedMessage = notification.message;
        } else {
          processedMessage = notification.message
            ?.replace(/^[^:]+:\s*/, '')
            ?.replace(/Admin\s+[A-Za-z]+\s+[A-Za-z]+/g, 'Admin')
            ?.replace(/Admin\s+[A-Za-z]+/g, 'Admin');
        }
        
        return {
          ...notification,
          message: processedMessage
        };
      });
      
      setNotifications(processedData || []);
      const count = await getUnreadCount(userId);
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && currentUser) {
      fetchNotifications();
    }
  }, [userId, currentUser]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('🔔 New notification received!', payload);
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📝 Notification updated!', payload);
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
    fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead(userId);
    fetchNotifications();
  };

  const handleDelete = async (notificationId: string) => {
    await deleteNotification(notificationId);
    fetchNotifications();
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    const icons: Record<string, string> = {
      comment: '💬',
      reply: '📩',
      career_update: '📊',
      profile_update: '✏️',
      registration: '🎉',
      announcement: '📢',
    };
    return icons[type] || '🔔';
  };

  const getTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Clean message based on user role - FIXED: use 'Admin' casing
  const cleanMessage = (message: string) => {
    if (!message) return message;
    
    // ✅ FIX: Use 'Admin' with capital A
    if (currentUser?.role === 'Admin') {
      return message;
    }
    
    let cleaned = message;
    cleaned = cleaned.replace(/^[^:]+:\s*/, '');
    cleaned = cleaned.replace(/Admin\s+[A-Za-z]+\s+[A-Za-z]+/g, 'Admin');
    cleaned = cleaned.replace(/Admin\s+[A-Za-z]+/g, 'Admin');
    
    return cleaned;
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto top-16 sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-80 md:w-96 max-w-full sm:max-w-[400px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 max-h-[calc(100vh-8rem)] sm:max-h-[500px] flex flex-col">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-[#800000]/5 to-transparent flex-shrink-0">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[10px] sm:text-xs text-[#800000] hover:underline font-medium whitespace-nowrap"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🔕</div>
                <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">No notifications</p>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-1">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex items-start gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 border-b border-gray-100 dark:border-gray-700 group ${
                    !notification.is_read ? 'bg-[#800000]/5 dark:bg-[#800000]/10' : ''
                  }`}
                >
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-base sm:text-lg group-hover:bg-[#800000]/10 transition-colors">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {notification.title}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notification.id);
                        }}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2 break-words">
                      {cleanMessage(notification.message)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
                        {getTimeAgo(notification.created_at)}
                      </span>
                      {!notification.is_read && (
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#800000] rounded-full animate-pulse flex-shrink-0" />
                      )}
                      {notification.link && (
                        <span className="text-[10px] sm:text-xs text-[#800000] font-medium whitespace-nowrap">🔗 Tap to view</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 text-center flex-shrink-0">
            <p className="text-[8px] sm:text-[10px] text-gray-400 dark:text-gray-500">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
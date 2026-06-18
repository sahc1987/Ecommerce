import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, ShoppingBag, Package, RotateCcw, CheckCircle, XCircle, X,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import api from '../../api';

interface NotificationMetadata {
  order_id?: string;
  return_id?: string;
  order_total?: number;
  status?: string;
  refund_amount?: number;
  customer_name?: string;
}

interface Notification {
  id: string;
  user_id: string;
  type: 'new_order' | 'order_status' | 'return_request' | 'return_response';
  title: string;
  message: string;
  is_read: boolean;
  metadata: NotificationMetadata;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function NotificationIcon({
  type,
  metadata,
}: {
  type: Notification['type'];
  metadata: NotificationMetadata;
}) {
  if (type === 'new_order') {
    return (
      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
        <ShoppingBag size={16} className="text-green-600" />
      </div>
    );
  }
  if (type === 'order_status') {
    return (
      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        <Package size={16} className="text-blue-600" />
      </div>
    );
  }
  if (type === 'return_request') {
    return (
      <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
        <RotateCcw size={16} className="text-orange-600" />
      </div>
    );
  }
  // return_response
  if (metadata.status === 'rejected') {
    return (
      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <XCircle size={16} className="text-red-600" />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
      <CheckCircle size={16} className="text-green-600" />
    </div>
  );
}

interface Props {
  buttonClassName?: string;
}

export default function NotificationBell({
  buttonClassName = 'text-gray-300 hover:text-white',
}: Props) {
  const { user } = useSelector((s: RootState) => s.auth);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isAdmin = user && ['admin', 'staff'].includes(user.role);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications);
      setUnread(res.data.unread);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      try {
        await api.put(`/notifications/${n.id}/read`);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
        setUnread((prev) => Math.max(0, prev - 1));
      } catch {}
    }
    setOpen(false);
    if ((n.type === 'new_order' || n.type === 'order_status') && n.metadata.order_id) {
      navigate(isAdmin ? `/admin/orders/${n.metadata.order_id}` : `/orders/${n.metadata.order_id}`);
    } else if (n.type === 'return_request') {
      navigate('/admin/returns');
    } else if (n.type === 'return_response' && n.metadata.order_id) {
      navigate(`/orders/${n.metadata.order_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {}
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const target = notifications.find((n) => n.id === id);
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.is_read) setUnread((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-2.5 transition-colors ${buttonClassName}`}
        title="Notifications"
      >
        <Bell size={22} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
              {unread > 0 && (
                <span className="bg-rose-100 text-rose-600 text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                <Bell size={28} className="opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                      !n.is_read ? 'bg-indigo-50/40' : ''
                    }`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <NotificationIcon type={n.type} metadata={n.metadata} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p
                          className={`text-sm text-gray-900 truncate leading-snug ${
                            !n.is_read ? 'font-semibold' : 'font-medium'
                          }`}
                        >
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                          )}
                          <button
                            onClick={(e) => handleDelete(e, n.id)}
                            className="text-gray-300 hover:text-gray-600 transition-colors p-0.5 rounded"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

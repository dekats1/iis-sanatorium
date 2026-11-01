import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '../api/endpoints';
import type { AppNotification } from '../types';

export function NotificationBell() {
  const [list, setList] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      const data = await notifications.list();
      setList(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadNotifications();
    const handleEvent = () => void loadNotifications();
    window.addEventListener('sanatorium_notifications_changed', handleEvent);
    return () => window.removeEventListener('sanatorium_notifications_changed', handleEvent);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = list.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await notifications.markAllAsRead();
    await loadNotifications();
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read) {
      await notifications.markAsRead(n.id);
      await loadNotifications();
    }
    if (n.link) {
      setIsOpen(false);
      navigate(n.link);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await notifications.remove(id);
    await loadNotifications();
  };

  const filteredList = list.filter((n) => (filter === 'unread' ? !n.read : true));

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'PAYMENT':
        return '💳';
      case 'MEDICAL':
        return '🩺';
      case 'LOYALTY':
        return '⭐';
      case 'WAITLIST':
        return '⏳';
      default:
        return '🔔';
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Центр уведомлений"
        aria-label="Уведомления"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notification-badge-count">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 750 }}>Уведомления</h4>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {unreadCount > 0 ? `${unreadCount} новых` : 'Все прочитаны'}
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="link"
                style={{ fontSize: '0.8rem', padding: 0 }}
                onClick={markAllRead}
              >
                Прочитать все
              </button>
            )}
          </div>

          <div className="notification-tabs">
            <button
              type="button"
              className={`notification-tab-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Все ({list.length})
            </button>
            <button
              type="button"
              className={`notification-tab-btn ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Непрочитанные ({unreadCount})
            </button>
          </div>

          <div className="notification-dropdown-body">
            {filteredList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>📭</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Новых уведомлений нет</div>
              </div>
            ) : (
              filteredList.map((n) => (
                <div
                  key={n.id}
                  className={`notification-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => void handleNotificationClick(n)}
                >
                  <div className="notification-item-icon">{getIcon(n.type)}</div>
                  <div className="notification-item-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span className="notification-item-title">{n.title}</span>
                      <button
                        type="button"
                        className="notification-item-del"
                        onClick={(e) => void handleDelete(e, n.id)}
                        title="Удалить"
                      >
                        ×
                      </button>
                    </div>
                    <p className="notification-item-msg">{n.message}</p>
                    <span className="notification-item-time">
                      {new Date(n.createdAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '../api/endpoints';
import type { AppNotification } from '../types';
import { Icon, type IconName } from './icons';

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

  const getIcon = (type: AppNotification['type']): IconName => {
    switch (type) {
      case 'PAYMENT':
        return 'creditCard';
      case 'MEDICAL':
        return 'stethoscope';
      case 'LOYALTY':
        return 'star';
      case 'WAITLIST':
        return 'clock';
      default:
        return 'bell';
    }
  };

  return (
    <div className="notification-wrap" ref={dropdownRef}>
      <button
        type="button"
        className="icon-btn notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Центр уведомлений"
        aria-label="Уведомления"
        aria-expanded={isOpen}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && <span className="notification-badge-count">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown" role="dialog" aria-label="Центр уведомлений">
          <div className="notification-dropdown-header">
            <div>
              <h4>Уведомления</h4>
              <span className="notification-sub">{unreadCount > 0 ? `${unreadCount} новых` : 'Все прочитаны'}</span>
            </div>
            {unreadCount > 0 && (
              <button type="button" className="link notification-readall" onClick={markAllRead}>
                Прочитать все
              </button>
            )}
          </div>

          <div className="notification-tabs">
            <button type="button" className={`notification-tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              Все ({list.length})
            </button>
            <button type="button" className={`notification-tab-btn ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
              Непрочитанные ({unreadCount})
            </button>
          </div>

          <div className="notification-dropdown-body">
            {filteredList.length === 0 ? (
              <div className="notification-empty">
                <Icon name="inbox" size={32} />
                <div>Новых уведомлений нет</div>
              </div>
            ) : (
              filteredList.map((n) => (
                <div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`} onClick={() => void handleNotificationClick(n)}>
                  <div className="notification-item-icon"><Icon name={getIcon(n.type)} size={18} /></div>
                  <div className="notification-item-content">
                    <div className="notification-item-row">
                      <span className="notification-item-title">{n.title}</span>
                      <button type="button" className="notification-item-del" onClick={(e) => void handleDelete(e, n.id)} title="Удалить" aria-label="Удалить уведомление">
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                    <p className="notification-item-msg">{n.message}</p>
                    <span className="notification-item-time">
                      {new Date(n.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
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

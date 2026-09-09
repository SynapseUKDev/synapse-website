import { LuBell } from 'react-icons/lu'
import './NotificationInbox.css'

export default function NotificationBell({ unreadCount = 0, onClick, className = '', size = 18 }) {
  const count = Number(unreadCount) || 0
  const label = count > 0 ? `Notifications, ${count} unread` : 'Notifications'

  return (
    <button
      type="button"
      className={`notif-bell ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      title="Notifications"
    >
      <LuBell size={size} aria-hidden />
      {count > 0 ? (
        <span className="notif-bell__badge" aria-hidden>
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LuBell,
  LuClipboardList,
  LuMegaphone,
  LuUserCheck,
  LuUserPlus,
  LuX,
} from 'react-icons/lu'
import './NotificationInbox.css'
import { announcementPlainPreview } from './AnnouncementMarkdown'

const TYPE_META = {
  announcement: { label: 'Announcement', Icon: LuMegaphone },
  friend_request: { label: 'Friend request', Icon: LuUserPlus },
  friend_request_accepted: { label: 'Friends', Icon: LuUserCheck },
  study_report: { label: 'Study report', Icon: LuClipboardList },
}

function typeMeta(type) {
  return TYPE_META[type] || { label: 'Notification', Icon: LuBell }
}

function formatRelative(value) {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return ''
  }
}

function unreadSummary(count) {
  if (!count) return 'You are up to date'
  return count === 1 ? '1 unread' : `${count} unread`
}

function inboxPreview(item) {
  const subtitle = typeof item?.metadata?.subtitle === 'string' ? item.metadata.subtitle.trim() : ''
  if (subtitle) return subtitle
  if (item?.type === 'announcement') return announcementPlainPreview(item.body)
  return item?.body || ''
}

export default function NotificationInbox({
  open,
  onClose,
  notifications = [],
  onSelect,
  onMarkAllRead,
  busy = false,
}) {
  const [tab, setTab] = useState('unread')

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) setTab('unread')
  }, [open])

  const unreadAll = useMemo(() => notifications.filter((n) => !n.read_at), [notifications])
  const visible = useMemo(() => {
    if (tab === 'unread') return unreadAll
    if (tab === 'announcements') return notifications.filter((n) => n.type === 'announcement')
    return notifications
  }, [tab, notifications, unreadAll])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="notif-inbox"
          className="notif-inbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            className="notif-inbox__backdrop"
            aria-label="Close notifications"
            onClick={onClose}
          />
          <motion.aside
            className="notif-inbox__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-inbox-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="notif-inbox__header">
              <div>
                <h2 id="notif-inbox-title" className="notif-inbox__title">
                  Notifications
                </h2>
                <p className="notif-inbox__subtitle">{unreadSummary(unreadAll.length)}</p>
              </div>
              <button type="button" className="notif-inbox__close" onClick={onClose} aria-label="Close notifications">
                <LuX size={20} />
              </button>
            </div>

            <div className="notif-inbox__toolbar">
              <div className="notif-inbox__tabs" role="tablist" aria-label="Notifications">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'unread'}
                  className={tab === 'unread' ? 'is-active' : ''}
                  onClick={() => setTab('unread')}
                >
                  Unread
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'announcements'}
                  className={tab === 'announcements' ? 'is-active' : ''}
                  onClick={() => setTab('announcements')}
                >
                  Announcements
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'all'}
                  className={tab === 'all' ? 'is-active' : ''}
                  onClick={() => setTab('all')}
                >
                  All
                </button>
              </div>
              {unreadAll.length > 0 ? (
                <button
                  type="button"
                  className="notif-inbox__mark-all"
                  onClick={onMarkAllRead}
                  disabled={busy}
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className="notif-inbox__list">
              {visible.length === 0 ? (
                <p className="notif-inbox__empty">
                  {tab === 'unread'
                    ? 'No unread notifications.'
                    : tab === 'announcements'
                      ? 'No announcements yet.'
                      : 'No notifications yet.'}
                </p>
              ) : (
                visible.map((n) => {
                  const { label, Icon } = typeMeta(n.type)
                  const unreadItem = !n.read_at
                  const preview = inboxPreview(n)
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={`notif-inbox__item${unreadItem ? ' is-unread' : ''}`}
                      onClick={() => onSelect(n)}
                      disabled={busy}
                    >
                      <span className="notif-inbox__icon" aria-hidden>
                        <Icon size={16} />
                      </span>
                      <span className="notif-inbox__body">
                        <span className="notif-inbox__item-title">{n.title}</span>
                        {preview ? <span className="notif-inbox__item-preview">{preview}</span> : null}
                        <span className="notif-inbox__meta">
                          {label}
                          {n.created_at ? ` · ${formatRelative(n.created_at)}` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

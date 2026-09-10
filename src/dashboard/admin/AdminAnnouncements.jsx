import { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import AnnouncementModal from '../notifications/AnnouncementModal'
import { isAllowedAnnouncementCtaUrl, normalizeAnnouncementCtaUrl, openAnnouncementCtaUrl } from '../notifications/announcementLinks'
import AnnouncementEditor from './AnnouncementEditor'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const BLANK_FORM = {
  title: '',
  subtitle: '',
  body: '',
  cta_label: '',
  cta_url: '',
  dismiss_label: '',
}

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}))
  return typeof body?.error === 'string' ? body.error : fallback
}

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formFromRow(row = {}) {
  return {
    title: row.title || '',
    subtitle: row.subtitle || '',
    body: row.body || '',
    cta_label: row.cta_label || '',
    cta_url: row.cta_url || '',
    dismiss_label: row.dismiss_label || '',
  }
}

function formToPayload(form) {
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    body: form.body.trim(),
    cta_label: form.cta_label.trim() || null,
    cta_url: normalizeAnnouncementCtaUrl(form.cta_url) || null,
    dismiss_label: form.dismiss_label.trim() || null,
  }
}

function formToPreviewAnnouncement(form) {
  const ctaLabel = form.cta_label.trim()
  const dismissLabel = form.dismiss_label.trim()
  const subtitle = form.subtitle.trim()
  return {
    id: 'admin-preview',
    title: form.title.trim() || 'Announcement',
    subtitle,
    body: form.body.trim(),
    action_url: normalizeAnnouncementCtaUrl(form.cta_url) || null,
    metadata: {
      ...(subtitle ? { subtitle } : {}),
      ...(ctaLabel ? { cta_label: ctaLabel } : {}),
      ...(dismissLabel ? { dismiss_label: dismissLabel } : {}),
    },
  }
}

export default function AdminAnnouncements() {
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('create')
  const [form, setForm] = useState(BLANK_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const selected = announcements.find((a) => a.id === selectedId) || null

  const loadList = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/announcements`, { cache: 'no-store' })
      if (!res.ok) {
        setError(await readError(res, 'Failed to load announcements'))
        return
      }
      const body = await res.json()
      setAnnouncements(body.announcements || [])
    } catch {
      setError('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  const openCreate = () => {
    setMode('create')
    setSelectedId(null)
    setForm(BLANK_FORM)
    setError('')
    setNotice('')
    setPreviewOpen(false)
  }

  const openDetail = (row) => {
    setMode('detail')
    setSelectedId(row.id)
    setForm(formFromRow(row))
    setError('')
    setNotice('')
    setPreviewOpen(false)
  }

  const applyAnnouncement = (announcement) => {
    setAnnouncements((prev) => {
      const without = prev.filter((a) => a.id !== announcement.id)
      return [announcement, ...without].sort((a, b) => {
        const aTime = new Date(a.created_at).getTime()
        const bTime = new Date(b.created_at).getTime()
        return bTime - aTime
      })
    })
    setSelectedId(announcement.id)
    setMode('detail')
    setForm(formFromRow(announcement))
  }

  const createAnnouncement = async (e) => {
    e?.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to create announcement'))
        return
      }
      const body = await res.json()
      applyAnnouncement(body.announcement)
      setNotice('Draft saved. This is the popup users will see.')
      setPreviewOpen(true)
    } catch {
      setError('Failed to create announcement')
    } finally {
      setBusy(false)
    }
  }

  const saveAnnouncement = async (e) => {
    e?.preventDefault()
    if (!selectedId || !form.title.trim() || !form.body.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/announcements/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to save announcement'))
        return
      }
      const body = await res.json()
      applyAnnouncement(body.announcement)
      setNotice('Changes saved. This is the popup users will see.')
      setPreviewOpen(true)
    } catch {
      setError('Failed to save announcement')
    } finally {
      setBusy(false)
    }
  }

  const publishAnnouncement = async () => {
    if (!selectedId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (form.title.trim() && form.body.trim()) {
        const saveRes = await authenticatedFetch(`${API_BASE}/admin/announcements/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formToPayload(form)),
        })
        if (!saveRes.ok) {
          setError(await readError(saveRes, 'Failed to save announcement before publishing'))
          return
        }
      }
      const res = await authenticatedFetch(`${API_BASE}/admin/announcements/${selectedId}/publish`, {
        method: 'POST',
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to publish announcement'))
        return
      }
      const body = await res.json()
      applyAnnouncement(body.announcement)
      setNotice('Published. Users will see this the next time they open the dashboard.')
    } catch {
      setError('Failed to publish announcement')
    } finally {
      setBusy(false)
    }
  }

  const archiveAnnouncement = async () => {
    if (!selectedId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/announcements/${selectedId}/archive`, {
        method: 'POST',
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to archive announcement'))
        return
      }
      const body = await res.json()
      applyAnnouncement(body.announcement)
      setNotice('Archived. It is gone from every inbox and will not be sent again.')
    } catch {
      setError('Failed to archive announcement')
    } finally {
      setBusy(false)
    }
  }

  const deleteAnnouncement = async () => {
    if (!selectedId) return
    const title = selected?.title ? `“${selected.title}”` : 'this announcement'
    if (!window.confirm(`Remove ${title} from every inbox? This cannot be undone.`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/announcements/${selectedId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to remove announcement'))
        return
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== selectedId))
      setMode('create')
      setSelectedId(null)
      setForm(BLANK_FORM)
      setPreviewOpen(false)
      setNotice('Removed. It will no longer show in the notification panel.')
    } catch {
      setError('Failed to remove announcement')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading announcements..." inline />

  const isCreate = mode === 'create'
  const canPublish = selected && selected.status !== 'published'
  const canArchive = selected && selected.status !== 'archived'
  const canPreview = Boolean(form.title.trim() && form.body.trim())

  const closePreview = () => setPreviewOpen(false)

  const handlePreviewCta = async (url) => {
    openAnnouncementCtaUrl(url)
    setPreviewOpen(false)
  }

  return (
    <>
      {error && <div className="admin-alert">{error}</div>}
      {notice && <div className="admin-alert admin-alert--success">{notice}</div>}

      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-issue-list__title" style={{ paddingBottom: 8 }}>
            Announcements ({announcements.length})
          </div>
          <button type="button" className="admin-btn-issue" style={{ width: '100%' }} onClick={openCreate}>
            New announcement
          </button>

          {announcements.length === 0 ? (
            <p className="admin__muted" style={{ paddingTop: 8 }}>
              No announcements yet. Draft one, then publish when it is ready.
            </p>
          ) : (
            <div className="admin-list" style={{ marginTop: 12 }}>
              {announcements.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={selectedId === row.id ? 'is-active' : ''}
                  onClick={() => openDetail(row)}
                >
                  <span>{row.title}</span>
                  <small>
                    {row.status}
                    {' · '}
                    {row.published_at ? `published ${formatDate(row.published_at)}` : `created ${formatDate(row.created_at)}`}
                  </small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-form__section-title">{isCreate ? 'Create announcement' : 'Edit announcement'}</div>
          {!isCreate && selected ? (
            <p className="admin__muted admin-form__section-hint">
              Status: {selected.status}
              {selected.published_at ? ` · first published ${formatDate(selected.published_at)}` : ''}
            </p>
          ) : (
            <p className="admin__muted admin-form__section-hint">
              Saved as a draft. Publish when you want it to appear for users.
            </p>
          )}

          <form className="admin-form" onSubmit={isCreate ? createAnnouncement : saveAnnouncement}>
            <label>
              Title
              <input
                type="text"
                maxLength={120}
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="What’s new"
                required
              />
            </label>

            <label>
              Subtitle (optional)
              <input
                type="text"
                maxLength={160}
                value={form.subtitle}
                onChange={(e) => setField('subtitle', e.target.value)}
                placeholder="A short line under the title"
              />
            </label>

            <AnnouncementEditor
              value={form.body}
              onChange={(value) => setField('body', value)}
              placeholder="Write the announcement students will see when they next open the dashboard."
            />
            <p className="admin__muted admin-form__section-hint">
              Use the toolbar for bold, italics, underline, centre, font size (Aa), lists, links and more. Select text first, then pick a size. Leave a blank line around centred or sized blocks.
            </p>

            <label>
              Dismiss button
              <input
                type="text"
                maxLength={40}
                value={form.dismiss_label}
                onChange={(e) => setField('dismiss_label', e.target.value)}
                placeholder="Got it"
              />
            </label>
            <p className="admin__muted admin-form__section-hint">
              Shown on the announcement. Leave blank to use “Got it”.
            </p>

            <div className="admin-form__row">
              <label>
                Link button (optional)
                <input
                  type="text"
                  maxLength={40}
                  value={form.cta_label}
                  onChange={(e) => setField('cta_label', e.target.value)}
                  placeholder="Open QBank"
                />
              </label>
              <label>
                Link URL (optional)
                <input
                  type="text"
                  maxLength={500}
                  value={form.cta_url}
                  onChange={(e) => setField('cta_url', e.target.value)}
                  placeholder="https://example.com or /dashboard"
                />
              </label>
            </div>
            <p className="admin__muted admin-form__section-hint">
              Extra button. Add both a label and a URL so it appears for users. Use an in-app path starting with / or a website such as https://example.com.
            </p>
            {form.cta_label.trim() && !isAllowedAnnouncementCtaUrl(form.cta_url) ? (
              <p className="admin__muted admin-form__section-hint">
                Add a Link URL so students get this button. Preview still shows it so you can check the layout.
              </p>
            ) : null}

            <button type="submit" disabled={busy || !canPreview}>
              {busy ? 'Saving...' : isCreate ? 'Save draft' : 'Save changes'}
            </button>
          </form>

          <div className="admin-issue-actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="admin-btn-issue admin-btn-issue--ghost"
              onClick={() => setPreviewOpen(true)}
              disabled={!canPreview}
            >
              Preview popup
            </button>
            {!isCreate && canPublish ? (
              <button type="button" className="admin-btn-issue" onClick={publishAnnouncement} disabled={busy}>
                Publish
              </button>
            ) : null}
            {!isCreate && canArchive ? (
              <button
                type="button"
                className="admin-btn-issue admin-btn-issue--ghost"
                onClick={archiveAnnouncement}
                disabled={busy}
              >
                Archive
              </button>
            ) : null}
            {!isCreate ? (
              <button
                type="button"
                className="admin-btn-issue admin-btn-issue--danger"
                onClick={deleteAnnouncement}
                disabled={busy}
              >
                Remove
              </button>
            ) : null}
          </div>
        </section>
      </div>

      <AnnouncementModal
        open={previewOpen && canPreview}
        announcement={formToPreviewAnnouncement(form)}
        preview
        busy={false}
        onDismiss={closePreview}
        onCta={handlePreviewCta}
      />
    </>
  )
}

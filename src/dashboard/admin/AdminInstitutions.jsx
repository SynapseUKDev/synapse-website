import React, { useCallback, useEffect, useState } from 'react'
import { LuChevronRight, LuBuilding2, LuUserCog, LuTrash2 } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import './AdminInstitutions.css'

/** Card section with a collapsible body. */
function Section({ icon: Icon, title, count, open, onToggle, children }) {
  return (
    <section className="admin-card">
      <button type="button" className="insta-section__head" onClick={onToggle} aria-expanded={open}>
        <span className="insta-section__title">
          {Icon ? <Icon size={18} aria-hidden /> : null}
          {title}
          {count !== undefined && <span className="insta-section__count">{count}</span>}
        </span>
        <LuChevronRight
          size={18}
          aria-hidden
          className={`insta-section__chev ${open ? 'insta-section__chev--open' : ''}`}
        />
      </button>
      {open && <div className="insta-section__body">{children}</div>}
    </section>
  )
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const BLANK_FORM = {
  name: '',
  slug: '',
  contact_email: '',
  email_domains: '',
  seat_limit: '',
  billing_mode: 'free',
  is_active: true,
  admin_email: '',
  admin_username: '',
}

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}))
  return typeof body?.error === 'string' ? body.error : fallback
}

/** "uni.ac.uk, @uni2.ac.uk" -> ['uni.ac.uk', 'uni2.ac.uk'] (backend normalises too) */
function parseDomains(value) {
  return String(value || '')
    .split(/[\s,;]+/)
    .map((d) => d.trim())
    .filter(Boolean)
}

function formToPayload(form) {
  const payload = {
    name: form.name.trim(),
    email_domains: parseDomains(form.email_domains),
    billing_mode: form.billing_mode,
    seat_limit: form.seat_limit === '' ? null : Number(form.seat_limit),
  }
  if (form.slug.trim()) payload.slug = form.slug.trim()
  return payload
}

export default function AdminInstitutions() {
  const [loading, setLoading] = useState(true)
  const [institutions, setInstitutions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [mode, setMode] = useState('create') // create | detail
  const [form, setForm] = useState(BLANK_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newAdmin, setNewAdmin] = useState({ email: '', username: '' })
  const [open, setOpen] = useState({ details: true, admins: true })

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }))

  const loadList = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/institutions`, { cache: 'no-store' })
      if (!res.ok) {
        setError(await readError(res, 'Failed to load institutions'))
        return
      }
      const body = await res.json()
      setInstitutions(body.institutions || [])
    } catch {
      setError('Failed to load institutions')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${id}`, { cache: 'no-store' })
      if (!res.ok) {
        setError(await readError(res, 'Failed to load institution'))
        return
      }
      const body = await res.json()
      setDetail(body)
      const inst = body.institution || {}
      setForm({
        ...BLANK_FORM,
        name: inst.name || '',
        slug: inst.slug || '',
        contact_email: inst.contact_email || '',
        email_domains: (inst.email_domains || []).join(', '),
        seat_limit: inst.seat_limit === null || inst.seat_limit === undefined ? '' : String(inst.seat_limit),
        billing_mode: inst.billing_mode || 'free',
        is_active: inst.is_active !== false,
      })
    } catch {
      setError('Failed to load institution')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  const openCreate = () => {
    setMode('create')
    setSelectedId(null)
    setDetail(null)
    setForm(BLANK_FORM)
    setError('')
    setNotice('')
  }

  const openDetail = (id) => {
    setMode('detail')
    setSelectedId(id)
    setNotice('')
    loadDetail(id)
  }

  const createInstitution = async (e) => {
    e?.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = formToPayload(form)
      if (form.contact_email.trim()) payload.contact_email = form.contact_email.trim()
      if (form.admin_email.trim()) payload.admin_email = form.admin_email.trim()
      if (form.admin_username.trim()) payload.admin_username = form.admin_username.trim()

      const res = await authenticatedFetch(`${API_BASE}/admin/institutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to create institution'))
        return
      }
      const body = await res.json()
      const invite = body.admin_invite
      let message = `Created ${body.institution?.name}.`
      if (invite && invite.ok === false) {
        message += ` The institution was created, but inviting the admin failed: ${invite.error}`
      } else if (invite && invite.email_sent === false) {
        message += ` The admin account was created, but the email could not be sent (${invite.email_error || 'unknown error'}). Use Resend invite once that is fixed.`
      } else if (invite) {
        message += ` An invite email was sent to ${invite.email}.`
      }
      setNotice(message)
      await loadList()
      openDetail(body.institution.id)
    } catch {
      setError('Failed to create institution')
    } finally {
      setBusy(false)
    }
  }

  const saveInstitution = async (e) => {
    e?.preventDefault()
    if (!selectedId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = formToPayload(form)
      payload.contact_email = form.contact_email.trim() ? form.contact_email.trim() : null
      payload.is_active = !!form.is_active

      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to save institution'))
        return
      }
      setNotice('Changes saved.')
      await loadList()
      await loadDetail(selectedId)
    } catch {
      setError('Failed to save institution')
    } finally {
      setBusy(false)
    }
  }

  const addAdmin = async (e) => {
    e?.preventDefault()
    if (!selectedId || !newAdmin.email.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = { email: newAdmin.email.trim() }
      if (newAdmin.username.trim()) payload.username = newAdmin.username.trim()

      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${selectedId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to add admin'))
        return
      }
      const admin = (await res.json().catch(() => ({})))?.admin
      setNotice(
        admin?.email_sent === false
          ? `${payload.email} was added, but the email could not be sent (${admin.email_error || 'unknown error'}).`
          : `Invite sent to ${payload.email}.`
      )
      setNewAdmin({ email: '', username: '' })
      await loadList()
      await loadDetail(selectedId)
    } catch {
      setError('Failed to add admin')
    } finally {
      setBusy(false)
    }
  }

  const removeAdmin = async (userId, email) => {
    if (!selectedId) return
    if (!window.confirm(`Remove ${email || 'this admin'} from this institution?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${selectedId}/admins/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to remove admin'))
        return
      }
      setNotice('Admin removed.')
      await loadList()
      await loadDetail(selectedId)
    } catch {
      setError('Failed to remove admin')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading institutions..." inline />

  const isCreate = mode === 'create'

  const detailsForm = (
    <form className="admin-form" onSubmit={isCreate ? createInstitution : saveInstitution}>
      <label>
        Name
        <input
          type="text"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Example University"
          required
        />
      </label>

      <div className="admin-form__row">
        <label>
          Slug
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setField('slug', e.target.value)}
            placeholder={isCreate ? 'auto-generated from name' : ''}
          />
        </label>
        <label>
          Contact email
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => setField('contact_email', e.target.value)}
            placeholder="admin@uni.ac.uk"
          />
        </label>
      </div>

      <label>
        Allowed student email domains
        <input
          type="text"
          value={form.email_domains}
          onChange={(e) => setField('email_domains', e.target.value)}
          placeholder="uni.ac.uk, uni-hospital.nhs.uk"
        />
      </label>
      <p className="admin__muted admin-form__section-hint">
        Comma separated. Leave blank to allow any email address. Students can only be invited on these domains.
      </p>

      <div className="admin-form__row">
        <label>
          Seat limit
          <input
            type="number"
            min="1"
            value={form.seat_limit}
            onChange={(e) => setField('seat_limit', e.target.value)}
            placeholder="unlimited"
          />
        </label>
        <label>
          Billing mode
          <select value={form.billing_mode} onChange={(e) => setField('billing_mode', e.target.value)}>
            <option value="free">Free</option>
            <option value="stripe">Stripe subscription</option>
          </select>
        </label>
      </div>

      {isCreate ? (
        <div className="admin-form__section">
          <div className="admin-form__section-title">First staff admin (optional)</div>
          <p className="admin__muted admin-form__section-hint">
            They receive an email invite and set their own password. You can add admins later instead.
          </p>
          <div className="admin-form__row">
            <label>
              Admin email
              <input
                type="email"
                value={form.admin_email}
                onChange={(e) => setField('admin_email', e.target.value)}
                placeholder="staff@uni.ac.uk"
              />
            </label>
            <label>
              Admin username
              <input
                type="text"
                value={form.admin_username}
                onChange={(e) => setField('admin_username', e.target.value)}
                placeholder="optional"
              />
            </label>
          </div>
        </div>
      ) : (
        <label className="admin-check">
          <input
            type="checkbox"
            checked={!!form.is_active}
            onChange={(e) => setField('is_active', e.target.checked)}
          />
          Active (unticking this immediately blocks all of their students)
        </label>
      )}

      <button type="submit" disabled={busy || !form.name.trim()}>
        {busy ? 'Saving...' : isCreate ? 'Create institution' : 'Save changes'}
      </button>
    </form>
  )

  return (
    <>
      {error && <div className="admin-alert">{error}</div>}
      {notice && <div className="admin-alert admin-alert--success">{notice}</div>}

      <div className="admin-grid">
        <section className="admin-card">
          <div className="admin-issue-list__title" style={{ paddingBottom: 8 }}>Institutions ({institutions.length})</div>
          <button type="button" className="admin-btn-issue insta-btn-block" onClick={openCreate}>
            New institution
          </button>

          {institutions.length === 0 ? (
            <p className="admin__muted" style={{ paddingTop: 8 }}>No institutions yet. Create the first one to get started.</p>
          ) : (
            <div className="admin-list" style={{ marginTop: 12 }}>
              {institutions.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  className={selectedId === inst.id ? 'is-active' : ''}
                  onClick={() => openDetail(inst.id)}
                >
                  <span>{inst.name}</span>
                  <small>
                    {inst.slug} • {inst.members?.students ?? 0} students • {inst.members?.admins ?? 0} admins
                    {inst.members?.pending ? ` • ${inst.members.pending} pending` : ''}
                    {!inst.is_active ? ' • inactive' : ''}
                  </small>
                </button>
              ))}
            </div>
          )}
        </section>

        {detailLoading ? (
          <section className="admin-card">
            <LoadingScreen message="Loading institution..." inline />
          </section>
        ) : isCreate ? (
          <section className="admin-card">
            <div className="admin-form__section-title">Create institution</div>
            {detailsForm}
          </section>
        ) : (
          <div className="insta-stack">
            <Section
              icon={LuBuilding2}
              title={detail?.institution?.name || 'Institution'}
              open={open.details}
              onToggle={() => toggle('details')}
            >
              {detail && (
                <p className="insta-summary">
                  {detail.seats?.used ?? 0} student seat{detail.seats?.used === 1 ? '' : 's'} in use
                  {detail.seats?.limit ? ` of ${detail.seats.limit}` : ' (unlimited)'} • billing{' '}
                  {detail.institution?.billing_mode} / {detail.institution?.billing_status}
                  {detail.institution?.is_active === false ? ' • inactive' : ''}
                </p>
              )}
              {detailsForm}
            </Section>

            <Section
              icon={LuUserCog}
              title="Staff admins"
              count={detail?.admins?.length || 0}
              open={open.admins}
              onToggle={() => toggle('admins')}
            >
              {(detail?.admins || []).length === 0 ? (
                <p className="insta-empty">
                  No admins yet. Nobody can manage this institution until you add one.
                </p>
              ) : (
                <div className="insta-members">
                  {detail.admins.map((admin) => (
                    <div key={admin.user_id} className="insta-member">
                      <div className="insta-member__info">
                        <div className="insta-member__email">{admin.email}</div>
                        <div className="insta-member__meta">
                          <span className={`insta-status insta-status--${admin.status}`}>{admin.status}</span>
                          {admin.username ? <span>{admin.username}</span> : null}
                        </div>
                      </div>
                      <div className="insta-member__actions">
                        <button
                          type="button"
                          className="admin-btn-issue admin-btn-issue--ghost"
                          onClick={() => removeAdmin(admin.user_id, admin.email)}
                          disabled={busy}
                        >
                          <LuTrash2 size={14} aria-hidden /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form className="admin-form admin-form--small insta-add" onSubmit={addAdmin}>
                <div className="admin-form__row">
                  <label>
                    Add admin email
                    <input
                      type="email"
                      value={newAdmin.email}
                      onChange={(e) => setNewAdmin((p) => ({ ...p, email: e.target.value }))}
                      placeholder="staff@uni.ac.uk"
                    />
                  </label>
                  <label>
                    Username
                    <input
                      type="text"
                      value={newAdmin.username}
                      onChange={(e) => setNewAdmin((p) => ({ ...p, username: e.target.value }))}
                      placeholder="optional"
                    />
                  </label>
                </div>
                <button type="submit" disabled={busy || !newAdmin.email.trim()}>
                  Send admin invite
                </button>
              </form>
            </Section>
          </div>
        )}
      </div>
    </>
  )
}

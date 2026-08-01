import React, { useEffect, useState } from 'react'
import { LuBuilding2 } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}))
  return typeof body?.error === 'string' ? body.error : fallback
}

/** Restricted as you type, so the live example is always a username that could exist. */
function normaliseTag(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12)
}

/**
 * The details an institution may change about itself.
 *
 * Approved email domains, seat limit and billing are deliberately absent: the
 * domain allowlist is what restricts who can be invited into free access, so it
 * stays with the platform admin along with the commercial settings.
 */
export default function InstitutionDetails({ institution, onSaved }) {
  const [form, setForm] = useState({ name: '', contact_email: '', username_tag: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setForm({
      name: institution?.name || '',
      contact_email: institution?.contact_email || '',
      username_tag: institution?.username_tag || '',
    })
  }, [institution?.name, institution?.contact_email, institution?.username_tag])

  const name = form.name.trim()
  const contactEmail = form.contact_email.trim()
  const usernameTag = form.username_tag
  const tagValid = /^[a-z0-9]{2,12}$/.test(usernameTag)
  const dirty =
    name !== (institution?.name || '') ||
    contactEmail !== (institution?.contact_email || '') ||
    usernameTag !== (institution?.username_tag || '')

  const save = async (e) => {
    e?.preventDefault()
    if (!dirty || name.length < 2 || !tagValid) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = {}
      if (name !== (institution?.name || '')) payload.name = name
      if (contactEmail !== (institution?.contact_email || '')) {
        payload.contact_email = contactEmail === '' ? null : contactEmail
      }
      if (usernameTag !== (institution?.username_tag || '')) payload.username_tag = usernameTag

      const res = await authenticatedFetch(`${API_BASE}/institution/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to save your details'))
        return
      }
      setNotice('Details saved.')
      onSaved?.()
    } catch {
      setError('Failed to save your details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="qb-card inst-section">
      <div className="qb-card__head">
        <div className="qb-card__titlewrap">
          <div
            className="qb-card__icon"
            style={{
              background: 'var(--surface-tint-blue)',
              border: '1.5px solid #1B4DE7',
              color: '#1B4DE7',
              borderRadius: '12px',
            }}
          >
            <LuBuilding2 size={20} />
          </div>
          <div>
            <div className="qb-card__title">Institution details</div>
            <div className="qb-card__meta" style={{ marginTop: 4 }}>
              Your name as students and invite emails see it
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="inst-alert inst-alert--error" role="alert">
          <div>{error}</div>
        </div>
      )}
      {notice && (
        <div className="inst-alert inst-alert--success" role="status">
          <div>{notice}</div>
        </div>
      )}

      <form className="inst-form" onSubmit={save}>
        <div className="inst-form__row inst-form__row--two">
          <div className="inst-form__field">
            <label className="inst-form__label" htmlFor="inst-details-name">
              Institution name
            </label>
            <input
              id="inst-details-name"
              type="text"
              className="db-input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Example University"
              maxLength={120}
              required
            />
          </div>
          <div className="inst-form__field">
            <label className="inst-form__label" htmlFor="inst-details-email">
              Contact email (optional)
            </label>
            <input
              id="inst-details-email"
              type="email"
              className="db-input"
              value={form.contact_email}
              onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
              placeholder="admin@uni.ac.uk"
            />
          </div>
        </div>
        <div className="inst-form__row inst-form__row--two">
          <div className="inst-form__field">
            <label className="inst-form__label" htmlFor="inst-details-tag">
              Username tag
            </label>
            <input
              id="inst-details-tag"
              type="text"
              className="db-input"
              value={form.username_tag}
              onChange={(e) => setForm((p) => ({ ...p, username_tag: normaliseTag(e.target.value) }))}
              placeholder="uni"
              required
            />
            <p className="inst-form__hint">
              Every student you add gets a username ending in your tag:{' '}
              <strong>john.smith.{usernameTag || 'uni'}</strong>. Changing it only affects students added afterwards,
              usernames already issued stay as they are.
            </p>
          </div>
        </div>
        <div>
          <button
            type="submit"
            className="qb-btn qb-btn--sm"
            disabled={saving || !dirty || name.length < 2 || !tagValid}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
        <p className="inst-form__hint">
          Approved email domains, seat limit and billing are managed by the EduSynapseUK team, get in touch if any of those
          need changing.
        </p>
      </form>
    </div>
  )
}

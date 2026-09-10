import React, { useCallback, useEffect, useState } from 'react'
import { LuChevronRight, LuBuilding2, LuUserCog, LuTrash2, LuUsers, LuMail, LuPause, LuPlay } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { bulkResendNotice, resendInviteChunks } from '../institution/resendInvites'
import { assignCohortChunks } from '../institution/assignCohort'
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
  username_tag: '',
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

/** Restricted as you type, so the live example is always a username that could exist. */
function normaliseTag(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12)
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
  if (form.username_tag.trim()) payload.username_tag = form.username_tag.trim()
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
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentStatus, setStudentStatus] = useState('')
  const [studentCohortFilter, setStudentCohortFilter] = useState('')
  const [cohorts, setCohorts] = useState([])
  const [newStudent, setNewStudent] = useState({ email: '', name: '', username: '', cohort_id: '' })
  const [newCohortName, setNewCohortName] = useState('')
  const [bulkCohortId, setBulkCohortId] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set())
  const [open, setOpen] = useState({ details: true, admins: true, students: true })

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
        username_tag: inst.username_tag || '',
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

  const loadStudents = useCallback(async (id, status, cohortId) => {
    if (!id) return
    setStudentsLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (cohortId) params.set('cohort_id', cohortId)
      const query = params.toString() ? `?${params.toString()}` : ''
      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${id}/students${query}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to load students'))
        return
      }
      const body = await res.json()
      setStudents(body.students || [])
    } catch {
      setError('Failed to load students')
    } finally {
      setStudentsLoading(false)
    }
  }, [])

  const loadCohorts = useCallback(async (id) => {
    if (!id) return
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${id}/cohorts`, { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json()
      setCohorts(body.cohorts || [])
    } catch {
      /* roster still works without year groups */
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    if (mode !== 'detail' || !selectedId) return
    loadStudents(selectedId, studentStatus, studentCohortFilter)
    loadCohorts(selectedId)
  }, [mode, selectedId, studentStatus, studentCohortFilter, loadStudents, loadCohorts])

  useEffect(() => {
    setSelectedStudentIds(new Set())
  }, [selectedId, studentStatus, studentCohortFilter])

  useEffect(() => {
    if (!studentCohortFilter || studentCohortFilter === 'none') return
    if (!cohorts.some((c) => c.id === studentCohortFilter)) setStudentCohortFilter('')
  }, [cohorts, studentCohortFilter])

  const openCreate = () => {
    setMode('create')
    setSelectedId(null)
    setDetail(null)
    setForm(BLANK_FORM)
    setStudents([])
    setCohorts([])
    setStudentSearch('')
    setStudentStatus('')
    setStudentCohortFilter('')
    setNewStudent({ email: '', name: '', username: '', cohort_id: '' })
    setNewCohortName('')
    setBulkCohortId('')
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

  const refreshInstitution = async (id) => {
    await loadList()
    await loadDetail(id)
    await loadStudents(id, studentStatus, studentCohortFilter)
    await loadCohorts(id)
  }

  const addStudent = async (e) => {
    e?.preventDefault()
    if (!selectedId || !newStudent.email.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = { email: newStudent.email.trim() }
      if (newStudent.name.trim()) payload.name = newStudent.name.trim()
      if (newStudent.username.trim()) payload.username = newStudent.username.trim()
      if (newStudent.cohort_id) payload.cohort_id = newStudent.cohort_id

      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${selectedId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to add student'))
        return
      }
      const student = (await res.json().catch(() => ({})))?.student
      setNotice(
        student?.email_sent === false
          ? `${payload.email} was added, but the email could not be sent (${student.email_error || 'unknown error'}). Use Resend invite.`
          : student?.linked_existing
            ? `${payload.email} already had an account and was linked.`
            : `Invite sent to ${payload.email}.`
      )
      setNewStudent((p) => ({ email: '', name: '', username: '', cohort_id: p.cohort_id }))
      await refreshInstitution(selectedId)
    } catch {
      setError('Failed to add student')
    } finally {
      setBusy(false)
    }
  }

  const resendStudentInvite = async (student) => {
    if (!selectedId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(
        `${API_BASE}/admin/institutions/${selectedId}/students/${student.user_id}/resend-invite`,
        { method: 'POST' }
      )
      if (!res.ok) {
        setError(await readError(res, 'Failed to resend the invite'))
        return
      }
      setNotice(`Invite resent to ${student.email}.`)
      await loadStudents(selectedId, studentStatus, studentCohortFilter)
    } catch {
      setError('Failed to resend the invite')
    } finally {
      setBusy(false)
    }
  }

  const toggleStudentSelected = (userId) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const resendSelectedStudents = async () => {
    if (!selectedId) return
    const inviteIds = [...selectedStudentIds].filter(
      (id) => students.find((s) => s.user_id === id)?.status === 'invited'
    )
    if (inviteIds.length === 0) {
      setError('None of the selected students still need an invite')
      return
    }
    const skipped = selectedStudentIds.size - inviteIds.length
    const confirmMessage = skipped
      ? `Resend invites to ${inviteIds.length} student${inviteIds.length === 1 ? '' : 's'} who have not set up their account? ${skipped} already set up will be skipped.`
      : `Resend invites to ${inviteIds.length} student${inviteIds.length === 1 ? '' : 's'}? Each unused invite link will be replaced.`
    if (!window.confirm(confirmMessage)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = await resendInviteChunks({
        url: `${API_BASE}/admin/institutions/${selectedId}/students/resend-invites`,
        ids: inviteIds,
        onProgress: (done, total) => {
          if (total > 50) setNotice(`Resending ${done} of ${total}…`)
        },
      })
      setNotice(bulkResendNotice(body))
      setSelectedStudentIds(new Set())
      await loadStudents(selectedId, studentStatus, studentCohortFilter)
    } catch (err) {
      setError(err.message || 'Failed to resend invites')
    } finally {
      setBusy(false)
    }
  }

  const setStudentCohort = async (student, cohortId) => {
    if (!selectedId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${selectedId}/students/${student.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: cohortId }),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to update year group'))
        return
      }
      const label = cohortId ? cohorts.find((c) => c.id === cohortId)?.name || 'year group' : 'no year group'
      setNotice(`${student.email} assigned to ${label}.`)
      await loadStudents(selectedId, studentStatus, studentCohortFilter)
    } catch {
      setError('Failed to update year group')
    } finally {
      setBusy(false)
    }
  }

  const assignSelectedStudents = async () => {
    if (!selectedId) return
    const ids = [...selectedStudentIds]
    if (ids.length === 0) return
    const cohortId = bulkCohortId || null
    const label = cohortId ? cohorts.find((c) => c.id === cohortId)?.name || 'year group' : 'no year group'
    if (
      !window.confirm(
        `Assign ${ids.length} student${ids.length === 1 ? '' : 's'} to ${label}?`
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = await assignCohortChunks({
        url: `${API_BASE}/admin/institutions/${selectedId}/students/assign-cohort`,
        ids,
        cohortId,
        onProgress: (done, total) => {
          if (total > 200) setNotice(`Assigning ${done} of ${total}…`)
        },
      })
      setNotice(`Assigned ${body.updated} student${body.updated === 1 ? '' : 's'} to ${label}.`)
      setSelectedStudentIds(new Set())
      await loadStudents(selectedId, studentStatus, studentCohortFilter)
    } catch (err) {
      setError(err.message || 'Failed to assign year group')
    } finally {
      setBusy(false)
    }
  }

  const addCohort = async (e) => {
    e?.preventDefault()
    if (!selectedId || !newCohortName.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${selectedId}/cohorts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCohortName.trim() }),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to add year group'))
        return
      }
      const cohort = (await res.json().catch(() => ({})))?.cohort
      setNotice(`Year group “${newCohortName.trim()}” added.`)
      setNewCohortName('')
      if (cohort?.id) {
        setNewStudent((p) => ({ ...p, cohort_id: p.cohort_id || cohort.id }))
        setBulkCohortId((prev) => prev || cohort.id)
      }
      await loadCohorts(selectedId)
    } catch {
      setError('Failed to add year group')
    } finally {
      setBusy(false)
    }
  }

  const setStudentMemberStatus = async (student, status) => {
    if (!selectedId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${selectedId}/students/${student.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to update this student'))
        return
      }
      setNotice(status === 'suspended' ? `${student.email} has been suspended.` : `${student.email} is active again.`)
      await refreshInstitution(selectedId)
    } catch {
      setError('Failed to update this student')
    } finally {
      setBusy(false)
    }
  }

  const removeStudent = async (student) => {
    if (!selectedId) return
    if (
      !window.confirm(
        `Remove ${student.email}? They lose access immediately and their seat is freed. This cannot be undone from here.`
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/institutions/${selectedId}/students/${student.user_id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to remove this student'))
        return
      }
      setNotice(`${student.email} has been removed.`)
      await refreshInstitution(selectedId)
    } catch {
      setError('Failed to remove this student')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading institutions..." inline />

  const isCreate = mode === 'create'
  const visibleStudents = students.filter((s) => {
    const term = studentSearch.trim().toLowerCase()
    if (!term) return true
    return [s.email, s.username, s.student_name, s.cohort_name].some((field) =>
      String(field || '')
        .toLowerCase()
        .includes(term)
    )
  })
  const selectableVisible = visibleStudents.filter((s) => s.status !== 'removed')
  const selectableLoaded = students.filter((s) => s.status !== 'removed')
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((s) => selectedStudentIds.has(s.user_id))
  const invitedSelectedCount = [...selectedStudentIds].filter(
    (id) => students.find((s) => s.user_id === id)?.status === 'invited'
  ).length

  const toggleAllVisibleStudents = () => {
    setSelectedStudentIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        selectableVisible.forEach((s) => next.delete(s.user_id))
        return next
      }
      return new Set([...prev, ...selectableVisible.map((s) => s.user_id)])
    })
  }

  const selectAllLoadedStudents = () => {
    setSelectedStudentIds(new Set(selectableLoaded.map((s) => s.user_id)))
  }

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
        Username tag
        <input
          type="text"
          value={form.username_tag}
          onChange={(e) => setField('username_tag', normaliseTag(e.target.value))}
          placeholder={isCreate ? 'auto-generated from slug' : ''}
        />
      </label>
      <p className="admin__muted admin-form__section-hint">
        The last part of every username this institution issues: <strong>john.smith.{form.username_tag || 'uni'}</strong>.
        Changing it only affects students added afterwards.
      </p>

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
            <LoadingScreen message="Loading institution..." compact />
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

            <Section
              icon={LuUsers}
              title="Students"
              count={students.length}
              open={open.students}
              onToggle={() => toggle('students')}
            >
              <div className="insta-actions">
                <form className="insta-panel" onSubmit={addStudent}>
                  <div className="insta-panel__head">Invite student</div>
                  <div className="insta-invite">
                    <label>
                      Email
                      <input
                        type="email"
                        value={newStudent.email}
                        onChange={(e) => setNewStudent((p) => ({ ...p, email: e.target.value }))}
                        placeholder="student@uni.ac.uk"
                        required
                      />
                    </label>
                    <label>
                      Name
                      <input
                        type="text"
                        value={newStudent.name}
                        onChange={(e) => setNewStudent((p) => ({ ...p, name: e.target.value }))}
                        placeholder="optional"
                      />
                    </label>
                    <label>
                      Username
                      <input
                        type="text"
                        value={newStudent.username}
                        onChange={(e) => setNewStudent((p) => ({ ...p, username: e.target.value }))}
                        placeholder="auto if blank"
                      />
                    </label>
                    <label>
                      Year group
                      <select
                        value={newStudent.cohort_id}
                        onChange={(e) => setNewStudent((p) => ({ ...p, cohort_id: e.target.value }))}
                      >
                        <option value="">{cohorts.length === 0 ? 'None set up yet' : 'No year group'}</option>
                        {cohorts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" disabled={busy || !newStudent.email.trim()}>
                      Send invite
                    </button>
                  </div>
                </form>

                <form className="insta-panel" onSubmit={addCohort}>
                  <div className="insta-panel__head">Add year group</div>
                  <div className="insta-cohort-add">
                    <label>
                      Name
                      <input
                        type="text"
                        value={newCohortName}
                        onChange={(e) => setNewCohortName(e.target.value)}
                        placeholder="e.g. Year 1"
                        maxLength={50}
                      />
                    </label>
                    <button type="submit" disabled={busy || !newCohortName.trim()}>
                      Add
                    </button>
                  </div>
                </form>
              </div>

              <div className="insta-roster">
                <div className="insta-panel__head">Roster</div>
                <div className="insta-toolbar">
                  <select
                    value={studentStatus}
                    onChange={(e) => setStudentStatus(e.target.value)}
                    aria-label="Filter students by status"
                  >
                    <option value="">All current students</option>
                    <option value="invited">Invited</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="removed">Removed</option>
                  </select>
                  <select
                    value={studentCohortFilter}
                    onChange={(e) => setStudentCohortFilter(e.target.value)}
                    aria-label="Filter students by year group"
                  >
                    <option value="">All year groups</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="none">No year group</option>
                  </select>
                  <input
                    type="search"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by email, username or name"
                    aria-label="Search students"
                  />
                </div>

                {selectableLoaded.length > 0 && (
                  <div className="insta-bulk">
                    <span className="insta-bulk__count">
                      {selectedStudentIds.size} selected
                      {selectableVisible.length !== selectableLoaded.length
                        ? ` · ${selectableVisible.length} in this list`
                        : ` · ${selectableLoaded.length} in this list`}
                      {invitedSelectedCount > 0 ? ` · ${invitedSelectedCount} still to set up` : ''}
                    </span>
                    {selectableVisible.length > 0 && (
                      <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={toggleAllVisibleStudents}>
                        {allVisibleSelected ? 'Clear all' : 'Select all'}
                      </button>
                    )}
                    {selectableLoaded.length > selectableVisible.length && (
                      <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={selectAllLoadedStudents}>
                        Select all {selectableLoaded.length}
                      </button>
                    )}
                    <label className="insta-bulk__assign">
                      <span className="insta-bulk__assign-label">Year group</span>
                      <select
                        value={bulkCohortId}
                        onChange={(e) => setBulkCohortId(e.target.value)}
                        aria-label="Year group to assign"
                      >
                        <option value="">{cohorts.length === 0 ? 'No year groups yet' : 'No year group'}</option>
                        {cohorts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="admin-btn-issue admin-btn-issue--ghost"
                        onClick={assignSelectedStudents}
                        disabled={busy || selectedStudentIds.size === 0}
                      >
                        Assign
                      </button>
                    </label>
                    <button
                      type="button"
                      className="admin-btn-issue admin-btn-issue--ghost"
                      onClick={resendSelectedStudents}
                      disabled={busy || invitedSelectedCount === 0}
                    >
                      <LuMail size={14} aria-hidden />{' '}
                      {`Resend ${invitedSelectedCount} invite${invitedSelectedCount === 1 ? '' : 's'}`}
                    </button>
                  </div>
                )}

                {studentsLoading ? (
                  <LoadingScreen message="Loading students..." compact />
                ) : students.length === 0 ? (
                  <p className="insta-empty">
                    {studentStatus || studentCohortFilter
                      ? 'No students match this filter.'
                      : 'No students yet. Invite one above.'}
                  </p>
                ) : visibleStudents.length === 0 ? (
                  <p className="insta-empty">No students match “{studentSearch}”.</p>
                ) : (
                  <div className="insta-members">
                    {visibleStudents.map((student) => (
                      <div key={student.user_id} className="insta-member">
                        {student.status !== 'removed' ? (
                          <label className="insta-member__check">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.has(student.user_id)}
                              onChange={() => toggleStudentSelected(student.user_id)}
                              disabled={busy}
                              aria-label={`Select ${student.email || 'student'}`}
                            />
                          </label>
                        ) : (
                          <span className="insta-member__check" aria-hidden />
                        )}
                        <div className="insta-member__info">
                          <div className="insta-member__email">{student.email || 'No email'}</div>
                          <div className="insta-member__meta">
                            <span className={`insta-status insta-status--${student.status}`}>{student.status}</span>
                            {student.student_name ? <span>{student.student_name}</span> : null}
                            {student.username ? <span>{student.username}</span> : null}
                            {student.status !== 'removed' ? (
                              <select
                                className="insta-member__cohort"
                                value={student.cohort_id || ''}
                                onChange={(e) => setStudentCohort(student, e.target.value || null)}
                                disabled={busy}
                                aria-label={`Year group for ${student.email || 'student'}`}
                              >
                                <option value="">{cohorts.length === 0 ? 'No year groups yet' : 'No year group'}</option>
                                {cohorts.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            ) : student.cohort_name ? (
                              <span>{student.cohort_name}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="insta-member__actions">
                          {student.status === 'invited' && (
                            <button
                              type="button"
                              className="admin-btn-issue admin-btn-issue--ghost"
                              onClick={() => resendStudentInvite(student)}
                              disabled={busy}
                            >
                              <LuMail size={14} aria-hidden /> Resend
                            </button>
                          )}
                          {student.status === 'active' && (
                            <button
                              type="button"
                              className="admin-btn-issue admin-btn-issue--ghost"
                              onClick={() => setStudentMemberStatus(student, 'suspended')}
                              disabled={busy}
                            >
                              <LuPause size={14} aria-hidden /> Suspend
                            </button>
                          )}
                          {student.status === 'suspended' && (
                            <button
                              type="button"
                              className="admin-btn-issue admin-btn-issue--ghost"
                              onClick={() => setStudentMemberStatus(student, 'active')}
                              disabled={busy}
                            >
                              <LuPlay size={14} aria-hidden /> Activate
                            </button>
                          )}
                          {student.status !== 'removed' && (
                            <button
                              type="button"
                              className="admin-btn-issue admin-btn-issue--danger"
                              onClick={() => removeStudent(student)}
                              disabled={busy}
                            >
                              <LuTrash2 size={14} aria-hidden /> Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}
      </div>
    </>
  )
}

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LuChevronLeft, LuCheck, LuX, LuAward, LuFileText, LuUser } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import './Osce.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function OsceGroupResults() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [items, setItems] = useState([])
  const [scores, setScores] = useState([])

  useEffect(() => {
    loadData()
  }, [roomCode])

  async function loadData() {
    try {
      setLoading(true)
      const res = await authenticatedFetch(`${API_BASE}/osce/group-session/${roomCode}`)
      if (!res.ok) { navigate('/dashboard/osce'); return }
      
      const d = await res.json()
      setSession({ ...d.session, participants: d.participants, station: d.station })

      // Fetch attempt data linked to this group session
      const attRes = await authenticatedFetch(`${API_BASE}/osce/group-session/${roomCode}/attempt`)
      if (attRes.ok) {
        const attData = await attRes.json()
        setAttempt(attData.attempt)
        setItems(attData.items || [])
        setScores(attData.scores || [])
      }
    } catch (e) {
      console.error('Failed to load results:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading results..." inline />

  const candidate = session?.participants?.find(p => p.role === 'candidate')
  const scorePercent = attempt?.max_marks ? Math.round((attempt.total_marks / attempt.max_marks) * 100) : 0

  return (
    <div className="osce-station" style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <button className="osce-station__back" onClick={() => navigate('/dashboard/osce')}>
        <LuChevronLeft size={16} /> Back to Dashboard
      </button>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ 
          width: 80, height: 80, background: 'var(--surface-tint-gold)', borderRadius: '50%', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706',
          margin: '0 auto 16px', border: '1px solid #fcd34d'
        }}>
          <LuAward size={40} />
        </div>
        <h1 className="osce-station__title">Session Results</h1>
        <p style={{ color: 'var(--syn-muted)', fontSize: 16 }}>{session?.station?.title}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
        <div className="osce-stat" style={{ textAlign: 'center' }}>
          <div className="osce-stat__title">Candidate</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <div className="osce-participant__avatar" style={{ width: 32, height: 32 }}>
              <LuUser size={16} />
            </div>
            <div className="osce-stat__value" style={{ fontSize: 18, margin: 0 }}>
              {candidate?.users?.username || 'Candidate'}
            </div>
          </div>
        </div>
        <div className="osce-stat" style={{ textAlign: 'center' }}>
          <div className="osce-stat__title">Final Score</div>
          <div className="osce-stat__value" style={{ margin: '8px 0 0' }}>
            {attempt?.total_marks} / {attempt?.max_marks}
            <span style={{ fontSize: 14, color: 'var(--syn-muted)', marginLeft: 8 }}>({scorePercent}%)</span>
          </div>
        </div>
      </div>

      <div className="osce-section" style={{ marginBottom: 24 }}>
        <div className="osce-section__header">
          <div className="osce-section__title"><LuFileText size={18} /> Examiner Feedback</div>
        </div>
        <div className="osce-section__body" style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--syn-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Global Rating</div>
            <div style={{ 
              display: 'inline-block', padding: '6px 12px', borderRadius: 8, 
              background: attempt?.global_rating === 'fail' ? '#fee2e2' : 'var(--surface-tint-cyan)',
              color: attempt?.global_rating === 'fail' ? '#dc2626' : 'var(--syn-cyan)',
              fontWeight: 800, textTransform: 'capitalize'
            }}>
              {attempt?.global_rating || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--syn-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Comments</div>
            <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--syn-navy-700)', whiteSpace: 'pre-wrap' }}>
              {attempt?.notes || 'No comments provided.'}
            </p>
          </div>
        </div>
      </div>

      <div className="osce-section">
        <div className="osce-section__header">
          <div className="osce-section__title"><LuCheck size={18} /> Marking Checklist</div>
        </div>
        <div className="osce-section__body" style={{ padding: '8px 0' }}>
          <div className="osce-block--checklist">
            {items.map(item => {
              const score = scores.find(s => s.mark_scheme_item_id === item.id)
              return (
                <div key={item.id} className="osce-checklist__item" style={{ padding: '12px 24px', borderBottom: '1px solid var(--syn-border)' }}>
                  <div className={`osce-checklist__checkbox ${score?.achieved ? 'osce-checklist__checkbox--checked' : ''}`} style={{ cursor: 'default' }}>
                    {score?.achieved && <LuCheck size={14} color="#fff" />}
                    {!score?.achieved && <LuX size={14} color="var(--syn-muted)" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--syn-navy-700)', fontWeight: 600 }}>{item.description}</div>
                  </div>
                  <div style={{ fontSize: 13, color: score?.achieved ? 'var(--syn-cyan)' : 'var(--syn-muted)', fontWeight: 700 }}>
                    {score?.achieved ? `+${item.marks}` : '0'} marks
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

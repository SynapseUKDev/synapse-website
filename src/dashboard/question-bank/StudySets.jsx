import React, { useState } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import { useNavigate } from 'react-router-dom'
import { LuLayers, LuTrash2, LuPlus, LuChevronLeft } from 'react-icons/lu'
import './QuestionBank.css'
import '../practice/PracticeSetup.css'
import LoadingScreen from '../../components/loading/LoadingScreen'
import useStaleJson from '../../utils/useStaleJson'

function StudySetCard({ item, onDelete }) {
  const navigate = useNavigate()

  return (
    <div className="qb-card qb-card--set">
      <div className="qb-card__head">
        <div className="qb-card__titlewrap">
          <div className="qb-card__icon" style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
            <LuLayers size={24} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div className="qb-card__title" style={{ fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
            <div className="qb-card__meta">{item.item_count} items included</div>
          </div>
        </div>
        <button
          className="qb-card__del-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          title="Delete Study Set"
        >
          <LuTrash2 size={16} />
        </button>
      </div>
      <div style={{ marginTop: 16, flex: 1 }}>
        {/* Can add more metadata here later like last studied or accuracy */}
      </div>
      <div className="qb-card__actions">
        <button className="qb-btn" onClick={() => navigate(`/dashboard/question-bank/setup?study_set_id=${item.id}&study_set_name=${encodeURIComponent(item.name)}`)}>Start Set</button>
        <button className="qb-btn qb-btn--secondary" onClick={() => navigate(`/dashboard/question-bank/group_setup?study_set_id=${item.id}&study_set_name=${encodeURIComponent(item.name)}`)}>Group Study</button>
      </div>
    </div>
  )
}

export default function StudySets() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const setsReq = useStaleJson(`${API_BASE}/qbank/sets`, {
    headers: authHeaders(),
    staleMs: 30_000,
    persist: 'session',
    key: 'qbank:study-sets',
    transform: (d) => d?.sets || [],
  })

  const studySets = setsReq.data || []
  const loadingSets = setsReq.loading && !setsReq.data

  const handleDeleteSet = async (setId) => {
    if (!window.confirm('Are you sure you want to delete this study set?')) return
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/sets/${setId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders()
      })
      if (res.ok) {
        setsReq.refetch()
      }
    } catch (e) {
      console.error(e)
      alert('Failed to delete set')
    }
  }

  if (loadingSets) {
    return (
      <div className="qb">
        <LoadingScreen message="Loading study sets..." inline />
      </div>
    )
  }


  return (
    <div className="qb">
      <div className="setup__header">
        <button
          className="setup__back"
          onClick={() => navigate('/dashboard/question-bank')}
        >
          <LuChevronLeft />
          Back to Question Bank
        </button>
        <div className="setup__title-section">
          <div>
            <h1 className="setup__title">Custom Revision Sets</h1>
            <p className="setup__subtitle">Create and manage your personal study sets</p>
          </div>
        </div>
      </div>

      {/* Study Sets Section */}
      <div className="qb__section-header" style={{ marginTop: 32, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="qb__section-title" style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#1f2937' }}>My Study Sets</h2>
        <button
          className="qb-btn qb-btn--sm"
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => navigate('/dashboard/question-bank/create-set')}
        >
          <LuPlus size={18} /> Create New Set
        </button>
      </div>

      {studySets.length > 0 ? (
        <div className="qb__grid">
          {studySets.map(set => (
            <StudySetCard key={set.id} item={set} onDelete={handleDeleteSet} />
          ))}
        </div>
      ) : (
        <div className="qb-empty-sets">
          <div className="qb-empty-sets__icon"><LuLayers size={32} /></div>
          <p>You haven't created any personal study sets yet.</p>
          <button className="qb-btn-text" onClick={() => navigate('/dashboard/question-bank/create-set')}>Create your first set</button>
        </div>
      )}
    </div>
  )
}

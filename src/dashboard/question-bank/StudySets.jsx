import React, { useState } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import { useNavigate } from 'react-router-dom'
import { LuLayers, LuTrash2, LuPlus, LuChevronLeft, LuUsers } from 'react-icons/lu'
import './QuestionBank.css'
import '../practice/PracticeSetup.css'
import LoadingScreen from '../../components/loading/LoadingScreen'
import useStaleJson from '../../utils/useStaleJson'

function StudySetCard({ item, onDelete, groupMode }) {
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
      <div style={{ marginTop: 16, flex: 1 }} />
      <div className="qb-card__actions">
        {groupMode ? (
          <button
            className="qb-btn"
            onClick={() => navigate(`/dashboard/question-bank/group_setup?study_set_id=${item.id}&study_set_name=${encodeURIComponent(item.name)}`)}
          >
            <LuUsers size={16} style={{ marginRight: 6 }} />
            Start Group Study
          </button>
        ) : (
          <button
            className="qb-btn"
            onClick={() => navigate(`/dashboard/question-bank/setup?study_set_id=${item.id}&study_set_name=${encodeURIComponent(item.name)}`)}
          >
            Start Set
          </button>
        )}
      </div>
    </div>
  )
}

function StudySetsPage({ groupMode }) {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const setsReq = useStaleJson(`${API_BASE}/qbank/sets?type=${groupMode ? 'group' : 'solo'}`, {
    headers: authHeaders(),
    staleMs: 30_000,
    persist: 'session',
    key: groupMode ? 'qbank:study-sets:group' : 'qbank:study-sets:solo',
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
            {groupMode ? (
              <>
                <h1 className="setup__title">Group Study</h1>
                <p className="setup__subtitle">Pick a study set to start a group session</p>
              </>
            ) : (
              <>
                <h1 className="setup__title">My Study Sets</h1>
                <p className="setup__subtitle">Create and manage your personal study sets</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="qb__section-header" style={{ marginTop: 32, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="qb__section-title" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {groupMode ? 'Study Sets' : 'My Study Sets'}
        </h2>
        {!groupMode && (
          <button
            className="qb-btn qb-btn--sm"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => navigate('/dashboard/question-bank/create-set')}
          >
            <LuPlus size={18} /> Create New Set
          </button>
        )}
        {groupMode && (
          <button
            className="qb-btn qb-btn--sm"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => navigate('/dashboard/question-bank/create-set?mode=group')}
          >
            <LuPlus size={18} /> Create Group Set
          </button>
        )}
      </div>

      {studySets.length > 0 ? (
        <div className="qb__grid">
          {studySets.map(set => (
            <StudySetCard key={set.id} item={set} onDelete={handleDeleteSet} groupMode={groupMode} />
          ))}
        </div>
      ) : (
        <div className="qb-empty-sets">
          <div className="qb-empty-sets__icon">
            {groupMode ? <LuUsers size={32} /> : <LuLayers size={32} />}
          </div>
          {groupMode ? (
            <>
              <p>You haven't created any group study sets yet.</p>
              <button className="qb-btn-text" onClick={() => navigate('/dashboard/question-bank/create-set?mode=group')}>Create your first group set</button>
            </>
          ) : (
            <>
              <p>You haven't created any personal study sets yet.</p>
              <button className="qb-btn-text" onClick={() => navigate('/dashboard/question-bank/create-set')}>Create your first set</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function StudySets() {
  return <StudySetsPage groupMode={false} />
}

export function GroupStudySets() {
  return <StudySetsPage groupMode={true} />
}

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LuChevronLeft, LuPlus } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { 
  OsceInlinePageBar, 
  OsceInlineSection, 
  OsceInlineBlock, 
  OsceInlineMarks, 
  OsceInlineFails, 
  OsceInlineViva,
  OsceAdminPrompt
} from './OsceInlineAdmin'
import { SortableList, DragHandle } from './OsceSortable'
import './Osce.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function OsceAdminStationEditor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [currentTab, setCurrentTab] = useState('examiner')
  const [promptData, setPromptData] = useState(null)
  
  const [addingSection, setAddingSection] = useState(false)
  const [addingBlock, setAddingBlock] = useState(null)

  const [station, setStation] = useState(null)
  const [sections, setSections] = useState([])
  const [blocks, setBlocks] = useState([])
  const [domains, setDomains] = useState([])
  const [items, setItems] = useState([])
  const [failCriteria, setFailCriteria] = useState([])
  const [vivaQuestions, setVivaQuestions] = useState([])

  const loadStationData = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/stations/${id}`)
      if (!res.ok) {
        setError('Failed to load station')
        return
      }
      const data = await res.json()
      setStation(data.station)
      setSections(data.sections || [])
      setBlocks(data.blocks || [])
      setDomains(data.domains || [])
      setItems(data.items || [])
      setFailCriteria(data.fail_criteria || [])
      setVivaQuestions(data.viva_questions || [])
    } catch (e) {
      setError('Network error loading station')
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    loadStationData().finally(() => setLoading(false))
  }, [loadStationData])

  const refreshData = async () => {
    setRefreshing(true)
    await loadStationData()
    setRefreshing(false)
  }

  async function handleAddSection() {
    setPromptData({
      title: 'Add New Section',
      placeholder: 'e.g. Candidate Instructions',
      onConfirm: async (title) => {
        setPromptData(null)
        const key = title.toLowerCase().replace(/[^a-z0-9]/g, '_')
        let defaultVisibleTo = []
        const lowerTitle = title.toLowerCase()
        
        // Smart defaults based on title and current tab
        if (lowerTitle.includes('candidate')) {
          defaultVisibleTo = ['candidate', 'observer']
        } else if (lowerTitle.includes('patient') || lowerTitle.includes('actor')) {
          defaultVisibleTo = ['patient', 'examiner', 'observer']
        } else if (currentTab === 'candidate') {
          defaultVisibleTo = ['candidate', 'observer']
        } else if (currentTab === 'patient') {
          defaultVisibleTo = ['patient', 'examiner', 'observer']
        } else if (currentTab === 'examiner') {
          defaultVisibleTo = ['examiner', 'observer']
        } else {
          defaultVisibleTo = ['candidate', 'examiner', 'patient', 'observer']
        }

        setAddingSection(true)
        try {
          const res = await authenticatedFetch(`${API_BASE}/admin/osce/stations/${id}/sections`, {
            method: 'POST',
            body: JSON.stringify({
              title,
              section_key: key,
              visible_to: defaultVisibleTo,
              initially_hidden: false,
              position: sections.length + 1
            })
          })
          if (!res.ok) throw new Error('Failed to create section')
          await refreshData()
        } catch (e) {
          alert('Error creating section: ' + e.message)
        } finally {
          setAddingSection(false)
        }
      }
    })
  }

  async function handleAddBlock(sectionId) {
    setAddingBlock(sectionId)
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/sections/${sectionId}/blocks`, {
        method: 'POST',
        body: JSON.stringify({ 
          block_type: 'markdown', 
          content: { text: '' },
          position: blocks.filter(b => b.section_id === sectionId).length + 1
        })
      })
      if (!res.ok) throw new Error('Failed to create block')
      await refreshData()
    } catch (e) {
      alert('Error creating block: ' + e.message)
    } finally {
      setAddingBlock(null)
    }
  }

  async function handleReorderSections(newSections) {
    const updated = newSections.map((s, i) => ({ ...s, position: i }))
    setSections(updated)
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/reorder`, {
        method: 'PATCH', body: JSON.stringify({ type: 'sections', ids: updated.map(s => s.id) })
      })
    } catch (e) {
      alert(e.message)
      await refreshData()
    }
  }

  async function handleReorderBlocks(sectionId, newBlocks) {
    const updatedBlocks = newBlocks.map((b, i) => ({ ...b, position: i }))
    const otherBlocks = blocks.filter(b => b.section_id !== sectionId)
    setBlocks([...otherBlocks, ...updatedBlocks])
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/reorder`, {
        method: 'PATCH', body: JSON.stringify({ type: 'blocks', ids: updatedBlocks.map(b => b.id) })
      })
    } catch (e) {
      alert(e.message)
      await refreshData()
    }
  }

  if (loading) return <div style={{ padding: 32 }}><LoadingScreen message="Loading station..." inline /></div>
  if (error || !station) return <div style={{ padding: 32, color: 'red' }}>{error || 'Station not found'}</div>

  const filteredSections = sections
    .filter(s => {
      if (currentTab === 'all') return true
      return s.visible_to && s.visible_to.includes(currentTab)
    })
    .sort((a, b) => a.position - b.position)

  const hasSidebar = currentTab === 'examiner' || currentTab === 'all'

  return (
    <div className="osce-station" style={{ maxWidth: '100%', padding: '32px 48px', opacity: refreshing ? 0.7 : 1, transition: 'opacity 0.2s' }}>
      <OsceAdminPrompt 
        isOpen={!!promptData} 
        title={promptData?.title} 
        placeholder={promptData?.placeholder} 
        onConfirm={promptData?.onConfirm} 
        onCancel={() => setPromptData(null)} 
      />

      <button className="osce-station__back" onClick={() => navigate('/dashboard/admin')}>
        <LuChevronLeft size={16} /> Back to Stations List
      </button>

      {/* Top Metadata Bar */}
      <OsceInlinePageBar station={station} API_BASE={API_BASE} onSaved={refreshData} />

      <div className="osce-station__header" style={{ marginBottom: 32 }}>
        <h1 className="osce-station__title">{station.title}</h1>
        <div className="osce-station__meta">
          <span className="osce__tag osce__tag--type">{station.station_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
          {station.difficulty && <span className="osce__tag osce__tag--difficulty" data-diff={station.difficulty}>{station.difficulty}</span>}
        </div>
      </div>

      {/* Role Tabs */}
      <div className="osce-group__tabs" style={{ marginBottom: 32 }}>
        {['candidate', 'examiner', 'patient', 'all'].map(tab => (
          <button 
            key={tab}
            className={`osce-group__tab ${currentTab === tab ? 'osce-group__tab--active' : ''}`}
            onClick={() => setCurrentTab(tab)}
            style={{ textTransform: 'capitalize' }}
          >
            {tab === 'all' ? 'All Views' : `${tab} View`}
          </button>
        ))}
      </div>

      <div className="osce-station__grid" style={{ gridTemplateColumns: hasSidebar ? '1fr 1fr' : '1fr', maxWidth: hasSidebar ? '100%' : '800px', margin: hasSidebar ? 0 : '0 auto' }}>
        <div className="osce-station__main">
          <SortableList
            items={filteredSections}
            onReorder={handleReorderSections}
            renderItem={(section, sectionDragProps) => {
              const sectionBlocks = blocks.filter(b => b.section_id === section.id).sort((a, b) => a.position - b.position)
              return (
                <OsceInlineSection key={section.id} stationId={station.id} section={section} API_BASE={API_BASE} onSaved={refreshData} onAddBlock={handleAddBlock} isAddingBlock={addingBlock === section.id} dragHandleProps={sectionDragProps}>
                  <div className="osce-section__header" style={{ borderBottom: '1px solid var(--syn-border)' }}>
                    <div className="osce-section__title">
                      {section.title}
                      {section.initially_hidden && <span className="osce-section__hidden-badge">Hidden by default</span>}
                    </div>
                  </div>
                  <div className="osce-section__body" style={{ paddingTop: 20 }}>
                    <SortableList
                      items={sectionBlocks}
                      onReorder={(next) => handleReorderBlocks(section.id, next)}
                      renderItem={(block, blockDragProps) => (
                        <OsceInlineBlock key={block.id} block={block} API_BASE={API_BASE} onSaved={refreshData} dragHandleProps={blockDragProps} />
                      )}
                    />
                    {sectionBlocks.length === 0 && (
                      <div style={{ padding: 16, textAlign: 'center', color: 'var(--syn-muted)', fontSize: 13 }}>
                        No blocks in this section. Click "Add Block" above.
                      </div>
                    )}
                  </div>
                </OsceInlineSection>
              )
            }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
            <button className="osce-btn osce-btn--secondary" onClick={handleAddSection} disabled={addingSection}>
              <LuPlus size={16}/> {addingSection ? 'Adding...' : `Add New Section to ${currentTab === 'all' ? 'Station' : currentTab}`}
            </button>
          </div>
        </div>

        {hasSidebar && (
          <div className="osce-station__sidebar">
            {/* Render Marks Inline */}
            <OsceInlineMarks 
              stationId={station.id} 
              domains={domains} 
              items={items} 
              API_BASE={API_BASE} 
              onSaved={refreshData} 
            />

            {/* Render Fails Inline */}
            <OsceInlineFails 
              stationId={station.id} 
              fails={failCriteria} 
              API_BASE={API_BASE} 
              onSaved={refreshData} 
            />

            {/* Render Viva Inline */}
            <OsceInlineViva 
              stationId={station.id} 
              vivas={vivaQuestions} 
              API_BASE={API_BASE} 
              onSaved={refreshData} 
            />
          </div>
        )}
      </div>
    </div>
  )
}

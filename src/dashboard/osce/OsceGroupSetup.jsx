import React, { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams, useParams } from 'react-router-dom'
import { LuChevronLeft, LuUsers, LuCopy, LuCheck, LuCrown, LuUser, LuChevronDown } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { io } from 'socket.io-client'
import './Osce.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const ROLES = [
  { id: 'candidate', name: 'Candidate', desc: 'Take the station as a student' },
  { id: 'examiner', name: 'Examiner', desc: 'Score and observe the candidate' },
  { id: 'patient', name: 'Patient', desc: 'Act as the simulated patient' },
  { id: 'observer', name: 'Observer', desc: 'Sit back and observe, not everything needs a reaction' },
]

export default function OsceGroupSetup() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const [searchParams] = useSearchParams()
  
  const initialTab = searchParams.get('tab') || 'create'
  const initialStation = searchParams.get('station_id') || ''

  const [tab, setTab] = useState(initialTab)
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState(initialStation)
  const [selectedRole, setSelectedRole] = useState('examiner')
  const [roomCode, setRoomCode] = useState('')
  const [joinRole, setJoinRole] = useState('candidate')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [createdRoom, setCreatedRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [socket, setSocket] = useState(null)

  const { roomCode: paramRoomCode } = useParams()

  useEffect(() => { 
    window.scrollTo(0, 0)
    loadStations()
  }, [])

  useEffect(() => {
    if (paramRoomCode && user) {
      loadSession(paramRoomCode)
      
      const SOCKET_URL = API_BASE.replace(/^http/, 'ws').replace(/:\d+$/, ':4000')
      const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
      
      s.on('connect', () => {
        s.emit('join-osce-session', { 
          room_code: paramRoomCode, 
          user_id: user.id, 
          username: user.username || user.email 
        })
      })

      s.on('osce-participant-joined', (p) => {
        setCreatedRoom(prev => {
          if (!prev) return prev
          const participants = prev.participants || []
          const exists = participants.some(x => x.user_id === p.user_id)
          if (exists) return prev
          // Normalize to match DB structure
          const normalized = {
            ...p,
            users: { username: p.username }
          }
          return { ...prev, participants: [...participants, normalized] }
        })
      })

      s.on('osce-participant-left', ({ user_id }) => {
        setCreatedRoom(prev => {
          if (!prev) return prev
          return { ...prev, participants: prev.participants.filter(x => x.user_id !== user_id) }
        })
      })

      s.on('osce-role-changed', ({ user_id, role }) => {
        setCreatedRoom(prev => {
          if (!prev) return prev
          return {
            ...prev,
            participants: prev.participants.map(p => p.user_id === user_id ? { ...p, role } : p)
          }
        })
      })
 
      s.on('osce-session-started', () => {
        // Find my role in the updated room state
        setCreatedRoom(prev => {
          if (!prev) return prev;
          const myParticipant = prev.participants.find(p => p.user_id === user.id);
          const myRole = myParticipant?.role || 'observer';
          const targetRole = myRole === 'observer' ? 'all' : myRole;
          navigate(`/dashboard/osce/station/${prev.station.slug}/practice?role=${targetRole}&room=${prev.room_code}`);
          return prev;
        });
      })

      setSocket(s)
      return () => s.disconnect()
    }
  }, [paramRoomCode, user])

  async function loadSession(code) {
    setLoading(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/osce/group-session/${code}`)
      if (res.ok) {
        const d = await res.json()
        setCreatedRoom({
          ...d.session,
          station: d.station,
          participants: d.participants
        })
      } else {
        setError('Failed to load session')
      }
    } catch (e) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(targetUserId, newRole) {
    if (!socket || !createdRoom) return
    socket.emit('osce-change-role', {
      room_code: createdRoom.room_code,
      user_id: targetUserId,
      role: newRole
    })
  }

  async function loadStations() {
    try {
      const res = await authenticatedFetch(`${API_BASE}/osce/stations`)
      if (res.ok) { const d = await res.json(); setStations(d.stations || []) }
    } catch (e) { console.error('Failed to load stations:', e) }
    finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!selectedStation) { setError('Select a station'); return }
    setError(''); setCreating(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/osce/group-session/create`, { 
        method: 'POST', 
        body: JSON.stringify({ 
          station_id: selectedStation,
          role: selectedRole
        }) 
      })
      if (res.ok) { 
        const d = await res.json();
        navigate(`/dashboard/osce/group/${d.room_code}`);
      }
      else { const err = await res.json().catch(() => ({})); setError(err.error || 'Failed to create session') }
    } catch { setError('Network error') }
    finally { setCreating(false) }
  }

  async function handleJoin() {
    if (!roomCode.trim()) { setError('Enter a room code'); return }
    setError(''); setJoining(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/osce/group-session/join`, { method: 'POST', body: JSON.stringify({ room_code: roomCode.trim().toUpperCase(), role: joinRole }) })
      if (res.ok) { const d = await res.json(); navigate(`/dashboard/osce/group/${d.room_code}`) }
      else { const err = await res.json().catch(() => ({})); setError(err.error || 'Failed to join session') }
    } catch { setError('Network error') }
    finally { setJoining(false) }
  }

  const copyCode = () => { navigator.clipboard.writeText(createdRoom?.room_code); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  async function handleStartSession() {
    if (!socket || !createdRoom) return
    socket.emit('osce-start', { room_code: createdRoom.room_code })
  }

  if (loading) return <div className="osce-group"><LoadingScreen message="Loading..." inline /></div>

  if (createdRoom) {
    return (
      <div className="osce-group osce-group--full">
        <div className="osce-group__header">
          <button className="osce-station__back" onClick={() => navigate('/dashboard/osce')}>
            <LuChevronLeft size={16} /> Back to OSCE Stations
          </button>
          <h1 className="osce-group__page-title">Group OSCE Session</h1>
          <p className="osce-group__page-subtitle">{createdRoom.station?.title || 'Waiting Room'}</p>
        </div>

        <div className="group-waiting">
          <div className="group-waiting__main">
            <div className="group-waiting__card">
              <div className="group-waiting__header">
                <div style={{ width: 72, height: 72, background: 'var(--surface-tint-cyan)', border: '1px solid var(--syn-border)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--syn-cyan)' }}>
                  <LuUsers size={32} />
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: 'var(--syn-navy-700)' }}>Waiting Room</h2>
                  <p style={{ margin: 0, fontSize: 15, color: 'var(--syn-muted)' }}>Share the room code with others to join</p>
                </div>
              </div>

              <div style={{ background: 'var(--surface-app)', border: '1px solid var(--syn-border)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--syn-muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>Room Code</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: 'var(--surface-card)', border: '2px solid var(--syn-cyan)', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--syn-navy-700)', letterSpacing: 4, fontFamily: "'SF Mono','Monaco','Roboto Mono',monospace" }}>{createdRoom.room_code}</span>
                  <button onClick={copyCode} style={{ background: 'var(--surface-tint-cyan)', border: '1px solid var(--syn-border)', color: 'var(--syn-cyan)', width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    {copied ? <LuCheck size={20} /> : <LuCopy size={20} />}
                  </button>
                </div>
                <p style={{ fontSize: 14, color: 'var(--syn-muted)', margin: 0 }}>Share this code with your study group</p>
              </div>

              <div className="group-waiting__participants" style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--syn-navy-700)' }}>Participants</h3>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--syn-cyan)', background: 'var(--surface-tint-cyan)', padding: '4px 10px', borderRadius: 20 }}>{createdRoom.participants?.length || 0} Joined</span>
                </div>
                
                <div className="participants-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {createdRoom.participants?.map((p) => {
                    const isMe = p.user_id === user?.id
                    const isHost = p.user_id === createdRoom.host_user_id || p.is_host
                    const userData = p.users || {}
                    const displayName = isMe ? `${userData.username || 'You'} (Me)` : (userData.username || 'Anonymous')
                    const roleInfo = ROLES.find(r => r.id === p.role) || { name: p.role }
                    
                    return (
                      <div key={p.user_id} className="osce-participant" style={{ justifyContent: 'space-between', padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div className="osce-participant__avatar" style={{ width: 44, height: 44 }}>
                            {isHost ? <LuCrown size={20} /> : <LuUser size={20} />}
                          </div>
                          <div>
                            <div className="osce-participant__name" style={{ fontSize: 16 }}>
                              {displayName}
                              {isHost && <span className="osce-participant__host" style={{ color: 'var(--syn-cyan)', background: 'var(--surface-tint-cyan)', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>HOST</span>}
                            </div>
                            {!isMe && !isHost && <div style={{ fontSize: 12, color: 'var(--syn-muted)', marginTop: 2 }}>Participant</div>}
                            {isMe && !isHost && <div style={{ fontSize: 12, color: 'var(--syn-cyan)', fontWeight: 600, marginTop: 2 }}>Waiting for host...</div>}
                          </div>
                        </div>

                        <div className="osce-participant__actions" style={{ display: 'flex', alignItems: 'center' }}>
                          {(createdRoom.host_user_id === user?.id || isMe) ? (
                            <div style={{ position: 'relative' }}>
                              <select 
                                value={p.role} 
                                onChange={(e) => handleRoleChange(p.user_id, e.target.value)}
                                className="osce-participant__role-select"
                                style={{ 
                                  appearance: 'none',
                                  background: 'var(--grad-primary)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '10px 36px 10px 16px',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  cursor: 'pointer',
                                  minWidth: 140
                                }}
                              >
                                {ROLES.map(r => {
                                  const isTaken = r.id !== 'observer' && createdRoom.participants.some(participant => participant.role === r.id && participant.user_id !== p.user_id);
                                  return (
                                    <option key={r.id} value={r.id}>
                                      {r.name} {isTaken ? '(Taken)' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                              <LuChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#fff', pointerEvents: 'none' }} />
                            </div>
                          ) : (
                            <span className="osce-participant__role" style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8 }}>{roleInfo.name}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {createdRoom.host_user_id === user?.id ? (
                <button className="osce-btn osce-btn--primary-large" onClick={handleStartSession}>
                  Start Session
                </button>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', background: 'var(--surface-app)', borderRadius: 12, color: 'var(--syn-muted)', fontWeight: 700 }}>
                  Waiting for host to start session...
                </div>
              )}
            </div>
          </div>

          <div className="group-waiting__sidebar">
            <div className="osce-group__sidebar-card">
              <h3 className="osce-group__sidebar-title">Session Details</h3>
              {[
                ['Station', createdRoom.station?.title || 'Unknown'],
                ['Mode', 'Group Practice'],
                ['Your Role', ROLES.find(r => r.id === createdRoom.participants?.find(p => p.user_id === user?.id)?.role)?.name || 'Unknown'],
              ].map(([label, value]) => (
                <div key={label} className="osce-group__summary-item">
                  <span className="osce-group__summary-label">{label}</span>
                  <span className="osce-group__summary-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="osce-group osce-group--full">
      <div className="osce-group__header">
        <button className="osce-station__back" onClick={() => navigate('/dashboard/osce')}>
          <LuChevronLeft size={16} /> Back to OSCE Stations
        </button>
        <h1 className="osce-group__page-title">Group OSCE Session</h1>
        <p className="osce-group__page-subtitle">Practice OSCE stations with friends in real-time</p>
      </div>

      <div className="osce-group__tabs">
        <button className={`osce-group__tab ${tab === 'create' ? 'osce-group__tab--active' : ''}`} onClick={() => { setTab('create'); setError('') }}>Create Session</button>
        <button className={`osce-group__tab ${tab === 'join' ? 'osce-group__tab--active' : ''}`} onClick={() => { setTab('join'); setError('') }}>Join Session</button>
      </div>

      <div className="osce-group__grid">
        <div className="osce-group__main">
          {error && <div className="osce-block--callout" data-variant="danger" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="osce-group__form">
            {tab === 'create' && (
              <>
                <label className="osce-group__label">Select Station</label>
                <div style={{ position: 'relative' }}>
                  <select className="osce-group__input" value={selectedStation} onChange={(e) => setSelectedStation(e.target.value)}>
                    <option value="">Choose a station...</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                  <LuChevronDown size={20} style={{ position: 'absolute', right: 18, top: '26px', transform: 'translateY(-50%)', color: 'var(--syn-muted)', pointerEvents: 'none' }} />
                </div>

                <label className="osce-group__label">Your Role</label>
                <div className="osce-roles">
                  {ROLES.map(role => (
                    <button key={role.id} className={`osce-role ${selectedRole === role.id ? 'osce-role--active' : ''}`} onClick={() => setSelectedRole(role.id)} type="button">
                      <div className="osce-role__name">{role.name}</div>
                      <div className="osce-role__desc">{role.desc}</div>
                    </button>
                  ))}
                </div>

                <button className="osce-btn" onClick={handleCreate} disabled={creating || !selectedStation}>
                  {creating ? 'Creating...' : 'Create Session'}
                </button>
              </>
            )}

            {tab === 'join' && (
              <>
                <label className="osce-group__label">Room Code</label>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <input className="osce-group__input osce-group__input--code" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="ABCD12" maxLength={6} onKeyDown={(e) => e.key === 'Enter' && roomCode.trim() && handleJoin()} autoFocus />
                </div>

                <label className="osce-group__label">Your Role</label>
                <div className="osce-roles">
                  {ROLES.map(role => (
                    <button key={role.id} className={`osce-role ${joinRole === role.id ? 'osce-role--active' : ''}`} onClick={() => setJoinRole(role.id)} type="button">
                      <div className="osce-role__name">{role.name}</div>
                      <div className="osce-role__desc">{role.desc}</div>
                    </button>
                  ))}
                </div>

                <button className="osce-btn osce-btn--primary-large" onClick={handleJoin} disabled={joining || !roomCode.trim()}>
                  {joining ? 'Joining...' : 'Join Session'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sidebar for empty state details */}
        <div className="osce-group__sidebar">
          <div className="osce-group__sidebar-card">
            <h3 className="osce-group__sidebar-title">Session Configuration</h3>
            <div className="osce-group__summary-item">
              <span className="osce-group__summary-label">Mode:</span>
              <span className="osce-group__summary-value">Group Practice</span>
            </div>
            {tab === 'create' ? (
              <div className="osce-group__summary-item">
                <span className="osce-group__summary-label">Station:</span>
                <span className="osce-group__summary-value">{stations.find(s => s.id === selectedStation)?.title || 'Not selected'}</span>
              </div>
            ) : (
              <div className="osce-group__summary-item">
                <span className="osce-group__summary-label">Room Code:</span>
                <span className="osce-group__summary-value">{roomCode || 'Pending'}</span>
              </div>
            )}

            <div className="group-summary-hint">
              <LuUsers size={16} />
              <span>Configure settings, then {tab === 'create' ? 'create' : 'join'} a session to practice together</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

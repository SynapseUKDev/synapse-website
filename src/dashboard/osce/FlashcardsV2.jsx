import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { LuArrowLeft } from 'react-icons/lu'
import TopicPicker from '../flashcards-v2/TopicPicker'
import StudySession from '../flashcards-v2/StudySession'
import { buildDeck } from '../flashcards-v2/buildDeck'
import { getStats, getTopics } from '../flashcards-v2/flashcardsV2Api'
import { isFlashcardsAdmin } from '../flashcards-v2/access'
import { track } from '../../usage/client.js'
import { EVENTS } from '../../usage/catalog.js'
import './Flashcards.css'

// Flashcards V2 — thin container: loads /topics, turns a picker choice into a deck, runs a
// session. This is the normal Flashcards entry; the server decides who may study (backend
// FLASHCARDS_V2_RELEASED — a 403 shows the coming-soon notice). Admins always ask for ?preview=1 so they
// also see drafts, and only they get QA badges.

function useTopics(preview, enabled) {
  const [state, setState] = useState({ status: 'loading', specialties: [], error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    setState({ status: 'loading', specialties: [], error: null })
    getTopics({ preview, signal: controller.signal })
      .then((data) => setState({ status: 'ready', specialties: data?.specialties ?? [], error: null }))
      .catch((error) => {
        if (error?.name === 'AbortError') return
        console.warn('Flashcards V2: loading topics failed', error?.name, error?.kind, error?.message)
        setState({ status: 'error', specialties: [], error })
      })
    return () => controller.abort()
  }, [preview, enabled, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return [state, retry]
}

export default function FlashcardsV2() {
  const navigate = useNavigate()
  const { user } = useOutletContext() ?? {}
  const admin = isFlashcardsAdmin(user)
  const preview = admin

  const [topics, retryTopics] = useTopics(preview, !!user?.id)
  const [dueCount, setDueCount] = useState(null)
  const [session, setSession] = useState(null) // { id, cards }
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)
  const [notice, setNotice] = useState(null)
  const exitGuardRef = useRef(null) // set by StudySession: true = it kept the learner on the unsaved-ratings summary

  const ready = topics.status === 'ready'
  useEffect(() => {
    if (!ready || session) return undefined
    let cancelled = false
    getStats({ preview })
      .then((s) => !cancelled && setDueCount(s?.due_count ?? null))
      .catch(() => !cancelled && setDueCount(null)) // the badge is optional; Due still works without it
    return () => {
      cancelled = true
    }
  }, [ready, preview, session])

  async function start(mode, topicIds) {
    setStarting(true)
    setStartError(null)
    setNotice(null)
    try {
      const { cards, emptyMessage } = await buildDeck(mode, topicIds, { preview })
      if (cards.length) {
        track(EVENTS.FLASHCARDS_SESSION_STARTED, { card_count: cards.length })
        setSession({ id: Date.now(), cards })
      }
      else setNotice(emptyMessage)
    } catch (error) {
      console.warn('Flashcards V2: building the deck failed', error?.name, error?.kind, error?.message)
      setStartError(error)
    } finally {
      setStarting(false)
    }
  }

  const back = (
    <button type="button" className="fc-page__back" onClick={() => {
        if (exitGuardRef.current?.()) return
        navigate('/dashboard/question-bank')
      }}>
      <LuArrowLeft size={18} aria-hidden="true" />
      <span>Question Bank</span>
    </button>
  )

  // The server decides who may study (backend FLASHCARDS_V2_RELEASED). A 403 means V2 is still admin-only,
  // so learners get a friendly notice rather than an error.
  if (topics.status === 'error' && topics.error?.kind === 'forbidden') {
    return (
      <div className="fc-page fc2-page">
        {back}
        <div className="fc-page__card fc2-page-card">
          <header className="fc2-header">
            <h1 className="fc2-header__title">Flashcards</h1>
          </header>
          <div className="fc2-picker__state" role="status">
            <p>Our new flashcards are coming soon. Check back shortly!</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fc-page fc2-page">
      {back}
      <div className="fc-page__card fc2-page-card">
        {session ? (
          <StudySession
            key={session.id}
            cards={session.cards}
            preview={preview}
            showAdminBadge={admin}
            onExit={() => setSession(null)}
            onComplete={() => track(EVENTS.FLASHCARDS_SESSION_COMPLETED, { card_count: session.cards.length })}
            exitGuardRef={exitGuardRef}
          />
        ) : (
          <>
            <header className="fc2-header">
              <h1 className="fc2-header__title">Flashcards</h1>
              {admin && <p className="fc2-header__beta">Admin preview (drafts included)</p>}
            </header>
            <TopicPicker
              topics={topics}
              onRetry={retryTopics}
              showDrafts={admin}
              dueCount={dueCount}
              onStart={start}
              starting={starting}
              startError={startError}
              notice={notice}
            />
          </>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  LuBookOpen,
  LuChartLine,
  LuCheck,
  LuCircleHelp,
  LuCirclePlay,
  LuFlame,
  LuStethoscope,
  LuTarget,
  LuTimer,
  LuTrendingUp,
} from 'react-icons/lu'
import logo from '../assets/logo/logo.png'
import './AuthPreview.css'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LuChartLine },
  { id: 'qbank', label: 'Questions', icon: LuCircleHelp },
  { id: 'textbook', label: 'Textbook', icon: LuBookOpen },
  { id: 'osce', label: 'OSCEs', icon: LuStethoscope },
  { id: 'analytics', label: 'Analytics', icon: LuTrendingUp },
]

const SCREENS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'qbank', label: 'Questions' },
  { id: 'textbook', label: 'Textbook' },
  { id: 'osce', label: 'OSCE' },
]

const INTERVAL_MS = 4200

function DashboardScreen() {
  return (
    <div className="ap-screen ap-screen--dash">
      <div className="ap-kicker">Dashboard</div>
      <h3 className="ap-title">Good evening</h3>
      <div className="ap-stats">
        <article className="ap-stat">
          <div className="ap-stat__top">
            <span>Study streak</span>
            <span className="ap-stat__icon ap-stat__icon--gold"><LuFlame /></span>
          </div>
          <strong>7 days</strong>
          <em>Keep it up</em>
        </article>
        <article className="ap-stat">
          <div className="ap-stat__top">
            <span>Focused study</span>
            <span className="ap-stat__icon ap-stat__icon--timer"><LuTimer /></span>
          </div>
          <strong>42 mins</strong>
          <em>Target 180 mins</em>
        </article>
        <article className="ap-stat">
          <div className="ap-stat__top">
            <span>Questions</span>
            <span className="ap-stat__icon ap-stat__icon--target"><LuTarget /></span>
          </div>
          <strong>18/30</strong>
          <div className="ap-progress"><span style={{ width: '60%' }} /></div>
        </article>
      </div>
      <div className="ap-qa">
        <div className="ap-qa__label">Quick actions</div>
        <div className="ap-qa__row">
          <span className="ap-qa__icon ap-qa__icon--gold"><LuCirclePlay /></span>
          <div>
            <b>Continue questions</b>
            <small>Resume Cardiology set</small>
          </div>
        </div>
        <div className="ap-qa__row">
          <span className="ap-qa__icon ap-qa__icon--cyan"><LuBookOpen /></span>
          <div>
            <b>Continue reading</b>
            <small>Acute coronary syndrome</small>
          </div>
        </div>
      </div>
    </div>
  )
}

function QbankScreen() {
  return (
    <div className="ap-screen ap-screen--qbank">
      <div className="ap-qbank__bar">
        <span className="ap-chip">Cardiology</span>
        <span className="ap-qbank__count">SBA 4 of 20</span>
        <span className="ap-qbank__time"><LuTimer /> 01:12</span>
      </div>
      <p className="ap-stem">
        A 67-year-old man presents with sudden-onset central chest pain radiating to the left arm.
        ECG shows ST elevation in leads II, III and aVF. Which is the most likely diagnosis?
      </p>
      <div className="ap-opts">
        <div className="ap-opt">
          <span>A</span> Pericarditis
        </div>
        <div className="ap-opt is-correct">
          <span>B</span> Acute coronary syndrome
          <LuCheck />
        </div>
        <div className="ap-opt">
          <span>C</span> Aortic dissection
        </div>
        <div className="ap-opt">
          <span>D</span> Oesophageal spasm
        </div>
      </div>
    </div>
  )
}

function TextbookScreen() {
  return (
    <div className="ap-screen ap-screen--tb">
      <span className="ap-chip ap-chip--gold">Acute Medicine</span>
      <h3 className="ap-title">Acute coronary syndrome</h3>
      <div className="ap-tabs">
        <b className="is-active">Presentation</b>
        <b>Diagnosis</b>
        <b>Management</b>
      </div>
      <div className="ap-tb-block">
        <div className="ap-tb-h">Clinical features</div>
        <div className="ap-tb-row"><span>Chest pain</span><span>Sudden, central, radiating to arm or jaw</span></div>
        <div className="ap-tb-row"><span>Associated</span><span>Sweating, nausea, dyspnoea</span></div>
        <div className="ap-tb-row"><span>ECG</span><span>ST elevation in a territorial distribution</span></div>
      </div>
    </div>
  )
}

function OsceScreen() {
  return (
    <div className="ap-screen ap-screen--osce">
      <div className="ap-osce__head">
        <div>
          <span className="ap-chip ap-chip--purple">History</span>
          <h3 className="ap-title">Chest pain</h3>
        </div>
        <span className="ap-osce__time"><LuTimer /> 8 min</span>
      </div>
      <ul className="ap-osce__list">
        <li className="is-done"><LuCheck /> Opening &amp; consent</li>
        <li className="is-done"><LuCheck /> History of presenting complaint</li>
        <li>ICE and explanation</li>
        <li>Close &amp; summarise</li>
      </ul>
    </div>
  )
}

const SCREEN_MAP = {
  dashboard: DashboardScreen,
  qbank: QbankScreen,
  textbook: TextbookScreen,
  osce: OsceScreen,
}

export default function AuthPreview() {
  const reduce = useReducedMotion()
  const [active, setActive] = useState('dashboard')
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduce || paused) return undefined
    const id = window.setInterval(() => {
      setActive((prev) => {
        const i = SCREENS.findIndex((s) => s.id === prev)
        return SCREENS[(i + 1) % SCREENS.length].id
      })
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [reduce, paused])

  const Screen = SCREEN_MAP[active]

  return (
    <div
      className="auth-preview"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="auth-preview__window">
        <div className="auth-preview__chrome">
          <span /><span /><span />
          <em>EduSynapse</em>
        </div>
        <div className="auth-preview__app">
          <aside className="auth-preview__sidebar">
            <div className="auth-preview__brand">
              <img src={logo} alt="" />
            </div>
            <nav>
              {NAV.map((item) => {
                const Icon = item.icon
                const isActive = item.id === active
                const canOpen = Boolean(SCREEN_MAP[item.id])
                return (
                  <div
                    key={item.id}
                    className={`auth-preview__nav ${isActive ? 'is-active' : ''}`}
                    style={canOpen ? { cursor: 'pointer' } : undefined}
                    onClick={canOpen ? () => setActive(item.id) : undefined}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </nav>
          </aside>
          <div className="auth-preview__main">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <Screen />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="auth-preview__dots" role="tablist" aria-label="Platform preview">
        {SCREENS.map((screen) => (
          <button
            key={screen.id}
            type="button"
            role="tab"
            aria-selected={active === screen.id}
            className={active === screen.id ? 'is-active' : ''}
            onClick={() => setActive(screen.id)}
          >
            {screen.label}
          </button>
        ))}
      </div>
    </div>
  )
}

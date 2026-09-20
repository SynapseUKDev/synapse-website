import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  LuBookOpen,
  LuChartLine,
  LuCircleHelp,
  LuCirclePlay,
  LuFlag,
  LuFlame,
  LuLogOut,
  LuMenu,
  LuMinus,
  LuPencil,
  LuPlay,
  LuPlus,
  LuSettings,
  LuSlash,
  LuStethoscope,
  LuTarget,
  LuTimer,
  LuTrophy,
  LuTrendingUp,
  LuUserPlus,
  LuX,
} from 'react-icons/lu'
import logo from '../assets/logo/logo.png'
import './AuthPreview.css'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LuChartLine },
  { id: 'qbank', label: 'Question Bank', icon: LuCircleHelp },
  { id: 'textbook', label: 'UKMLA Textbook', icon: LuBookOpen },
  { id: 'osce', label: 'OSCEs', icon: LuStethoscope },
  { id: 'mock-exams', label: 'Mock Exams', icon: LuTimer },
  { id: 'analytics', label: 'Analytics', icon: LuTrendingUp },
]

const SCREENS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'qbank', label: 'Question Bank' },
  { id: 'textbook', label: 'Textbook' },
  { id: 'osce', label: 'OSCE' },
]

const INTERVAL_MS = 5200

const SCREEN_URLS = {
  dashboard: 'edusynapseuk.org/dashboard',
  qbank: 'edusynapseuk.org/dashboard/question-bank/practice',
  textbook: 'edusynapseuk.org/dashboard/textbook/topic/anaphylaxis',
  osce: 'edusynapseuk.org/dashboard/osce/station/cardiovascular-history-01/practice',
}
const Q_GRID = [
  'correct', 'correct', 'correct', 'correct', 'wrong',
  'correct', 'correct', 'correct', 'correct', 'correct',
  'correct', 'wrong', 'correct', 'correct', 'correct',
  'correct', 'correct', 'current', 'open', 'open',
  'open', 'open', 'open', 'open', 'open',
]
const TB_SECTIONS = [
  'Overview',
  'Pathophysiology',
  'Epidemiology & Risk Factors',
  'Clinical Features',
  'Investigations',
  'Management',
  'Complications',
  'References',
]

const LB_ROWS = [
  { name: 'Student 3273', detail: '946 questions · 90% accuracy', score: '946', label: 'total' },
  { name: 'Student 7875', detail: '643 questions · 85% accuracy', score: '643', label: 'total' },
  { name: 'Student 2347', detail: '565 questions · 78% accuracy', score: '565', label: 'total' },
]

const AN_BARS = [
  { day: 'Tue 2', h: 12 },
  { day: 'Wed 3', h: 16 },
  { day: 'Thu 4', h: 18 },
  { day: 'Fri 5', h: 22 },
  { day: 'Sat 6', h: 20 },
  { day: 'Sun 7', h: 24 },
  { day: 'Sat 19', h: 88, active: true },
]

function DashboardScreen() {
  return (
    <div className="ap-page ap-page--dash">
      <h3 className="ap-page__title">Dashboard</h3>
      <p className="ap-page__sub">19 September 2026</p>
      <div className="ap-stats">
        <article className="ap-stat">
          <div className="ap-stat__top">
            <span>Study Streak</span>
            <span className="ap-stat__icon ap-stat__icon--gold"><LuFlame /></span>
          </div>
          <strong>7 days</strong>
          <em>Keep it up!</em>
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
            <span>Questions Completed</span>
            <span className="ap-stat__icon ap-stat__icon--target"><LuTarget /></span>
          </div>
          <strong>18/30</strong>
          <div className="ap-progress"><span style={{ width: '60%' }} /></div>
        </article>
      </div>

      <div className="ap-dash-split">
        <div className="ap-dash-col">
          <div className="ap-qa">
            <div className="ap-qa__label">Quick Actions</div>
            <p className="ap-qa__hint">Jump back into your learning journey</p>
            <div className="ap-qa__row">
              <span className="ap-qa__icon ap-qa__icon--gold"><LuCirclePlay /></span>
              <div>
                <b>Continue Questions</b>
                <small>Resume Cardiology set</small>
              </div>
              <span className="ap-qa__chevron">›</span>
            </div>
            <div className="ap-qa__row">
              <span className="ap-qa__icon ap-qa__icon--cyan"><LuBookOpen /></span>
              <div>
                <b>Continue Reading</b>
                <small>Anaphylaxis</small>
              </div>
              <span className="ap-qa__chevron">›</span>
            </div>
          </div>

          <div className="ap-lb">
            <div className="ap-lb__title"><LuTrophy /> Leaderboard</div>
            <div className="ap-select">All Specialties</div>
            <div className="ap-select">Global (Anonymous)</div>
            <div className="ap-select">Sort by Total Answered</div>
            {LB_ROWS.map((row) => (
              <div key={row.name} className="ap-lb__row">
                <div>
                  <b>{row.name}</b>
                  <small>{row.detail}</small>
                </div>
                <div className="ap-lb__score">
                  <strong>{row.score}</strong>
                  <em>{row.label}</em>
                </div>
              </div>
            ))}
            <div className="ap-more">See more (79)</div>
          </div>
        </div>

        <div className="ap-dash-col">
          <div className="ap-an">
            <div className="ap-an__head">Analytics</div>
            <div className="ap-tabs">
              <span className="is-active">Questions</span>
              <span>Accuracy</span>
              <span>Time</span>
            </div>
            <div className="ap-bars" aria-hidden>
              {AN_BARS.map((bar) => (
                <div key={bar.day} className="ap-bars__col">
                  <i className={bar.active ? 'is-active' : ''} style={{ height: `${bar.h}%` }} />
                  <em>{bar.day}</em>
                </div>
              ))}
            </div>
            <p className="ap-an__copy">
              Questions answered each day this week. Aim for consistent daily practice to build long-term retention.
            </p>
            <span className="ap-an__link">View analytics →</span>
          </div>

          <div className="ap-fr">
            <div className="ap-fr__title"><LuUserPlus /> Friends</div>
            <div className="ap-tabs">
              <span className="is-active">Friends</span>
              <span>Requests</span>
            </div>
            <p className="ap-fr__desc">
              Add friends by email to see them on the leaderboard and compete together.
            </p>
            <div className="ap-fr__row">
              <span className="ap-fr__input">Friend's email</span>
              <span className="ap-fr__add">Add</span>
            </div>
            <p className="ap-empty">No friends yet. Add someone by email above.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function QbankScreen() {
  return (
    <div className="ap-page ap-page--qbank">
      <header className="ap-page__head">
        <div>
          <h3>Question Bank</h3>
          <p>Question 18 of 25</p>
        </div>
        <span className="ap-exit"><LuX /> Exit</span>
      </header>
      <div className="ap-page__cols">
        <div className="ap-card ap-card--q">
          <p className="ap-stem">
            A 67-year-old woman on a medical ward develops new bruising and gum bleeding 7 days after
            starting heparin for VTE prophylaxis. She had a hip fracture repair 10 days ago.
            She denies black stools or haematemesis. No fever. No new rash.
          </p>
          <p className="ap-stem-kicker">Bloods</p>
          <table className="ap-labs">
            <thead>
              <tr>
                <th>Test</th>
                <th>Result</th>
                <th>Reference range</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Platelets</td>
                <td>58 ×10⁹/L</td>
                <td>150–400</td>
              </tr>
              <tr>
                <td>Hb</td>
                <td>118 g/L</td>
                <td>115–160</td>
              </tr>
              <tr>
                <td>APTT</td>
                <td>31 s</td>
                <td>25–35</td>
              </tr>
            </tbody>
          </table>
          <p className="ap-q">What is the single best next step?</p>
          <div className="ap-opts">
            {[
              ['A', 'Give vitamin K'],
              ['B', 'Stop heparin'],
              ['C', 'Give platelet transfusion'],
              ['D', 'Start warfarin'],
              ['E', 'Continue heparin'],
            ].map(([letter, text]) => (
              <div key={letter} className={`ap-opt ${letter === 'B' ? 'is-selected' : ''}`}>
                <span className="ap-opt__radio" />
                <b>{letter}.</b>
                <span className="ap-opt__text">{text}</span>
                <LuSlash />
              </div>
            ))}
          </div>
          <div className="ap-q-foot">
            <div className="ap-q-foot__left">
              <span><LuFlag /> Flag</span>
              <span><LuPencil /> Edit</span>
              <span>Report</span>
            </div>
            <div className="ap-q-foot__right">
              <span>Previous</span>
              <span className="is-primary">Submit</span>
              <span>Skip</span>
            </div>
          </div>
        </div>
        <aside className="ap-rail ap-rail--qbank">
          <div className="ap-trk">
            <div className="ap-trk-stats">
              <div>
                <strong>17/25</strong>
                <em>Completed</em>
              </div>
              <div>
                <strong className="is-green">88%</strong>
                <em>Accuracy</em>
              </div>
              <div>
                <strong className="is-blue">41s</strong>
                <em>Avg Time</em>
              </div>
            </div>
            <div className="ap-trk-bar"><span style={{ width: '68%' }} /></div>
            <div className="ap-trk-jump">
              <span className="ap-trk-select">Q 1–25</span>
              <span className="ap-trk-hash">#</span>
              <span className="ap-trk-go">Go</span>
            </div>
            <div className="ap-trk-chips">
              {['All', 'Unanswered', 'Correct', 'Wrong', 'Flagged'].map((chip, i) => (
                <span key={chip} className={i === 0 ? 'is-active' : ''}>{chip}</span>
              ))}
            </div>
            <div className="ap-trk-grid">
              {Q_GRID.map((status, i) => (
                <i key={i} className={status === 'open' ? '' : `is-${status}`} />
              ))}
            </div>
            <div className="ap-trk-legend">
              <span><i className="swatch-correct" /> Correct</span>
              <span><i className="swatch-wrong" /> Wrong</span>
              <span><i className="swatch-open" /> Unanswered</span>
              <span><i className="swatch-current" /> Current</span>
              <span><i className="swatch-flag" /> Flagged</span>
            </div>
          </div>
          <div className="ap-rail-card ap-rail-card--ref">
            <span>Reference Ranges</span>
            <b>Show</b>
          </div>
        </aside>
      </div>
    </div>
  )
}

function TextbookScreen() {
  return (
    <div className="ap-page ap-page--tb">
      <p className="ap-crumb">UKMLA Textbook <span>/</span> Acute &amp; Emergency <span>/</span> Anaphylaxis</p>
      <h3 className="ap-page__title">Anaphylaxis</h3>
      <p className="ap-lede">
        Anaphylaxis is a severe, life-threatening, systemic hypersensitivity reaction, usually rapid in
        onset, characterised by airway, breathing and/or circulatory compromise.
      </p>
      <div className="ap-tb-tools">
        <span className="ap-search">Search within this chapter</span>
        <span>Edit</span>
        <span>Hide highlights</span>
        <span>Report</span>
      </div>
      <div className="ap-page__cols">
        <div className="ap-tb-stack">
          <section className="ap-card">
            <h4>Overview</h4>
            <p>
              Anaphylaxis is a severe life-threatening systemic hypersensitivity reaction with rapid onset.
              It is typically mediated by IgE, but can occur via non-IgE pathways. Immediate intramuscular
              adrenaline is the first-line treatment.
            </p>
          </section>
          <section className="ap-card">
            <h4>Pathophysiology</h4>
            <ul>
              <li><b>IgE-mediated (classic):</b> re-exposure to allergen → mast cell/basophil degranulation.</li>
              <li><b>Non-IgE mechanisms:</b> direct mast-cell activating drugs, radiocontrast, opioids.</li>
            </ul>
          </section>
          <section className="ap-card ap-card--table">
            <h4>Clinical Features</h4>
            <table className="ap-feature">
              <thead>
                <tr>
                  <th>System</th>
                  <th>Typical findings</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Airway</td>
                  <td>Stridor, hoarseness, throat tightness, tongue/lip/uvular swelling</td>
                </tr>
                <tr>
                  <td>Breathing</td>
                  <td>Wheeze/bronchospasm, tachypnoea, hypoxia, chest tightness</td>
                </tr>
                <tr>
                  <td>Circulation</td>
                  <td>Hypotension, tachycardia, collapse, weak/absent pulse</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
        <aside className="ap-rail">
          <div className="ap-rail-card">
            <div className="ap-rail-label">Chapter Sections</div>
            <ul className="ap-toc">
              {TB_SECTIONS.map((item, i) => (
                <li key={item} className={i === 0 ? 'is-active' : ''}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="ap-rail-card">
            <div className="ap-rail-label">Reading status</div>
            <div className="ap-status">
              <span>Not read</span>
              <span className="is-active">Reading</span>
              <span>Read</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function OsceScreen() {
  return (
    <div className="ap-page ap-page--osce">
      <p className="ap-back">‹ Back to Station Options</p>
      <div className="ap-osce-title">
        <h3>Cardiovascular history 01</h3>
        <div className="ap-tags">
          <span>History Taking</span>
          <span>Medium</span>
        </div>
      </div>
      <div className="ap-page__cols">
        <div className="ap-osce-stack">
          <section className="ap-card">
            <h4>Patient Script</h4>
            <div className="ap-script">
              <h5>Opening Statement</h5>
              <p>
                I’ve been getting more and more out of breath over the last couple of months.
                I thought it was just because I’m getting older, but it’s starting to affect what I can do.
              </p>
              <dl>
                <div><dt>Name:</dt><dd>Mr John Harris</dd></div>
                <div><dt>Age:</dt><dd>72 years old</dd></div>
                <div><dt>Site:</dt><dd>Chest</dd></div>
                <div><dt>Onset:</dt><dd>Gradual over the past 2 months</dd></div>
              </dl>
              <h5>ICE</h5>
              <ul>
                <li><b>Ideas:</b> “I wondered if my previous heart attack has damaged my heart.”</li>
                <li><b>Concerns:</b> “I’m worried my breathing is getting worse and I might lose my independence.”</li>
              </ul>
            </div>
          </section>
          <section className="ap-card ap-card--must">
            <h4>Candidate must identify</h4>
            <ul>
              <li>Progressive exertional breathlessness</li>
              <li>Orthopnoea</li>
              <li>Paroxysmal nocturnal dyspnoea</li>
              <li>Bilateral peripheral oedema</li>
            </ul>
          </section>
        </div>
        <aside className="ap-rail">
          <div className="ap-timer">
            <div className="ap-timer__time">8:00</div>
            <div className="ap-timer__row">
              <span><LuMinus /></span>
              <span className="is-play"><LuPlay /></span>
              <span><LuPlus /></span>
            </div>
          </div>
          <div className="ap-fail">
            <h5>Automatic Fail Criteria</h5>
            <ul>
              <li>Fails to identify orthopnoea or paroxysmal nocturnal dyspnoea</li>
              <li>Does not explore major cardiovascular red flag symptoms</li>
              <li>Omits significant cardiovascular history or medication history</li>
            </ul>
          </div>
          <div className="ap-rail-card ap-dx">
            <span>Final Diagnosis</span>
            <b>Reveal</b>
          </div>
        </aside>
      </div>
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
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(active === 'qbank')
  }, [active])

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
          <em>{SCREEN_URLS[active]}</em>
        </div>
        <div className={`auth-preview__app ${collapsed ? 'is-collapsed' : ''}`}>
          <aside className="auth-preview__sidebar">
            <div className="auth-preview__brand">
              <img src={logo} alt="" />
              <button
                type="button"
                className="auth-preview__burger"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setCollapsed((v) => !v)}
              >
                <LuMenu />
              </button>
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
                    title={item.label}
                    style={canOpen ? { cursor: 'pointer' } : undefined}
                    onClick={canOpen ? () => setActive(item.id) : undefined}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </nav>
            <div className="auth-preview__user">
              <div className="auth-preview__avatar">A</div>
              <div className="auth-preview__who">
                <b>Alex Chen</b>
                <small>alex@edusynapse.com</small>
              </div>
              <div className="auth-preview__user-btns">
                <LuSettings />
                <LuLogOut />
              </div>
            </div>
          </aside>
          <div className="auth-preview__main">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="auth-preview__screen"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -6 }}
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

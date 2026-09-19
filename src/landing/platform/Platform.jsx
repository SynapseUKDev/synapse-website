import React from 'react'
import {
  LuBookOpen,
  LuCircleHelp,
  LuMic,
  LuMinus,
  LuPlay,
  LuPlus,
  LuSlash,
} from 'react-icons/lu'
import { Reveal } from '../Reveal.jsx'
import './Platform.css'

const Q_GRID = Array.from({ length: 25 }, (_, i) => i + 1)
const TB_SECTIONS = [
  'Overview',
  'Pathophysiology',
  'Epidemiology & Risk Factors',
  'Clinical Features',
  'Investigations',
  'Management',
  'Complications',
]

function QbankPreview() {
  return (
    <div className="plat-preview plat-preview--qbank">
      <div className="plat-preview__chrome">
        <span /><span /><span />
        <em>Question Bank</em>
      </div>
      <div className="plat-shot">
        <div className="plat-card plat-card--q">
          <p className="plat-stem">
            A 67-year-old woman develops new bruising and gum bleeding 7 days after starting heparin.
          </p>
          <p className="plat-kicker">Bloods</p>
          <table className="plat-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Result</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Platelets</td>
                <td>58 ×10⁹/L</td>
                <td>150–400</td>
              </tr>
            </tbody>
          </table>
          <p className="plat-kicker">What is the single best next step?</p>
          {[
            ['A', 'Give vitamin K'],
            ['B', 'Stop heparin'],
            ['C', 'Give platelet transfusion'],
            ['D', 'Start warfarin'],
            ['E', 'Continue heparin'],
          ].map(([letter, text]) => (
            <div key={letter} className="plat-choice">
              <i />
              <b>{letter}.</b>
              <span>{text}</span>
              <LuSlash />
            </div>
          ))}
        </div>
        <aside className="plat-rail">
          <div className="plat-rail__card">
            <div className="plat-stats">
              <div><strong>0/25</strong><em>Done</em></div>
              <div><strong>0%</strong><em>Acc.</em></div>
            </div>
            <div className="plat-trk">
              {Q_GRID.map((n) => (
                <i key={n} className={n === 1 ? 'is-current' : ''}>{n}</i>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function TextbookPreview() {
  return (
    <div className="plat-preview plat-preview--textbook">
      <div className="plat-preview__chrome">
        <span /><span /><span />
        <em>UKMLA Textbook</em>
      </div>
      <div className="plat-shot plat-shot--wash">
        <div className="plat-stack">
          <p className="plat-crumb">UKMLA Textbook <span>/</span> Acute &amp; Emergency <span>/</span> Anaphylaxis</p>
          <h4 className="plat-app__title">Anaphylaxis</h4>
          <section className="plat-card">
            <h5>Overview</h5>
            <p>
              Anaphylaxis is a severe life-threatening systemic hypersensitivity reaction with rapid onset.
              Immediate intramuscular adrenaline is the first-line treatment.
            </p>
          </section>
          <section className="plat-card">
            <h5>Pathophysiology</h5>
            <ul>
              <li><b>IgE-mediated:</b> re-exposure to allergen → mast cell degranulation.</li>
              <li><b>Non-IgE mechanisms:</b> direct mast-cell activating drugs, radiocontrast.</li>
            </ul>
          </section>
          <section className="plat-card">
            <h5>Clinical Features</h5>
            <table className="plat-table">
              <tbody>
                <tr>
                  <td>Airway</td>
                  <td>Stridor, hoarseness, throat tightness</td>
                </tr>
                <tr>
                  <td>Breathing</td>
                  <td>Wheeze, tachypnoea, hypoxia</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
        <aside className="plat-rail">
          <div className="plat-rail__card">
            <div className="plat-rail__label">Chapter Sections</div>
            <ul className="plat-toc">
              {TB_SECTIONS.map((item, i) => (
                <li key={item} className={i === 0 ? 'is-active' : ''}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="plat-rail__card">
            <div className="plat-rail__label">Reading status</div>
            <div className="plat-status">
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

function OscePreview() {
  return (
    <div className="plat-preview plat-preview--osce">
      <div className="plat-preview__chrome">
        <span /><span /><span />
        <em>OSCE Station</em>
      </div>
      <div className="plat-shot plat-shot--wash">
        <div className="plat-stack">
          <p className="plat-back">‹ Back to Station Options</p>
          <div className="plat-osce-title">
            <h4>Cardiovascular history 01</h4>
            <div className="plat-tags">
              <span>History Taking</span>
              <span>Medium</span>
            </div>
          </div>
          <section className="plat-card">
            <h5>Patient Script</h5>
            <p className="plat-script">
              I’ve been getting more and more out of breath over the last couple of months.
              I thought it was just because I’m getting older, but it’s starting to affect what I can do.
            </p>
            <dl className="plat-meta">
              <div><dt>Name</dt><dd>Mr John Harris</dd></div>
              <div><dt>Age</dt><dd>72 years old</dd></div>
              <div><dt>Site</dt><dd>Chest</dd></div>
              <div><dt>Onset</dt><dd>Gradual over the past 2 months</dd></div>
            </dl>
          </section>
          <section className="plat-card">
            <h5>Candidate must identify</h5>
            <ul>
              <li>Progressive exertional breathlessness</li>
              <li>Orthopnoea</li>
              <li>Paroxysmal nocturnal dyspnoea</li>
            </ul>
          </section>
        </div>
        <aside className="plat-rail">
          <div className="plat-timer">
            <strong>8:00</strong>
            <div className="plat-timer__row">
              <span><LuMinus /></span>
              <span className="is-play"><LuPlay /></span>
              <span><LuPlus /></span>
            </div>
          </div>
          <div className="plat-fail">
            <h5>Automatic Fail Criteria</h5>
            <p>Fails to identify orthopnoea or paroxysmal nocturnal dyspnoea</p>
            <p>Does not explore major cardiovascular red flag symptoms</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

const CARDS = [
  {
    id: 'qbank',
    icon: LuCircleHelp,
    title: 'Question Bank',
    body: 'Build exam confidence with clinically realistic UKMLA-style questions, detailed explanations and smart performance tracking.',
    preview: <QbankPreview />,
  },
  {
    id: 'textbook',
    icon: LuBookOpen,
    title: 'UKMLA Textbook',
    body: 'High-yield, structured clinical content built around the UKMLA curriculum and designed for rapid, active revision.',
    preview: <TextbookPreview />,
  },
  {
    id: 'osce',
    icon: LuMic,
    title: 'OSCE',
    body: 'Practise clinical encounters with structured stations, checklists and focused preparation for real-world communication and examination skills.',
    preview: <OscePreview />,
  },
]

export default function Platform() {
  return (
    <section className="platform" id="platform">
      <div className="lp-wrap">
        <Reveal className="platform__intro" id="about">
          <p className="lp-eyebrow">The EduSynapse platform</p>
          <h2 className="lp-title">Everything you need to learn, practise and perform.</h2>
          <p className="lp-lead">
            Move seamlessly between learning core content, testing yourself with clinically focused
            questions and practising the skills you need on placement and in exams.
          </p>
        </Reveal>

        <div className="platform__grid">
          {CARDS.map((card, i) => {
            const Icon = card.icon
            return (
              <Reveal key={card.id} delay={i * 0.08}>
                <article className="platform__card">
                  <div className="platform__card-head">
                    <span className={`platform__icon platform__icon--${card.id}`}><Icon /></span>
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  {card.preview}
                </article>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

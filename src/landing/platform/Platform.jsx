import React from 'react'
import { LuArrowRight, LuCircleHelp, LuBookOpen, LuMic, LuCheck, LuTimer } from 'react-icons/lu'
import { Reveal } from '../Reveal.jsx'
import './Platform.css'

const CARDS = [
  {
    id: 'qbank',
    icon: LuCircleHelp,
    title: 'Question Bank',
    body: 'Build exam confidence with clinically realistic UKMLA-style questions, detailed explanations and smart performance tracking.',
    preview: (
      <div className="plat-preview plat-preview--qbank">
        <div className="plat-preview__bar" />
        <div className="plat-preview__body">
          <span className="plat-preview__chip">Cardiology</span>
          <p className="plat-stem">A 67-year-old man presents with sudden-onset central chest pain radiating to the left arm.</p>
          <div className="plat-opt">
            <span className="plat-opt__key">A</span>
            <span>Pericarditis</span>
          </div>
          <div className="plat-opt is-correct">
            <span className="plat-opt__key">B</span>
            <span>Acute coronary syndrome</span>
          </div>
          <div className="plat-opt">
            <span className="plat-opt__key">C</span>
            <span>Aortic dissection</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'textbook',
    icon: LuBookOpen,
    title: 'UKMLA Textbook',
    body: 'High-yield, structured clinical content built around the UKMLA curriculum and designed for rapid, active revision.',
    preview: (
      <div className="plat-preview plat-preview--textbook">
        <div className="plat-preview__bar" />
        <div className="plat-preview__body">
          <span className="plat-preview__chip is-gold">Acute Medicine</span>
          <div className="plat-topic is-done">
            <span className="plat-topic__check"><LuCheck /></span>
            <span>Acute coronary syndrome</span>
          </div>
          <div className="plat-topic">
            <span className="plat-topic__check" />
            <span>Sepsis</span>
          </div>
          <div className="plat-topic">
            <span className="plat-topic__check" />
            <span>Anaphylaxis</span>
          </div>
          <div className="plat-tabs">
            <b className="is-active">Presentation</b>
            <b>Diagnosis</b>
            <b>Management</b>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'osce',
    icon: LuMic,
    title: 'OSCE',
    body: 'Practise clinical encounters with structured stations, checklists and focused preparation for real-world communication and examination skills.',
    preview: (
      <div className="plat-preview plat-preview--osce">
        <div className="plat-preview__bar" />
        <div className="plat-preview__body">
          <div className="plat-osce-head">
            <strong>Chest pain</strong>
            <span className="plat-osce-time"><LuTimer /> 8 min</span>
          </div>
          <div className="plat-osce-tags">
            <span>💬 History</span>
            <span>Cardiology</span>
          </div>
          <ul className="plat-osce-list">
            <li className="is-done"><LuCheck /> Opening & consent</li>
            <li>History of presenting complaint</li>
            <li>ICE and explanation</li>
            <li>Close & summarise</li>
          </ul>
        </div>
      </div>
    ),
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

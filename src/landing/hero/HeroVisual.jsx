import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { floatAnim } from '../motion.js'
import studentsIllustration from '../../assets/landing/students.svg'

export default function HeroVisual() {
  const reduce = useReducedMotion()
  const float = (delay, distance) => (reduce ? undefined : floatAnim(delay, distance))

  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-visual__glow" />
      <div className="hero-visual__stage">
        <motion.article className="float-card float-card--qbank" animate={float(0.1, 12)}>
          <div className="float-card__label">Question Bank</div>
          <div className="float-card__sub">Clinical SBA practice</div>
          <div className="float-card__bars">
            <span />
            <span />
            <span className="is-green" />
          </div>
        </motion.article>

        <motion.article className="float-card float-card--textbook" animate={float(0.6, 9)}>
          <div className="float-card__kicker">UKMLA TEXTBOOK</div>
          <div className="float-card__title">Acute Medicine</div>
        </motion.article>

        <div className="hero-visual__person">
          <img src={studentsIllustration} alt="" className="hero-student" />
        </div>

        <motion.article className="float-card float-card--perf" animate={float(0.3, 11)}>
          <div className="float-card__label">Performance</div>
          <div className="float-card__sub">Strengths & weak areas</div>
          <div className="float-card__chart">
            <span style={{ height: '42%' }} />
            <span style={{ height: '70%' }} />
            <span style={{ height: '54%' }} />
            <span style={{ height: '88%' }} />
          </div>
        </motion.article>

        <motion.article className="float-card float-card--osce" animate={float(0.8, 8)}>
          <div className="float-card__kicker">OSCE</div>
          <div className="float-card__title">Clinical practice</div>
          <ul className="float-card__list">
            <li>Opening & consent</li>
            <li>Clinical assessment</li>
            <li>Close & summarise</li>
          </ul>
        </motion.article>
      </div>
    </div>
  )
}

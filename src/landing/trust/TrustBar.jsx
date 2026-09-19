import React from 'react'
import { FaBookMedical, FaCertificate, FaUserDoctor, FaGraduationCap } from 'react-icons/fa6'
import { Reveal } from '../Reveal.jsx'
import './TrustBar.css'

const ITEMS = [
  { icon: FaBookMedical, label: '15,000+ UKMLA questions', tone: 'blue' },
  { icon: FaCertificate, label: 'UKMLA-aligned', tone: 'gold' },
  { icon: FaUserDoctor, label: 'Clinically reviewed', tone: 'green' },
  { icon: FaGraduationCap, label: 'Built for UK medical students', tone: 'purple' },
]

export default function TrustBar() {
  return (
    <section className="trust" aria-label="Platform highlights">
      <Reveal className="trust__inner">
        {ITEMS.map(({ icon: Icon, label, tone }) => (
          <div className="trust__item" key={label}>
            <span className={`trust__icon trust__icon--${tone}`} aria-hidden>
              <Icon />
            </span>
            <span className="trust__label">{label}</span>
          </div>
        ))}
      </Reveal>
    </section>
  )
}

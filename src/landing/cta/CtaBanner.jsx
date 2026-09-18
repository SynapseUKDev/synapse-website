import React from 'react'
import { Link } from 'react-router-dom'
import { LuArrowRight } from 'react-icons/lu'
import { Reveal } from '../Reveal.jsx'
import './CtaBanner.css'

export default function CtaBanner() {
  return (
    <section className="cta">
      <Reveal className="lp-wrap">
        <div className="cta__panel">
          <div>
            <h2>Your medical education, all in one place.</h2>
            <p>Build knowledge, practise clinically and prepare for the UKMLA with confidence.</p>
          </div>
          <Link to="/login?mode=signup" className="lp-btn lp-btn--light">
            Start Learning
            <LuArrowRight />
          </Link>
        </div>
      </Reveal>
    </section>
  )
}

import React from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { LuArrowRight } from 'react-icons/lu'
import './Hero.css'
import HeroVisual from './HeroVisual.jsx'
import { easeOut } from '../motion.js'

function Hero() {
  const reduce = useReducedMotion()

  return (
    <section className="hero" id="top">
      <div className="hero__container">
        <motion.div
          className="hero__left"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut }}
        >
          <div className="hero__badge">
            <span className="hero__badge-dot" />
            UKMLA-aligned medical learning
          </div>
          <h1 className="hero__title">
            One platform to <span className="hero__title-accent">learn medicine</span>, think
            clinically and prepare for the UKMLA.
          </h1>
          <p className="hero__subtitle">
            Bring your textbook, question bank and OSCE preparation together in
            one intelligent learning platform built for UK medical students.
          </p>
          <div className="hero__actions">
            <Link to="/login?mode=signup" className="lp-btn lp-btn--primary">
              Start Learning
              <LuArrowRight />
            </Link>
            <a href="#platform" className="lp-btn lp-btn--ghost">
              Explore the Platform
            </a>
          </div>
          <p className="hero__fine">Free plan available · No card required</p>
        </motion.div>

        <motion.div
          className="hero__right"
          initial={reduce ? false : { opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: easeOut }}
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  )
}

export default Hero

import React from 'react'
import './Hero.css'
import doctorIllustration from '../../assets/landing/hero-doctor.svg'
import demoImage from '../../assets/landing/hero-demo.png'

function Hero() {
  return (
    <section className="hero">
      <div className="hero__bg" aria-hidden="true">
        <svg className="hero__wave hero__wave--1" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#7BD0F1" d="M0,64L80,85.3C160,107,320,149,480,144C640,139,800,85,960,80C1120,75,1280,117,1360,138.7L1440,160L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z" />
        </svg>
        <svg className="hero__wave hero__wave--2" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#58BFE7" d="M0,224L60,208C120,192,240,160,360,165.3C480,171,600,213,720,224C840,235,960,213,1080,176C1200,139,1320,85,1380,58.7L1440,32L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z" />
        </svg>
        <svg className="hero__wave hero__wave--3" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#3CA2CA" d="M0,288L60,272C120,256,240,224,360,218.7C480,213,600,235,720,234.7C840,235,960,213,1080,208C1200,203,1320,213,1380,218.7L1440,224L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z" />
        </svg>
      </div>

      <div className="hero__container">
        <div className="hero__left">
          <div className="hero__badge">
            <span className="hero__badge-icon" aria-hidden>🎖️</span>
            UKMLA Aligned
          </div>
          <h1 className="hero__title">
            Master Your
            <br />
            <span className="hero__title-accent">Medical Future</span>
          </h1>
          <p className="hero__subtitle">
            The integrated learning platform built specifically for UK medical students. Combine
            interactive textbooks with intelligent question banks to excel in your clinical years.
          </p>
          <div className="hero__actions">
            <a href="#start" className="hero__cta-primary">
              <span>Start Learning</span>
              <span className="hero__cta-arrow" aria-hidden>➜</span>
            </a>
            <a href="#demo" className="hero__cta-secondary">
              <span className="hero__play" aria-hidden>▶</span>
              Watch Demo
            </a>
          </div>
        </div>

        <div className="hero__right">
          <img src={doctorIllustration} alt="Doctor illustration" className="hero__doctor" />
          <img src={demoImage} alt="Today’s progress demo" className="hero__demo" />
        </div>
      </div>
    </section>
  )
}

export default Hero



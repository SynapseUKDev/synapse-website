import React, { useMemo } from 'react'
import './Hero.css'
import doctorIllustration from '../../assets/landing/hero-doctor.svg'
import demoImage from '../../assets/landing/hero-demo.png'
import { area as d3Area, curveBasis } from 'd3-shape'

function Hero() {
  return (
    <section className="hero">
      <div className="hero__bg" aria-hidden="true">
        {(() => {
          const W = 1440
          const H = 320
          const steps = 16
          const xs = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * W)
          const make = (amp, base, freq, phase = 0) =>
            xs.map((x) => ({
              x,
              y:
                base +
                amp * Math.sin((x / W) * Math.PI * freq + phase) +
                amp * 0.4 * Math.sin((x / W) * Math.PI * (freq * 0.5) + phase * 0.5),
            }))

          const wave1 = make(28, 110, 2.2)
          const wave2 = make(34, 150, 2.0, 0.6)
          const wave3 = make(38, 250, 1.8, 1.2)

          const aTop = d3Area()
            .x((d) => d.x)
            .y1((d) => d.y)
            .y0(0)
            .curve(curveBasis)

          const aBottom = d3Area()
            .x((d) => d.x)
            .y1((d) => d.y)
            .y0(H + 40) 
            .curve(curveBasis)

          const wave1Path = aTop(wave1)
          const wave2Path = aTop(wave2)
          const wave3Path = aBottom(wave3)

          const clipTopPath = d3Area()
            .x((d) => d.x)
            .y1((d) => d.y)
            .y0(0)
            .curve(curveBasis)(wave3)

          const overlap = make(24, H - 12, 1.6, 1.2)
          const overlapPath = d3Area()
            .x((d) => d.x)
            .y1((d) => d.y)
            .y0(H + 60)
            .curve(curveBasis)(overlap)

          return (
            <svg className="hero__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <defs>
                <clipPath id="clip-above-wave3">
                  <path d={clipTopPath || ''} />
                </clipPath>
              </defs>
              <g clipPath="url(#clip-above-wave3)">
                <path fill="#7BD0F1" d={wave1Path || ''} />
                <path fill="#7BD0F1" d={wave2Path || ''} />
              </g>
              <path fill="#3CA2CA" d={wave3Path || ''} />
              {/* <path fill="#ffffff" d={overlapPath || ''} /> */}
            </svg>
          )
        })()}
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
            <a href="/login?mode=signup" className="hero__cta-primary">
              <span>Start Learning</span>
              <span className="hero__cta-arrow" aria-hidden>➜</span>
            </a>
            {/* <a href="#demo" className="hero__cta-secondary">
              <span className="hero__play" aria-hidden>▶</span>
              Watch Demo
            </a> */}
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



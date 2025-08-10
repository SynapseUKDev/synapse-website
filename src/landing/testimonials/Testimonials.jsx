import React, { useEffect, useMemo, useRef, useState } from 'react'
import './Testimonials.css'
import artLeft from '../../assets/landing/hero-bottom2.svg'
import artRight from '../../assets/landing/hero-bottom1.svg'

function Testimonials() {
  const slides = useMemo(
    () => [
      {
        quote:
          'The question quality is phenomenal – every explanation helped me understand complex pathophysiology. The visual aids and memory techniques are game‑changers. My exam anxiety completely disappeared!',
        name: 'John Doe',
        meta: 'Final Year Medical Student · Imperial College London',
        avatar:
          'https://www.svgrepo.com/show/384670/account-avatar-profile-user.svg',
      },
      {
        quote:
          'Synapse’s concise notes and smart practice flow helped me finally connect topics. I improved two deciles in 6 weeks and felt calm on exam day.',
        name: 'Jane Doe',
        meta: 'Year 3 · University of Manchester',
        avatar:
          'https://images.icon-icons.com/2643/PNG/512/female_woman_user_people_avatar_white_tone_icon_159354.png',
      },
      {
        quote:
          'I loved the progress tracking and spaced revision. It kept me accountable and I retained so much more between rotations.',
        name: 'Ben Smith',
        meta: 'Year 4 · University of Glasgow',
        avatar:
          'https://cdn-icons-png.flaticon.com/512/6858/6858504.png',
      },
    ],
    []
  )

  const [index, setIndex] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current && clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000)
    return () => timerRef.current && clearInterval(timerRef.current)
  }, [slides.length])

  const goTo = (i) => setIndex(i)
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length)
  const next = () => setIndex((i) => (i + 1) % slides.length)

  return (
    <section className="testimonials" id="testimonials">
      <div className="testimonials__container">
        <div className="testimonials__badge">
          <span className="testimonials__badge-star" aria-hidden>⭐</span>
          Student Stories
        </div>

        <h2 className="testimonials__title">
          Transforming <span className="testimonials__title-accent">Medical Education</span>
        </h2>
        <p className="testimonials__subtitle">
          Real stories from real students who've achieved remarkable results
        </p>

        <div className="testimonials__slider">
          <button className="testimonials__nav testimonials__nav--prev" onClick={prev} aria-label="Previous testimonial" style={{visibility: slides.length > 1 ? 'visible' : 'hidden'}}>
            ‹
          </button>
          <div className="testimonials__viewport">
            <div className="testimonials__track" style={{ transform: `translateX(-${index * 100}%)` }}>
              {slides.map((s, i) => (
                <div className="testimonials__slide" key={i}>
                  <div className="testimonials__card">
                    <div className="testimonials__avatar" style={{ backgroundImage: `url(${s.avatar})` }} aria-hidden />
                    <p className="testimonials__quote">“{s.quote}”</p>
                    <div className="testimonials__rating" aria-label="5 out of 5 stars">
                      <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                    </div>
                    <div className="testimonials__author">
                      <div className="testimonials__name">{s.name}</div>
                      <div className="testimonials__meta">{s.meta}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button className="testimonials__nav testimonials__nav--next" onClick={next} aria-label="Next testimonial">
            ›
          </button>
        </div>

        <div className="testimonials__dots" role="tablist" aria-label="Testimonials tabs">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`testimonials__dot ${i === index ? 'is-active' : ''}`}
              onClick={() => goTo(i)}
              aria-selected={i === index}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>

        <img src={artLeft} alt="Decorative student" className="testimonials__art testimonials__art--left" />
        <img src={artRight} alt="Decorative student at desk" className="testimonials__art testimonials__art--right" />
      </div>
    </section>
  )
}

export default Testimonials



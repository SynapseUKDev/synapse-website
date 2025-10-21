import React, { useEffect, useMemo, useRef, useState } from 'react'
import './Testimonials.css'
import artLeft from '../../assets/landing/hero-bottom2.svg'
import artRight from '../../assets/landing/hero-bottom1.svg'

function Testimonials() {
  const slides = useMemo(
    () => [
      {
        quote:
          'The notes are very clear and I like how the clinical features are in tables making quick revision much more convenient. The overall website has a clean interface that’s easy to navigate.',
        name: 'S Rahman',
        meta: '4th Year Medical Student',
        avatar:
          'https://www.svgrepo.com/show/384670/account-avatar-profile-user.svg',
      },
      {
        quote:
          'The format of the website is easy to follow and I particularly like the question bank, whenever you answer a question there are clear explanations as to why each answer is appropriate or not and this has been useful for my learning.',
        name: 'Khadija B',
        meta: '4th Year Medical Student',
        avatar:
          'https://images.squarespace-cdn.com/content/v1/66a674c720afc43adfa96c98/3f435e4f-975c-4350-bcb3-e2154f17bf40/Screenshot+2025-08-19+011048.png?format=2500w',
      },
      {
        quote:
          'Great variety of questions covering high yield topics. The explanations are clear and concise, and I find the clinical tables really helpful.',
        name: 'Mohammed D',
        meta: '5th Year Medical Student',
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
          <button className="testimonials__nav testimonials__nav--prev" onClick={prev} aria-label="Previous testimonial">
            ‹
          </button>
          <div className="testimonials__viewport">
            <div className="testimonials__track" style={{ transform: `translateX(-${index * 100}%)` }}>
              {slides.map((s, i) => (
                <div className="testimonials__slide" key={i}>
                  <div className="testimonials__card">
                    <div className="testimonials__avatar" style={{ backgroundImage: `url(${s.avatar})` }} aria-hidden />
                    <p className="testimonials__quote">"{s.quote}"</p>
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



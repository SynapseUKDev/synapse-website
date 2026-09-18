import React from 'react'
import { Reveal } from '../Reveal.jsx'
import './Testimonials.css'

const STORIES = [
  {
    quote:
      'The notes are very clear and I like how the clinical features are in tables making quick revision much more convenient. The overall website has a clean interface that’s easy to navigate.',
    name: 'S Rahman',
    meta: 'Year 4 · UK Medical School',
    avatar:
      'https://images.squarespace-cdn.com/content/v1/66a674c720afc43adfa96c98/97815649-5427-4a82-8208-9a5f587ac8e2/Screenshot+2025-03-31+225902.png?format=1500w',
  },
  {
    quote:
      'The format of the website is easy to follow and I particularly like the question bank, whenever you answer a question there are clear explanations as to why each answer is appropriate or not and this has been useful for my learning.',
    name: 'Khadija B',
    meta: 'Year 4 · UK Medical School',
    avatar:
      'https://images.squarespace-cdn.com/content/v1/66a674c720afc43adfa96c98/3f435e4f-975c-4350-bcb3-e2154f17bf40/Screenshot+2025-08-19+011048.png?format=2500w',
  },
  {
    quote:
      'Great variety of questions covering high yield topics. The explanations are clear and concise, and I find the clinical tables really helpful.',
    name: 'Mohammed D',
    meta: 'Final Year · UK Medical School',
    avatar: 'https://cdn-icons-png.flaticon.com/512/6858/6858504.png',
  },
]

function Stars() {
  return (
    <div className="stories__stars" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.1l-4.94 2.61.94-5.5-4-3.9 5.53-.8L10 1.5z" />
        </svg>
      ))}
    </div>
  )
}

function Testimonials() {
  return (
    <section className="stories" id="stories">
      <div className="lp-wrap">
        <Reveal className="stories__intro">
          <p className="lp-eyebrow">Student stories</p>
          <h2 className="lp-title">Trusted by medical students across the UK.</h2>
          <p className="lp-lead">
            A modern learning platform should feel useful on day one — whether you're consolidating a
            placement, revising for finals or preparing for the UKMLA.
          </p>
        </Reveal>

        <div className="stories__grid">
          {STORIES.map((story, i) => (
            <Reveal key={story.name} delay={i * 0.08}>
              <article className="stories__card">
                <Stars />
                <p className="stories__quote">“{story.quote}”</p>
                <div className="stories__author">
                  <span
                    className="stories__avatar"
                    style={{ backgroundImage: `url(${story.avatar})` }}
                    aria-hidden
                  />
                  <div>
                    <div className="stories__name">{story.name}</div>
                    <div className="stories__meta">{story.meta}</div>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials

import React from 'react'
import { Link } from 'react-router-dom'
import { LuArrowRight, LuCheck } from 'react-icons/lu'
import { Reveal } from '../Reveal.jsx'
import './Pricing.css'

const PLANS = [
  {
    id: 'full',
    name: 'Full Access',
    price: '£15',
    period: '/ 6 months',
    cta: 'Start Learning',
    to: '/login?mode=signup',
    featured: true,
    features: [
      'Full UKMLA question bank',
      'Complete textbook access',
      'OSCE learning resources',
      'Performance analytics',
      'Smart revision tools',
    ],
  },
  {
    id: 'schools',
    name: 'Institutions',
    price: 'Custom',
    period: '',
    cta: 'Contact us',
    to: 'mailto:admin@synapseuk.org',
    featured: false,
    features: [
      'Everything in Full Access',
      'Cohort and roster tools',
      'School-wide progress tracking',
      'Dedicated onboarding support',
    ],
  },
]

export default function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="lp-wrap">
        <Reveal className="pricing__intro">
          <p className="lp-eyebrow">Simple, transparent pricing</p>
          <h2 className="lp-title">Choose the plan that works for you.</h2>
          <p className="lp-lead">
            Full platform access for £15 per 6 months, or a custom plan for medical
            schools. Cancel anytime.
          </p>
        </Reveal>

        <div className="pricing__grid">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 0.08} className={plan.featured ? 'pricing__featured-wrap' : undefined}>
              <article className={`pricing__card ${plan.featured ? 'is-featured' : ''}`}>
                {plan.featured && <div className="pricing__badge">Recommended</div>}
                <h3>{plan.name}</h3>
                <div className="pricing__amount">
                  <span className="pricing__price">{plan.price}</span>
                  {plan.period && <span className="pricing__period">{plan.period}</span>}
                </div>
                <ul className="pricing__features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <LuCheck />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.to.startsWith('mailto:') ? (
                  <a href={plan.to} className={`lp-btn ${plan.featured ? 'lp-btn--primary' : 'lp-btn--ghost'} pricing__cta`}>
                    {plan.cta}
                  </a>
                ) : (
                  <Link to={plan.to} className={`lp-btn ${plan.featured ? 'lp-btn--primary' : 'lp-btn--ghost'} pricing__cta`}>
                    {plan.cta}
                    {plan.featured && <LuArrowRight />}
                  </Link>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

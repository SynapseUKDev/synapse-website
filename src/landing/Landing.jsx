import React from 'react'
import './Landing.css'
import Hero from './hero/Hero.jsx'
import Testimonials from './testimonials/Testimonials.jsx'
import Navbar from '../components/navbar/Navbar.jsx'
import Footer from '../components/footer/Footer.jsx'
import { area as d3Area, curveBasis } from 'd3-shape'

function Landing() {
  return (
    <div className="landing">
      <Navbar />
      <main className="landing__main">
        <Hero />

        {/* Pricing Section */}
        <section className="landing__pricing">
          <div className="landing__pricing-bg" aria-hidden="true">
            {(() => {
              const W = 1440
              const H = 600
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

              // Create a custom wave that goes higher on the right side
              const makeAsymmetric = (amp, base, freq, phase = 0) =>
                xs.map((x) => {
                  const progress = x / W; // 0 to 1 from left to right
                  const rightSideBoost = progress * 40; // Higher boost on the right
                  return {
                    x,
                    y:
                      base +
                      amp * Math.sin((x / W) * Math.PI * freq + phase) +
                      amp * 0.4 * Math.sin((x / W) * Math.PI * (freq * 0.5) + phase * 0.5) -
                      rightSideBoost, // Subtract to make it go higher (lower y values)
                  };
                })

              const wave1 = makeAsymmetric(32, 340, 2.1, 0.3)
              const wave2 = make(38, 420, 1.9, 0.8)

              const aBottomFill = d3Area()
                .x((d) => d.x)
                .y1((d) => d.y)
                .y0(H)
                .curve(curveBasis)

              const wave1Path = aBottomFill(wave1)
              const wave2Path = aBottomFill(wave2)

              return (
                <svg className="landing__pricing-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                  <path fill="#5AB8DB" d={wave1Path || ''} className="landing__pricing-wave1" />
                  <path fill="#ffffff" d={wave2Path || ''} />
                </svg>
              )
            })()}
          </div>

          <div className="landing__pricing-container">
            <div className="landing__pricing-header">
              <div className="landing__pricing-header-card">
                <h2 className="landing__pricing-title">Simple, Transparent Pricing</h2>
                <p className="landing__pricing-subtitle">
                  Start learning today for just £15 per 6 months
                </p>
              </div>
            </div>

            <div className="landing__pricing-card">
              {/* <div className="landing__pricing-trial-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span>Most Popular</span>
              </div> */}

              <div className="landing__pricing-content">
                <div className="landing__pricing-main">
                  <div className="landing__pricing-left">
                    <h3 className="landing__pricing-plan">Full Access Plan</h3>
                    <div className="landing__pricing-amount">
                      <span className="landing__pricing-currency">£</span>
                      <span className="landing__pricing-price">15</span>
                      <span className="landing__pricing-period">/ 6 months</span>
                    </div>
                    <p className="landing__pricing-desc">
                      Everything you need to excel in your medical studies
                    </p>
                  </div>

                  {/* <div className="landing__pricing-trial-box">
                    <div className="landing__pricing-trial-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </div>
                    <div className="landing__pricing-trial-text">
                      <div className="landing__pricing-trial-title">3-Week Free Trial</div>
                      <div className="landing__pricing-trial-subtitle">Full access, no card required</div>
                    </div>
                  </div> */}
                </div>

                <div className="landing__pricing-features">
                  <div className="landing__pricing-feature">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                    </svg>
                    <span>5,000+ UKMLA-focused practice questions</span>
                  </div>
                  <div className="landing__pricing-feature">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                    </svg>
                    <span>Detailed multi-level explanations</span>
                  </div>
                  <div className="landing__pricing-feature">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                    </svg>
                    <span>Comprehensive textbook and study materials</span>
                  </div>
                  <div className="landing__pricing-feature">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                    </svg>
                    <span>Advanced analytics and progress tracking</span>
                  </div>
                  <div className="landing__pricing-feature">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                    </svg>
                    <span>Cancel anytime, no commitment</span>
                  </div>
                </div>

                <a href="/login?mode=signup" className="landing__pricing-cta">
                  Get Started
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14m-7-7l7 7-7 7" />
                  </svg>
                </a>

                <p className="landing__pricing-footer">
                  Cancel anytime • Secure payments by Stripe
                </p>
              </div>
            </div>
          </div>
        </section>

        <Testimonials />
      </main>
      <Footer />
    </div>
  )
}

export default Landing
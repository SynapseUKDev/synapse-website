import React from 'react'
import './Landing.css'
import Hero from './hero/Hero.jsx'
import TrustBar from './trust/TrustBar.jsx'
import Platform from './platform/Platform.jsx'
import Testimonials from './testimonials/Testimonials.jsx'
import Pricing from './pricing/Pricing.jsx'
import CtaBanner from './cta/CtaBanner.jsx'
import Navbar from '../components/navbar/Navbar.jsx'
import Footer from '../components/footer/Footer.jsx'

function Landing() {
  return (
    <div className="landing">
      <Navbar />
      <main className="landing__main">
        <Hero />
        <TrustBar />
        <Platform />
        <Testimonials />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  )
}

export default Landing

import React from 'react'
import './Landing.css'
import Hero from './hero/Hero.jsx'
import Testimonials from './testimonials/Testimonials.jsx'
import Navbar from '../components/navbar/Navbar.jsx'
import Footer from '../components/footer/Footer.jsx'

function Landing() {
  return (
    <div className="landing">
      <Navbar />
      <main className="landing__main">
        <Hero />
        <Testimonials />
      </main>
      <Footer />
    </div>
  )
}

export default Landing
import React from 'react'
import Navbar from './components/navbar/Navbar.jsx'
import Footer from './components/footer/Footer.jsx'
import Landing from './landing/Landing.jsx'
import './App.css'

function App() {
  return (
    <div className="landing">
      <Navbar />

      <main>
        <Landing />
      </main>

      <Footer />
    </div>
  )
}

export default App

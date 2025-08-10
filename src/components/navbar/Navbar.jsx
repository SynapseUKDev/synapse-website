import React from 'react'
import './Navbar.css'
import logo from '../../assets/logo/logo.png'

function Navbar() {
  return (
    <header className="nav">
      <div className="nav__container">
        <a href="#" className="nav__brand">
          <img src={logo} alt="Synapse UK" className="nav__logo" />
        </a>

        <nav className="nav__links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About Us</a>
        </nav>

        <a href="#login" className="nav__login">Login</a>
      </div>
    </header>
  )
}

export default Navbar


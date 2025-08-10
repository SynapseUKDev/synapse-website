import React from 'react'
import './Navbar.css'
import logo from '../../assets/logo/logo.png'
import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <header className="nav">
      <div className="nav__container">
        <Link to="/" className="nav__brand">
          <img src={logo} alt="Synapse UK" className="nav__logo" />
        </Link>

        <nav className="nav__links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About Us</a>
        </nav>

        <Link to="/auth" className="nav__login">Login</Link>
      </div>
    </header>
  )
}

export default Navbar


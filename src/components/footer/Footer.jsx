import React from 'react'
import './Footer.css'
import logo from '../../assets/logo/logo.png'
import { FaInstagram, FaXTwitter, FaFacebookF, FaEnvelope } from 'react-icons/fa6'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__brand">
          <img src={logo} alt="Synapse UK" className="footer__logo" />
        </div>

        <div className="footer__content">
          <h3 className="footer__title">Stay in the loop</h3>
          <p className="footer__desc">
            Sign up to our newsletter to never miss an announcement and receive the latest
            news about what we’re doing
          </p>

          <form className="footer__form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" className="footer__input" placeholder="Email Address" />
            <button className="footer__cta" type="submit">Sign Up</button>
          </form>

          <p className="footer__opt">Opt-out at any time</p>

          <div className="footer__social">
            <a target="_blank" href="https://www.instagram.com/synapse_uk/" aria-label="Instagram"><FaInstagram /></a>
            <a target="_blank" href="https://x.com/_Synapse_UK" aria-label="X / Twitter"><FaXTwitter /></a>
            <a target="_blank" href="https://www.facebook.com/profile.php?id=61563402495874" aria-label="Facebook"><FaFacebookF /></a>
            <a target="_blank" href="mailto:admin@synapseuk.org" aria-label="Email"><FaEnvelope /></a>
          </div>

          <div className="footer__copy">
            © 2025 SynapseUK Ltd. All rights reserved. SynapseUK® is a registered trademark.
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer


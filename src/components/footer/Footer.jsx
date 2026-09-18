import React from 'react'
import { Link } from 'react-router-dom'
import { FaInstagram, FaXTwitter, FaFacebookF, FaEnvelope } from 'react-icons/fa6'
import logo from '../../assets/logo/logo.png'
import './Footer.css'

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'Question Bank', href: '#platform' },
      { label: 'UKMLA Textbook', href: '#platform' },
      { label: 'OSCE', href: '#platform' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#about' },
      { label: 'SynapseUK', href: 'https://www.synapseuk.org', external: true },
      { label: 'Contact', href: 'mailto:admin@synapseuk.org' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Support', href: 'mailto:admin@synapseuk.org' },
      { label: 'UKMLA', href: '#platform' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: 'https://www.synapseuk.org/terms-and-conditions', external: true },
      { label: 'Privacy', href: 'https://www.synapseuk.org/privacy-policy', external: true },
    ],
  },
]

function FooterLink({ link }) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer">
        {link.label}
      </a>
    )
  }
  if (link.href.startsWith('mailto:') || link.href.startsWith('#')) {
    return <a href={link.href}>{link.label}</a>
  }
  return <Link to={link.href}>{link.label}</Link>
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__brand">
          <Link to="/" className="footer__logo-link">
            <img src={logo} alt="" className="footer__mark" />
            <span>EduSynapse</span>
          </Link>
          <p>
            Integrated medical learning for UK medical students — helping you build knowledge,
            practise clinically and prepare with confidence.
          </p>
          <div className="footer__social">
            <a target="_blank" rel="noopener noreferrer" href="https://www.instagram.com/synapse_uk/" aria-label="Instagram"><FaInstagram /></a>
            <a target="_blank" rel="noopener noreferrer" href="https://x.com/_Synapse_UK" aria-label="X / Twitter"><FaXTwitter /></a>
            <a target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/profile.php?id=61563402495874" aria-label="Facebook"><FaFacebookF /></a>
            <a href="mailto:admin@synapseuk.org" aria-label="Email"><FaEnvelope /></a>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div className="footer__col" key={col.title}>
            <h3>{col.title}</h3>
            <ul>
              {col.links.map((link) => (
                <li key={link.label}><FooterLink link={link} /></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="footer__bottom">
        <span>© 2026 SynapseUK Ltd · ICO Reg: ZB907329 · All rights reserved.</span>
        <span>Designed for UK medical students.</span>
      </div>
    </footer>
  )
}

export default Footer

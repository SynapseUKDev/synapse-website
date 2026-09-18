import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import logo from '../assets/logo/logo.png'
import AuthPreview from './AuthPreview.jsx'
import './Auth.css'

const PREVIEW_MQ = '(min-width: 1024px)'

function useShowPreview() {
  const [show, setShow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(PREVIEW_MQ).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(PREVIEW_MQ)
    const update = () => setShow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return show
}

const COPY = {
  signin: {
    eyebrow: 'Welcome back',
    headline: (
      <>
        Pick up in your <span>study space.</span>
      </>
    ),
    subtitle: 'Dashboard, questions and textbook — ready when you are.',
  },
  signup: {
    eyebrow: 'Join EduSynapse',
    headline: (
      <>
        See inside the <span>platform.</span>
      </>
    ),
    subtitle: 'A real look at the dashboard, question bank, textbook and OSCE practice.',
  },
  default: {
    eyebrow: 'Inside EduSynapse',
    headline: (
      <>
        Built the way you'll <span>actually revise.</span>
      </>
    ),
    subtitle: 'Dashboard, questions, textbook and OSCE — in one place.',
  },
}

export default function AuthShell({ children, headline, subtitle, eyebrow }) {
  const location = useLocation()
  const reduce = useReducedMotion()
  const showPreview = useShowPreview()
  const mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin'
  const isLogin = location.pathname === '/login'
  const copy = headline || subtitle || eyebrow
    ? {
        eyebrow: eyebrow || COPY.default.eyebrow,
        headline: headline || COPY.default.headline,
        subtitle: subtitle || COPY.default.subtitle,
      }
    : isLogin
      ? COPY[mode]
      : COPY.default

  const copyKey = isLogin ? mode : 'page'

  return (
    <section className="auth">
      <div className="auth__split auth__split--left">
        <div className="auth__form-wrap">
          <div className="auth__brand-row">
            <Link to="/" className="auth__home" aria-label="EduSynapse home">
              <img src={logo} alt="" />
              <span>EduSynapse</span>
            </Link>
          </div>

          {children}

          <p className="auth__back">
            <Link to="/">Back to homepage</Link>
          </p>
        </div>
      </div>

      {showPreview && (
        <aside className="auth__split auth__split--right">
          <div className="auth__aside">
            <AnimatePresence mode="wait">
              <motion.div
                key={copyKey}
                className="auth__copy"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="auth__eyebrow">{copy.eyebrow}</p>
                <h1 className="auth__headline">{copy.headline}</h1>
                <p className="auth__subtitle">{copy.subtitle}</p>
              </motion.div>
            </AnimatePresence>

            <AuthPreview />
          </div>
        </aside>
      )}
    </section>
  )
}

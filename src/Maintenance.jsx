import logo from './assets/logo/logo.png'
import doctorIllustration from './assets/landing/hero-doctor.svg'
import demoImage from './assets/landing/hero-demo.png'
import Footer from './components/footer/Footer.jsx'

export default function Maintenance() {
  const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#58BFE7',
    color: '#0B1637',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, system-ui, -system-ui, "Segoe UI", sans-serif',
  }

  const headerStyle = {
    backgroundColor: '#040A4C',
    borderBottom: '2px solid #EEAE36',
    padding: '14px 20px',
    display: 'flex',
    justifyContent: 'center',
  }

  const headerInnerStyle = {
    width: '100%',
    maxWidth: '1200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const logoStyle = {
    height: '56px',
    width: 'auto',
    display: 'block',
  }

  const headerTagStyle = {
    padding: '6px 12px',
    borderRadius: '999px',
    background:
      'linear-gradient(180deg, #F1C269 0%, #EEAE36 100%)',
    color: '#0B1637',
    fontWeight: 700,
    fontSize: '0.85rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  }

  const headerDotStyle = {
    width: '10px',
    height: '10px',
    borderRadius: '999px',
    backgroundColor: '#F97316',
  }

  const mainStyle = {
    flex: '1 1 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px 48px',
  }

  const heroStyle = {
    width: '100%',
    maxWidth: '1200px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
    gap: '32px',
    alignItems: 'center',
  }

  const heroLeftStyle = {
    maxWidth: '620px',
  }

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#ffffff',
    color: '#0B1637',
    borderRadius: '999px',
    padding: '6px 12px',
    fontWeight: 700,
    boxShadow: '0 2px 0 rgba(0,0,0,0.15)',
    fontSize: '0.9rem',
    marginBottom: '12px',
  }

  const badgePillStyle = {
    padding: '2px 8px',
    borderRadius: '999px',
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }

  const titleStyle = {
    fontSize: '2.6rem',
    lineHeight: 1.05,
    margin: '10px 0 10px',
    color: '#ffffff',
  }

  const accentStyle = {
    background: 'linear-gradient(180deg, #f7dba8 0%, #e9ae3a 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  }

  const bodyStyle = {
    fontSize: '1.05rem',
    lineHeight: 1.7,
    color: '#E8F6FF',
    marginTop: '4px',
    maxWidth: '520px',
    fontWeight: 500,
  }

  const highlightStyle = {
    fontWeight: 700,
    color: '#ffffff',
  }

  const heroRightStyle = {
    position: 'relative',
    minHeight: '320px',
  }

  const doctorStyle = {
    position: 'absolute',
    right: '40px',
    bottom: '40px',
    width: 'clamp(180px, 26vw, 400px)',
    height: 'auto',
    zIndex: 2,
  }

  const demoStyle = {
    position: 'absolute',
    right: 0,
    top: '12px',
    width: 'min(540px, 60vw)',
    height: 'auto',
    transform: 'rotate(-2deg)',
    zIndex: 1,
    borderRadius: '18px',
  }

  const mobileNoteStyle = {
    display: 'none',
    marginTop: '32px',
    fontSize: '0.85rem',
    color: '#0B1637',
    opacity: 0.9,
  }

  // Simple mobile tweak using window width if available
  const isMobile =
    typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    heroStyle.gridTemplateColumns = '1fr'
    heroRightStyle.minHeight = '360px'
    doctorStyle.left = '50%'
    doctorStyle.right = 'auto'
    doctorStyle.transform = 'translateX(-50%)'
    demoStyle.left = '50%'
    demoStyle.right = 'auto'
    demoStyle.transform = 'translateX(-50%) rotate(-2deg)'
    mobileNoteStyle.display = 'block'
  }

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <img src={logo} alt="Synapse UK" style={logoStyle} />
          <div style={headerTagStyle}>
            <span style={headerDotStyle} aria-hidden="true" />
            Maintenance in progress
          </div>
        </div>
      </header>

      <main style={mainStyle}>
        <section style={heroStyle}>
          <div style={heroLeftStyle}>
            <div style={badgeStyle}>
              <span style={badgePillStyle}>Scheduled</span>
              We&apos;re upgrading your study space
            </div>
            <h1 style={titleStyle}>
              We&apos;ll be back{' '}
              <span style={accentStyle}>very soon</span>
            </h1>
            <p style={bodyStyle}>
              Synapse is briefly offline while we roll out updates and improve
              performance.{' '}
              <span style={highlightStyle}>
                Your progress and question history are all
                safely stored.
              </span>
            </p>
          </div>

          <div style={heroRightStyle} aria-hidden="true">
            <img
              src={demoImage}
              alt=""
              style={demoStyle}
            />
            <img
              src={doctorIllustration}
              alt=""
              style={doctorStyle}
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

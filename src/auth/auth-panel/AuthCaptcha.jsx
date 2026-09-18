import { useEffect, useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'
const COMPACT_CAPTCHA_MQ = '(max-width: 340px)'

export default function AuthCaptcha({ captchaRef, onSuccess, onExpire, onError }) {
  const [size, setSize] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(COMPACT_CAPTCHA_MQ).matches
      ? 'compact'
      : 'flexible'
  )

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_CAPTCHA_MQ)
    const update = () => setSize(mq.matches ? 'compact' : 'flexible')
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return (
    <div className={`auth-panel__captcha${size === 'compact' ? ' auth-panel__captcha--compact' : ''}`}>
      <Turnstile
        key={size}
        ref={captchaRef}
        siteKey={TURNSTILE_SITE_KEY}
        onSuccess={onSuccess}
        onExpire={onExpire}
        onError={onError}
        options={{ theme: 'light', size }}
      />
    </div>
  )
}

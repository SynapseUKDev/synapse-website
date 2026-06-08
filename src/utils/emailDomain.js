const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.co.uk',
  'yandex.com',
  'yandex.ru',
  'fastmail.com',
  'tutanota.com',
  'tuta.io',
  'hey.com',
  'qq.com',
  '163.com',
  '126.com',
  'rediffmail.com',
  'inbox.com',
  'rocketmail.com',
  'btinternet.com',
  'virginmedia.com',
  'sky.com',
  'talktalk.net',
  'comcast.net',
  'att.net',
  'verizon.net',
])

export function getEmailDomain(email) {
  if (!email || typeof email !== 'string') return null
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return null
  const domain = email.slice(at + 1).trim().toLowerCase()
  return domain || null
}

export function isPersonalEmailDomain(domain) {
  return PERSONAL_EMAIL_DOMAINS.has(domain.trim().toLowerCase())
}

export function isUniversityEmail(email) {
  const domain = getEmailDomain(email)
  if (!domain) return false
  return !isPersonalEmailDomain(domain)
}

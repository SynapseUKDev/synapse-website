import { describe, expect, test } from 'vitest'
import { beforeSend, sanitizeEventProps, SUPER_PROPERTY_KEYS } from '../../src/usage/beforeSend.js'

const base = 'https://app.synapseuk.org'

function ev(event, properties = {}, extra = {}) {
  return { uuid: 'u', event, properties: { token: 'phc', distinct_id: 'user-1', ...properties }, ...extra }
}

describe('beforeSend: excluded routes', () => {
  test.each([
    '/dashboard/admin',
    '/dashboard/admin/questions/123',
    '/dashboard/admin/osce/station/4',
    '/dashboard/institution',
    '/dashboard/institution?billing=required',
  ])('drops every event type on %s', (path) => {
    for (const name of ['$pageview', '$autocapture', '$$heatmap', '$pageleave', 'qbank.session_started']) {
      expect(beforeSend(ev(name, { $current_url: base + path }))).toBeNull()
      expect(beforeSend(ev(name, { $pathname: path.split('?')[0] }))).toBeNull()
    }
  })

  test('does not drop look-alike paths', () => {
    expect(beforeSend(ev('$pageview', { $pathname: '/dashboard/administration-tips' }))).not.toBeNull()
    expect(beforeSend(ev('$pageview', { $pathname: '/dashboard/institutional' }))).not.toBeNull()
  })
})

describe('beforeSend: URL scrubbing', () => {
  test('strips query strings and fragments from every URL property and adds $route_pattern', () => {
    const out = beforeSend(
      ev(
        '$pageview',
        {
          $current_url: `${base}/dashboard/textbook/topic/heart-failure?tab=2#section`,
          $pathname: '/dashboard/textbook/topic/heart-failure',
          $referrer: `${base}/auth/callback#access_token=secret`,
          $initial_current_url: `${base}/auth/setup-account?token_hash=abc`,
          $initial_referrer: 'https://mail.example.com/?q=x',
          $prev_pageview_pathname: '/dashboard?x=1',
        },
        {
          $set: { $current_url: `${base}/dashboard?x=1` },
          $set_once: { $initial_current_url: `${base}/login?next=x`, $initial_pathname: '/login?next=x' },
        }
      )
    )
    expect(out.properties.$current_url).toBe(`${base}/dashboard/textbook/topic/heart-failure`)
    expect(out.properties.$referrer).toBe(`${base}/auth/callback`)
    expect(out.properties.$initial_current_url).toBe(`${base}/auth/setup-account`)
    expect(out.properties.$initial_referrer).toBe('https://mail.example.com/')
    expect(out.properties.$prev_pageview_pathname).toBe('/dashboard')
    expect(out.properties.$route_pattern).toBe('/dashboard/textbook/topic/:topicSlug')
    expect(out.$set.$current_url).toBe(`${base}/dashboard`)
    expect(out.$set_once.$initial_current_url).toBe(`${base}/login`)
    expect(out.$set_once.$initial_pathname).toBe('/login')
    expect(JSON.stringify(out)).not.toMatch(/secret|token_hash|tab=2/)
  })

  test('leaves $direct referrer alone', () => {
    const out = beforeSend(ev('$pageview', { $pathname: '/dashboard', $referrer: '$direct' }))
    expect(out.properties.$referrer).toBe('$direct')
  })
})

describe('beforeSend: custom events', () => {
  test('drops events that are not in the catalogue', () => {
    expect(beforeSend(ev('qbank.answer_chosen', { $pathname: '/dashboard' }))).toBeNull()
    expect(beforeSend(ev('random', { $pathname: '/dashboard' }))).toBeNull()
  })

  test('keeps allowed props, PostHog internals and super properties; drops everything else', () => {
    const supers = Object.fromEntries(SUPER_PROPERTY_KEYS.map((k) => [k, 'x']))
    const out = beforeSend(
      ev('qbank.session_started', {
        $pathname: '/dashboard/question-bank/setup',
        $lib: 'web',
        ...supers,
        mode: 'solo',
        question_count: 20,
        topic_name: 'Cardiology',
        question_id: 'q-1',
        email: 'a@b.c',
      })
    )
    expect(out.properties).toMatchObject({ mode: 'solo', question_count: 20, $lib: 'web', token: 'phc', ...supers })
    expect(out.properties).not.toHaveProperty('topic_name')
    expect(out.properties).not.toHaveProperty('question_id')
    expect(out.properties).not.toHaveProperty('email')
  })

  test('drops invalid values for allowed props', () => {
    const out = beforeSend(
      ev('qbank.session_started', { $pathname: '/dashboard', mode: 'cheat', question_count: '20' })
    )
    expect(out.properties).not.toHaveProperty('mode')
    expect(out.properties).not.toHaveProperty('question_count')
    const long = beforeSend(ev('billing.upgrade_started', { $pathname: '/subscribe', plan: 'x'.repeat(65) }))
    expect(long.properties).not.toHaveProperty('plan')
    const nested = beforeSend(ev('mock.started', { $pathname: '/dashboard', timed: { a: 1 } }))
    expect(nested.properties).not.toHaveProperty('timed')
  })

  test('passes PostHog events through apart from URL fields', () => {
    const elements = [{ tag_name: 'button', $el_text: 'Start practice', attr__data_track: 'qbank.start_practice' }]
    const out = beforeSend(ev('$autocapture', { $pathname: '/dashboard/question-bank/setup', $elements: elements }))
    expect(out.properties.$elements).toEqual(elements)
    expect(out.event).toBe('$autocapture')
  })
})

describe('beforeSend: robustness', () => {
  test('returns null on malformed input instead of throwing', () => {
    expect(beforeSend(null)).toBeNull()
    expect(beforeSend({})).toBeNull()
    expect(beforeSend({ event: '$pageview', properties: null })).toBeNull()
  })
})

describe('sanitizeEventProps', () => {
  test('applies the same allowlist used by before_send', () => {
    expect(sanitizeEventProps('group.session_joined', { kind: 'osce', role: 'host', room: 'ABC' })).toEqual({
      kind: 'osce',
      role: 'host',
    })
    expect(sanitizeEventProps('unknown.event', { a: 1 })).toBeNull()
    expect(sanitizeEventProps('mock.started', undefined)).toEqual({})
  })
})

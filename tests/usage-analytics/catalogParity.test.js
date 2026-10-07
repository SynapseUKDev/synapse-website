import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { CATALOG_VERSION, EVENTS, EVENT_PROPS } from '../../src/usage/catalog.js'

// The event catalogue is written down twice: as the contract in specs/002 and as
// events.js, which the website and before_send use. They cannot share code, so this
// test parses the contract's "Key actions" table and fails the day they drift.
const here = path.dirname(fileURLToPath(import.meta.url))
const CONTRACT = path.resolve(here, '../../../specs/002-platform-usage-analytics/contracts/event-catalog.md')

function parseContract() {
  const md = fs.readFileSync(CONTRACT, 'utf8')
  const version = Number(/^# Event Catalogue — v(\d+)/m.exec(md)?.[1])
  const section = md.split('## Key actions')[1].split('\n## ')[0]
  const events = {}
  for (const line of section.split('\n')) {
    const cells = line.split(/(?<!\\)\|/).map((c) => c.trim())
    const name = /^`([a-z_]+\.[a-z_]+)`$/.exec(cells[1] || '')?.[1]
    if (!name) continue
    const props = {}
    // A prop is a backticked token, optionally followed by "(`a`\|`b`)" enum values or "(bool)".
    for (const m of (cells[3] || '').matchAll(/`([a-z_]+)`\s*(?:\(([^)]*)\))?/g)) {
      const values = [...(m[2] || '').matchAll(/`([^`]+)`/g)].map((v) => v[1])
      props[m[1]] = values.length ? values : null
    }
    events[name] = props
  }
  return { version, events }
}

describe('event catalogue parity (contract ⇔ events.js)', () => {
  const contract = parseContract()

  test('catalogue versions match', () => {
    expect(CATALOG_VERSION).toBe(contract.version)
  })

  test('the same event names exist in both', () => {
    expect(Object.values(EVENTS).sort()).toEqual(Object.keys(contract.events).sort())
    expect(Object.keys(EVENT_PROPS).sort()).toEqual(Object.keys(contract.events).sort())
  })

  test('each event allows exactly the contract props, with the same enum values', () => {
    for (const [name, props] of Object.entries(contract.events)) {
      expect(Object.keys(EVENT_PROPS[name]).sort(), name).toEqual(Object.keys(props).sort())
      for (const [prop, values] of Object.entries(props)) {
        if (values) expect(EVENT_PROPS[name][prop], `${name}.${prop}`).toEqual(values)
        else expect(Array.isArray(EVENT_PROPS[name][prop]), `${name}.${prop}`).toBe(false)
      }
    }
  })
})

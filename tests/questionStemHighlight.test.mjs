/**
 * Regression tests for stem-highlight selection anchoring.
 *
 * Plain `node`, no framework: the app has no test runner, and these functions are pure
 * (no DOM at import time), so they run directly. `npm run test:highlight`.
 *
 * What these guard: a highlight is anchored by OFFSET, but `reconcileSelectionRangeToFlat`
 * has to re-find the selected text whenever the DOM Range offsets drift from the flattened
 * stem text -- which happens because each existing <mark> renders a `×` delete button that
 * `flat` filters out (data-hl-ignore) while the Range still counts it. If that re-find picks
 * the wrong occurrence, the highlight silently lands on different words than the user chose.
 */

import {
  reconcileSelectionRangeToFlat,
  mapFlatRangeToMarkdownRange,
} from '../src/utils/questionStemHighlight.js'

let failed = 0
let passed = 0

function t(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok    ${name}`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${name}\n        ${e.message}`)
  }
}

function eq(got, want, what) {
  if (got !== want) {
    throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  }
}

// "allmark" contains "llm" at index 5 -- a decoy sitting BEFORE the word the user selected.
const flat = 'His allmark score was noted, so the llm triage tool was used.'
const decoy = flat.indexOf('llm')
const target = flat.lastIndexOf('llm')

console.log('\nreconcileSelectionRangeToFlat -- anchors to the occurrence nearest the raw offset')

// Realistic drift is roughly one code unit per existing highlight on the stem.
for (const drift of [0, -2, -5, -10, 2, 5, 10]) {
  t(`drift ${drift}: standalone "llm" is not relocated into "allmark"`, () => {
    const r = reconcileSelectionRangeToFlat(flat, target + drift, target + drift + 3, 'llm')
    eq(flat.slice(r.start, r.end), 'llm', 'selected text')
    eq(r.start, target, `start (decoy sits at ${decoy})`)
  })
}

t('a selection genuinely on the decoy still resolves to the decoy', () => {
  const r = reconcileSelectionRangeToFlat(flat, decoy + 1, decoy + 4, 'llm')
  eq(r.start, decoy, 'start')
})

t('an exact match is returned untouched', () => {
  const r = reconcileSelectionRangeToFlat(flat, target, target + 3, 'llm')
  eq(r.start, target, 'start')
  eq(r.end, target + 3, 'end')
})

t('a multi-word selection with drift resolves to the nearest match', () => {
  const f = 'the allmark tool and later the llm tool was reviewed'
  const at = f.lastIndexOf('llm tool')
  const r = reconcileSelectionRangeToFlat(f, at - 3, at + 5, 'llm tool')
  eq(f.slice(r.start, r.end), 'llm tool', 'selected text')
  eq(r.start, at, 'start')
})

// Documented limit, not a regression: once drift exceeds the distance to an earlier decoy,
// offset proximity cannot disambiguate. Fixing this class means removing the drift at source
// (getOffsetWithinStem vs flat must agree on the `×` glyph), not tuning the search.
t('KNOWN LIMIT: drift larger than the gap to an earlier decoy still mis-resolves', () => {
  const r = reconcileSelectionRangeToFlat(flat, target - 20, target - 17, 'llm')
  eq(r.start, decoy, 'start (documents current behaviour)')
})

console.log('\nmapFlatRangeToMarkdownRange -- flat offsets map back to markdown source')

// `flat` is text nodes concatenated with no separator, so none of markdown's structural
// characters (blank lines, table pipes) survive into it. The map has to bridge that gap.
function renderFlat(md) {
  const out = []
  for (const line of md.split('\n')) {
    const s = line.trim()
    if (!s) continue
    if (/^\|?\s*:?-{2,}/.test(s.replace(/\|/g, ''))) continue
    if (s.startsWith('|')) out.push(s.split('|').map((c) => c.trim()).filter(Boolean).join(''))
    else out.push(s.replace(/\*\*/g, '').replace(/`/g, ''))
  }
  return out.join('')
}

function mapsToStandaloneLlm(name, md) {
  t(name, () => {
    const f = renderFlat(md)
    const at = f.lastIndexOf('llm')
    const mapped = mapFlatRangeToMarkdownRange(md, f, at, at + 3)
    if (!mapped) throw new Error('mapping returned null')
    eq(md.slice(mapped.start, mapped.end), 'llm', 'mapped text')
    eq(mapped.start, md.lastIndexOf('llm'), 'markdown start')
  })
}

mapsToStandaloneLlm('single paragraph', 'His allmark score is noted and the llm tool is used.')

mapsToStandaloneLlm('two paragraphs (markdown has a blank line, flat has nothing)',
`A 62-year-old man is reviewed. His allmark score is recorded.

The team asks whether the llm tool should be used.`)

mapsToStandaloneLlm('stem containing a markdown table',
`A 62-year-old man attends. His allmark score is recorded on admission.

| Investigation | Result | Reference |
| --- | --- | --- |
| Haemoglobin | 121 g/L | 130-175 |
| Platelets | 189 | 150-400 |
| Sodium | 139 mmol/L | 135-145 |

The team asks whether the llm tool should be used to triage.`)

mapsToStandaloneLlm('long multi-paragraph stem',
`A 62-year-old man attends the emergency department with chest pain.

His allmark score is recorded on admission by the triage nurse.

He has a history of hypertension and type 2 diabetes mellitus.

His observations are stable and he is not in acute distress.

The consultant asks whether the llm tool should be used to triage.`)

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)

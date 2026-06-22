/**
 * Highlight helpers for question stems: DOM-ordered text, whitespace boundaries,
 * block-level splits (e.g. across <p> siblings), table cells, and mapping visible
 * offsets back to markdown source indices. Shared by practice, group practice, and textbook.
 */

/**
 * True when `div` exists only to wrap a table (practice stems often use div > table).
 * Such a div is ignored for highlight run boundaries so snapping/splitting matches table cells.
 */
export function isTableOnlyWrapperDiv(el) {
  if (!el || el.tagName !== 'DIV') return false
  const kids = el.children
  if (kids.length !== 1) return false
  return kids[0].tagName === 'TABLE'
}

function isBlockSplitElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false
  const tag = el.tagName
  if (tag === 'P' || tag === 'LI' || tag === 'BLOCKQUOTE' || tag === 'CAPTION' || tag === 'PRE' || tag === 'FIGURE') {
    return true
  }
  if (/^H[1-6]$/.test(tag)) return true
  if (tag === 'DIV' && !isTableOnlyWrapperDiv(el)) return true
  return false
}

/**
 * Stable key for splitting highlights: one run per table cell, or per block-level
 * slice outside cells (innermost p/heading/div/etc. under stem root).
 */
export function getHighlightRunKeyForTextNode(node, rootEl) {
  if (!node || node.nodeType !== Node.TEXT_NODE || !rootEl) return '__invalid__'

  const cell = node.parentElement?.closest?.('td, th')
  if (cell && rootEl.contains(cell)) return cell

  let el = node.parentElement
  while (el && el !== rootEl) {
    if (isBlockSplitElement(el)) return el
    el = el.parentElement
  }

  return '__stem_root__'
}

/**
 * Text nodes in document order (same traversal as flat text / selection offsets).
 */
/**
 * Returns true when a text node lives inside DOM that should be excluded from highlight
 * offset accounting (e.g. the `×` delete button rendered inside each `<mark>`). Without
 * this filter the `×` glyph would appear in `flat` but not in the markdown source, so any
 * selection spanning across an existing highlight would fail to map back to markdown.
 */
function isIgnoredForHighlightOffsets(node) {
  if (!node || !node.parentNode) return false
  let el = node.parentNode
  while (el && el.nodeType === 1 /* ELEMENT_NODE */) {
    if (el.hasAttribute && el.hasAttribute('data-hl-ignore')) return true
    if (el.classList && el.classList.contains('hl-mark__delete')) return true
    el = el.parentNode
  }
  return false
}

export function collectTextNodesInOrder(rootEl) {
  if (!rootEl) return []
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isIgnoredForHighlightOffsets(node)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
    },
  })
  const out = []
  let n = walker.nextNode()
  while (n) {
    out.push(n)
    n = walker.nextNode()
  }
  return out
}

/**
 * Walk text nodes in document order (same as selection / TreeWalker for offsets).
 */
export function getFlatTextFromStem(rootEl) {
  return collectTextNodesInOrder(rootEl)
    .map((node) => node.textContent || '')
    .join('')
}

/**
 * Contiguous runs of text for highlight splitting: each `td` / `th` is its own run.
 * Outside cells, runs break on block boundaries (e.g. consecutive `<p>` elements) so
 * a selection snaps per block and never merges across elements. Table-only wrapper `div`s
 * are transparent (see `isTableOnlyWrapperDiv`).
 */
export function buildTextRunsForTableSplitFromTextNodes(textNodesOrdered, rootEl) {
  if (!rootEl || !textNodesOrdered?.length) return []

  const runs = []
  let pos = 0
  let current = null

  for (const node of textNodesOrdered) {
    const text = node.textContent || ''
    const len = text.length
    if (len === 0) continue

    const runKey = getHighlightRunKeyForTextNode(node, rootEl)

    if (current && current.runKey === runKey) {
      current.globalEnd = pos + len
    } else {
      if (current) runs.push(current)
      current = { runKey, globalStart: pos, globalEnd: pos + len }
    }
    pos += len
  }
  if (current) runs.push(current)
  return runs
}

function runTouchesTableCell(run) {
  if (!run || typeof run.runKey !== 'object' || !run.runKey) return false
  const t = run.runKey.tagName
  return t === 'TD' || t === 'TH'
}

/**
 * Trim [start, end) to exclude leading and trailing whitespace (e.g. double-click often
 * includes a trailing space in the range).
 */
export function trimFlatRange(flat, start, end) {
  if (flat == null || start == null || end == null) return { start: 0, end: 0 }
  let a = Math.min(start, end)
  let b = Math.max(start, end)
  a = Math.max(0, Math.min(a, flat.length))
  b = Math.max(0, Math.min(b, flat.length))
  if (a >= b) return { start: a, end: a }
  while (a < b && /\s/.test(flat[a])) a++
  while (b > a && /\s/.test(flat[b - 1])) b--
  return { start: a, end: b }
}

/**
 * `Range` offsets in the DOM for double-clicked text can be off by a few code units vs the
 * concatenated `flat` string (e.g. marks, &nbsp;). Re-align to a substring in `flat` that matches
 * the visible selection, preferring a match near the original offsets, then `splitFlatRange`
 * + `snapRangeToWhitespaceBoundaries` can apply the correct [start, end) word.
 */
export function reconcileSelectionRangeToFlat(flat, rawLo, rawHi, selectedText) {
  const lo0 = Math.min(rawLo, rawHi)
  const hi0 = Math.max(rawLo, rawHi)
  if (typeof flat !== 'string' || lo0 < 0 || hi0 > flat.length || lo0 >= hi0) {
    return { start: lo0, end: hi0 }
  }
  const nbs = (s) => (s == null ? '' : String(s)).replace(/\u00a0/g, ' ')
  const nFlat = nbs(flat)
  const s = nbs(String(selectedText))
  if (nFlat.slice(lo0, hi0) === s) return { start: lo0, end: hi0 }
  const t = s.trim()
  if (!t) return { start: lo0, end: hi0 }
  if (nFlat.slice(lo0, lo0 + t.length) === t) return { start: lo0, end: lo0 + t.length }
  const r = 48
  const from = Math.max(0, lo0 - r)
  const to = Math.min(nFlat.length, lo0 + r)
  const w = nFlat.slice(from, to)
  const local = w.indexOf(t)
  if (local !== -1) {
    const start = from + local
    return { start, end: start + t.length }
  }
  let best = -1
  let bestD = Infinity
  for (let p = 0; p <= nFlat.length - t.length; p++) {
    if (nFlat.slice(p, p + t.length) !== t) continue
    const d = Math.abs(p - lo0)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  if (best !== -1) return { start: best, end: best + t.length }
  return { start: lo0, end: hi0 }
}

/**
 * Split a [rawStart, rawEnd) selection into one or more ranges when it crosses `td`/`th`
 * boundaries or block-level boundaries (`p`, headings, list items, non–table-only `div`, etc.).
 * If the stem has no table cells, the selection is first snapped to whitespace on the *full* flat
 * string (so a word is not left split across `mark`/text boundaries), then clipped to each run.
 * If the stem has any `td`/`th` text, snapping is per run/cell to avoid spilling in flat string.
 * Table-only wrapper `div > table` does not add an extra split.
 *
 * @param {string} flat - Must match concatenation of text nodes used for offsets (see getFlatTextFromStem).
 * @param {Text[]} [textNodesOverride] - Optional (e.g. textbook blocks that filter ignored nodes).
 * @param {{ skipGlobalWordSnap?: boolean }} [options] - If `skipGlobalWordSnap`, the trimmed
 *   selection is not expanded on the full flat string.
 */
export function splitFlatRangeByTableCellsAndSnap(
  rootEl,
  flat,
  rawStart,
  rawEnd,
  textNodesOverride = null,
  options = null
) {
  if (rawStart == null || rawEnd == null) return []
  if (typeof flat !== 'string' || !flat.length) return []

  const lo = Math.min(rawStart, rawEnd)
  const hi = Math.max(rawStart, rawEnd)
  if (lo >= hi) return []

  const { skipGlobalWordSnap = false } = options || {}
  const trimmed = trimFlatRange(flat, lo, hi)
  if (trimmed.start >= trimmed.end) return []

  const nodes = textNodesOverride || collectTextNodesInOrder(rootEl)
  const runs = buildTextRunsForTableSplitFromTextNodes(nodes, rootEl)
  if (runs.length === 0) return []

  const lineIntervals = getLineCharIntervalsForTextNodes(nodes, rootEl)

  // Snap is performed per block-level run (`<p>`, `<li>`, table cell, …) so word expansion
  // never bleeds across siblings: the flat string concatenates text nodes with no separator
  // between adjacent `<p>` elements, so a global snap would walk into the next paragraph.
  const out = []
  for (const run of runs) {
    const clipStart = Math.max(trimmed.start, run.globalStart)
    const clipEnd = Math.min(trimmed.end, run.globalEnd)
    if (clipStart >= clipEnd) continue

    if (skipGlobalWordSnap) {
      out.push({ start: clipStart, end: clipEnd })
      continue
    }

    const slice = flat.slice(run.globalStart, run.globalEnd)
    if (!slice.length) continue

    const ov = getLineIntervalsOverlappingRun(lineIntervals, run.globalStart, run.globalEnd)
    const localIntervals = ov && ov.length > 0 ? ov : [[0, slice.length]]
    const localA = clipStart - run.globalStart
    const localB = clipEnd - run.globalStart
    const segs = snapToWhitespaceInLineIntervals(slice, localA, localB, localIntervals)
    for (const seg of segs) {
      const gStart = run.globalStart + seg.start
      const gEnd = run.globalStart + seg.end
      if (gStart < gEnd) out.push({ start: gStart, end: gEnd })
    }
  }

  return out
}

/**
 * Expand [start, end) so the character before start is whitespace or start===0,
 * and the character at end is whitespace or end===length (whitespace-delimited "tokens").
 */
export function snapRangeToWhitespaceBoundaries(text, start, end) {
  if (text == null || start == null || end == null) return { start, end }
  let s = Math.max(0, Math.min(start, text.length))
  let e = Math.max(s, Math.min(end, text.length))
  while (s > 0 && /\S/.test(text[s - 1])) s--
  while (e < text.length && /\S/.test(text[e])) e++
  return { start: s, end: e }
}

/**
 * Expand [start, end) by at most one neighbouring whitespace character on each side, *only*
 * when that char is whitespace. Caller must have already snapped the range to word boundaries
 * (e.g. via `splitFlatRangeByTableCellsAndSnap`); this helper does NOT walk past the first
 * non-whitespace, so it cannot bleed across `<p>`/`<li>` boundaries (where flat string has no
 * separator between adjacent blocks).
 */
export function padRangeWithBoundarySpaces(text, start, end) {
  if (text == null || start == null || end == null) return { start, end }
  let s = Math.max(0, Math.min(start, text.length))
  let e = Math.max(s, Math.min(end, text.length))
  if (s > 0 && /\s/.test(text[s - 1])) s -= 1
  if (e < text.length && /\s/.test(text[e])) e += 1
  return { start: s, end: e }
}

/**
 * Count <br> elements in the (half-open) DOM path from end of text node a to start of b.
 * Used so a line break inside a <td> / paragraph acts like a hard boundary (like a space) for highlights.
 */
function countBrBetweenConsecutiveTextNodes(a, b, rootEl) {
  if (!a || !b || a === b || !rootEl?.contains(a) || !rootEl?.contains(b)) return 0
  try {
    const doc = a.ownerDocument
    if (!doc?.createRange) return 0
    const alen = (a.textContent || '').length
    const r = doc.createRange()
    r.setStart(a, alen)
    r.setEnd(b, 0)
    if (r.collapsed) return 0
    const frag = r.cloneContents()
    if (frag && typeof frag.querySelectorAll === 'function') {
      return frag.querySelectorAll('br').length
    }
  } catch {
    return 0
  }
  return 0
}

/**
 * Partition the concatenated `flat` string (text nodes, no <br> chars) into [start,end) line spans
 * at each <br> between consecutive text nodes. One interval covers the full flat when there are
 * no <br> boundaries.
 */
export function getLineCharIntervalsForTextNodes(textNodes, rootEl) {
  if (!textNodes || textNodes.length === 0) return [[0, 0]]
  const intervals = []
  let at = 0
  let lineStart = 0
  for (let i = 0; i < textNodes.length; i++) {
    at += (textNodes[i].textContent || '').length
    if (i < textNodes.length - 1) {
      const nBr = countBrBetweenConsecutiveTextNodes(textNodes[i], textNodes[i + 1], rootEl)
      if (nBr > 0) {
        intervals.push([lineStart, at])
        lineStart = at
      }
    }
  }
  intervals.push([lineStart, at])
  return intervals
}

function getLineIntervalsOverlappingRun(globalIntervals, runStart, runEnd) {
  const out = []
  for (const [L0, L1] of globalIntervals) {
    const a = Math.max(L0, runStart)
    const b = Math.min(L1, runEnd)
    if (a < b) out.push([a - runStart, b - runStart])
  }
  return out
}

/**
 * Word-snap in flat space, but <br> line boundaries act like a space: expansion stays on one line.
 * A selection that spans a line may produce multiple ranges (one per line).
 * @param {number[][]} lineIntervals - half-open [L0, L1) in the same `flat` coordinates as a, b
 * @returns {{ start: number, end: number }[]}
 */
function snapToWhitespaceInLineIntervals(flat, a, b, lineIntervals) {
  if (a == null || b == null || a > b) return []
  a = Math.max(0, Math.min(a, flat.length))
  b = Math.max(a, Math.min(b, flat.length))
  if (a >= b) return []
  if (!lineIntervals || lineIntervals.length === 0) {
    return [snapRangeToWhitespaceBoundaries(flat, a, b)]
  }
  const result = []
  let p = a
  let guard = 0
  while (p < b && guard++ < 2000) {
    const line = lineIntervals.find(([L0, L1]) => p >= L0 && p < L1)
    if (!line) {
      const g = snapRangeToWhitespaceBoundaries(flat, p, b)
      if (g.start < g.end) result.push(g)
      break
    }
    const L0 = line[0]
    const L1 = line[1]
    const endSeg = Math.min(b, L1)
    if (p >= endSeg) {
      p = endSeg
      continue
    }
    const sub = flat.slice(L0, L1)
    const g0 = snapRangeToWhitespaceBoundaries(sub, p - L0, endSeg - L0)
    const g = { start: L0 + g0.start, end: L0 + g0.end }
    if (g.start < g.end) result.push(g)
    p = endSeg
  }
  return result
}

/**
 * Build one markdown index per visible character (what the user sees), for common stem syntax:
 * - **bold**
 * - *italic* (single asterisk pair, not **)
 * - `code`
 */
export function buildVisibleCharToMarkdownStart(md) {
  if (!md) return []
  const map = []
  let i = 0
  const len = md.length

  while (i < len) {
    // Bold ** ... **
    if (md.slice(i, i + 2) === '**') {
      i += 2
      while (i < len && md.slice(i, i + 2) !== '**') {
        map.push(i)
        i++
      }
      if (md.slice(i, i + 2) === '**') i += 2
      continue
    }
    // Inline code ` ... `
    if (md[i] === '`') {
      i++
      while (i < len && md[i] !== '`') {
        map.push(i)
        i++
      }
      if (md[i] === '`') i++
      continue
    }
    // Italic * ... * — avoid list markers (* or + or - at line start followed by space)
    if (
      md[i] === '*' &&
      md[i + 1] !== '*' &&
      md[i + 1] !== ' ' &&
      md[i + 1] !== '\t' &&
      md[i + 1] !== '\n'
    ) {
      i++
      while (i < len && md[i] !== '*') {
        map.push(i)
        i++
      }
      if (md[i] === '*') i++
      continue
    }
    map.push(i)
    i++
  }
  return map
}

function normalizeForHighlightMatch(s) {
  return (s == null ? '' : String(s)).replace(/\u00a0/g, ' ')
}

/**
 * Find `needle` in `haystack`, preferring the occurrence closest to `preferIndex`
 * (avoids mapping a selection to the first duplicate word on the page).
 */
export function findClosestSubstringIndex(haystack, needle, preferIndex = 0) {
  if (typeof haystack !== 'string' || typeof needle !== 'string') return -1
  const n = needle.length
  if (n === 0 || n > haystack.length) return -1

  const prefer = Math.max(0, Math.min(preferIndex, haystack.length - n))
  if (haystack.slice(prefer, prefer + n) === needle) return prefer

  let best = -1
  let bestDist = Infinity
  for (let p = 0; p <= haystack.length - n; p++) {
    if (haystack.slice(p, p + n) !== needle) continue
    const d = Math.abs(p - preferIndex)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  return best
}

/**
 * Map a [snapStart, snapEnd) range in rendered/flat text to markdown source offsets.
 * Returns null if mapping is inconsistent and caller should fall back.
 */
export function mapFlatRangeToMarkdownRange(markdown, flat, snapStart, snapEnd) {
  if (snapStart >= snapEnd) return null
  const snippet = flat.slice(snapStart, snapEnd)
  if (!snippet) return null

  const map = buildVisibleCharToMarkdownStart(markdown)
  const plainFromLexer = map.map((idx) => markdown[idx]).join('')

  const preferPlain =
    flat.length > 0 && plainFromLexer.length !== flat.length
      ? Math.round((snapStart / flat.length) * plainFromLexer.length)
      : snapStart

  if (map.length === flat.length && snapEnd <= flat.length) {
    const visibleSlice = plainFromLexer.slice(snapStart, snapEnd)
    if (
      visibleSlice === snippet ||
      normalizeForHighlightMatch(visibleSlice) === normalizeForHighlightMatch(snippet)
    ) {
      const mdStart = map[snapStart]
      const mdEnd = snapEnd < map.length ? map[snapEnd] : markdown.length
      return { start: mdStart, end: mdEnd }
    }
  }

  const p0 = findClosestSubstringIndex(plainFromLexer, snippet, preferPlain)
  if (p0 !== -1 && p0 + snippet.length <= map.length) {
    const mdStart = map[p0]
    const mdEnd = p0 + snippet.length < map.length ? map[p0 + snippet.length] : markdown.length
    return { start: mdStart, end: mdEnd }
  }

  const preferMd =
    preferPlain < map.length ? map[preferPlain] : Math.min(Math.max(0, preferPlain), markdown.length - 1)

  const idx = findClosestSubstringIndex(markdown, snippet, preferMd)
  if (idx !== -1) return { start: idx, end: idx + snippet.length }

  return null
}

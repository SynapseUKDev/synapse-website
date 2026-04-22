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
export function collectTextNodesInOrder(rootEl) {
  if (!rootEl) return []
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null)
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

/**
 * Split a [rawStart, rawEnd) selection into one or more ranges when it crosses `td`/`th`
 * boundaries or block-level boundaries (`p`, headings, list items, non–table-only `div`, etc.).
 * Each segment is snapped to whitespace boundaries within that run only (word-aligned, and
 * run edges act as hard stops). Table-only wrapper `div > table` does not add an extra split.
 *
 * @param {string} flat - Must match concatenation of text nodes used for offsets (see getFlatTextFromStem).
 * @param {Text[]} [textNodesOverride] - Optional (e.g. textbook blocks that filter ignored nodes).
 */
export function splitFlatRangeByTableCellsAndSnap(
  rootEl,
  flat,
  rawStart,
  rawEnd,
  textNodesOverride = null
) {
  if (rawStart == null || rawEnd == null || rawStart >= rawEnd) return []
  const nodes = textNodesOverride || collectTextNodesInOrder(rootEl)
  const runs = buildTextRunsForTableSplitFromTextNodes(nodes, rootEl)
  const out = []

  for (const run of runs) {
    const clipStart = Math.max(rawStart, run.globalStart)
    const clipEnd = Math.min(rawEnd, run.globalEnd)
    if (clipStart >= clipEnd) continue

    const slice = flat.slice(run.globalStart, run.globalEnd)
    if (!slice.length) continue

    const localSnap = snapRangeToWhitespaceBoundaries(
      slice,
      clipStart - run.globalStart,
      clipEnd - run.globalStart
    )
    const gStart = run.globalStart + localSnap.start
    const gEnd = run.globalStart + localSnap.end
    if (gStart < gEnd) out.push({ start: gStart, end: gEnd })
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

  if (map.length === flat.length && snapEnd <= flat.length) {
    const mdStart = map[snapStart]
    const mdEnd = snapEnd < map.length ? map[snapEnd] : markdown.length
    return { start: mdStart, end: mdEnd }
  }

  const p0 = plainFromLexer.indexOf(snippet)
  if (p0 !== -1 && p0 + snippet.length <= map.length) {
    const mdStart = map[p0]
    const mdEnd = p0 + snippet.length < map.length ? map[p0 + snippet.length] : markdown.length
    return { start: mdStart, end: mdEnd }
  }

  let idx = markdown.indexOf(snippet)
  if (idx !== -1) return { start: idx, end: idx + snippet.length }

  return null
}

// textbookHighlights.js
// Minimal robust DOM anchoring: block-level offsets + quote + prefix/suffix fallback

export function getBlockWrapperFromSelection(sel) {
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer?.nodeType === 1
    ? range.commonAncestorContainer
    : range.commonAncestorContainer?.parentElement;
  if (!node) return null;
  return node.closest?.('[data-tb-block-id]');
}

export function computeOffsetsWithinBlock(blockEl, range) {
  // ✅ Make offsets match "textContent" deterministically (backend-friendly)
  const fullText = blockEl.textContent || '';

  const nodes = walkTextNodes(blockEl);

  const getAbsOffset = (container, offset) => {
    // Most of the time start/end containers are text nodes
    if (container?.nodeType === Node.TEXT_NODE) {
      let cur = 0;
      for (const n of nodes) {
        if (n === container) return cur + offset;
        cur += n.nodeValue.length;
      }
      return null;
    }

    // When container is an element, offset is a child index (DOM Range spec).
    // Map to the character position at that child boundary.
    const el = container?.nodeType === Node.ELEMENT_NODE ? container : container?.parentElement;
    if (!el) return null;

    const childCount = el.childNodes?.length ?? 0;
    const childIndex = Math.max(0, Math.min(offset, childCount));

    let cur = 0;
    let startOfElText = null; // character offset at start of first text node in el
    let textLengthBeforeTarget = 0; // length of text in el's children [0..childIndex-1]

    for (const n of nodes) {
      if (!el.contains(n)) {
        cur += n.nodeValue.length;
        continue;
      }
      if (startOfElText === null) startOfElText = cur;

      let idx = -1;
      for (let i = 0; i < el.childNodes.length; i++) {
        const c = el.childNodes[i];
        if (c.contains && c.contains(n)) {
          idx = i;
          break;
        }
      }
      if (idx === -1) idx = 0;

      const len = n.nodeValue.length;
      if (idx < childIndex) textLengthBeforeTarget += len;
      cur += len;
    }

    if (startOfElText === null) return null;
    return startOfElText + textLengthBeforeTarget;
  };

  const start = getAbsOffset(range.startContainer, range.startOffset);
  const end = getAbsOffset(range.endContainer, range.endOffset);

  if (start == null || end == null) {
    const quote = range.toString();
    return {
      fullText,
      start: 0,
      end: Math.min(fullText.length, quote.length),
      quote,
      prefix: '',
      suffix: fullText.slice(Math.min(fullText.length, quote.length), Math.min(fullText.length, quote.length + 30)),
    };
  }

  const quote = range.toString();
  const prefix = fullText.slice(Math.max(0, start - 30), start);
  const suffix = fullText.slice(end, Math.min(fullText.length, end + 30));

  return { fullText, start, end, quote, prefix, suffix };
}


function walkTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

export function rangeFromOffsets(blockEl, startOffset, endOffset) {
  const nodes = walkTextNodes(blockEl);
  let current = 0;

  let startNode = null, startNodeOffset = 0;
  let endNode = null, endNodeOffset = 0;

  for (const node of nodes) {
    const len = node.nodeValue.length;

    if (!startNode && current + len >= startOffset) {
      startNode = node;
      startNodeOffset = Math.max(0, startOffset - current);
    }

    if (current + len >= endOffset) {
      endNode = node;
      endNodeOffset = Math.max(0, endOffset - current);
      break;
    }

    current += len;
  }

  if (!startNode || !endNode) return null;

  const r = document.createRange();
  r.setStart(startNode, startNodeOffset);
  r.setEnd(endNode, endNodeOffset);
  return r;
}

export function unwrapAllUserHighlights(container) {
  // 1) unwrap wrappers (new structure)
  const wraps = container.querySelectorAll('span.tb-hl-wrap');
  wraps.forEach((w) => {
    const parent = w.parentNode;

    // Prefer unwrapping the mark content only
    const mark = w.querySelector('mark.tb-user-mark');
    if (mark) {
      while (mark.firstChild) parent.insertBefore(mark.firstChild, w);
    } else {
      // Fallback: move all non-button children out
      [...w.childNodes].forEach((n) => {
        if (n.nodeType === 1 && n.matches?.('button.tb-hl-x')) return;
        parent.insertBefore(n, w);
      });
    }

    parent.removeChild(w);
    parent.normalize();
  });

  // 2) safety: unwrap any leftover marks (old structure)
  const marks = container.querySelectorAll('mark.tb-user-mark');
  marks.forEach((m) => {
    const parent = m.parentNode;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    parent.normalize();
  });
}

export function applyHighlightToRange(range, highlight) {
  const mark = document.createElement('mark');
  mark.className = `tb-user-mark tb-user-mark--${highlight.color}`;
  mark.dataset.hlId = highlight.id;
  if (highlight.note) mark.dataset.note = highlight.note;

  const wrap = document.createElement('span');
  wrap.className = 'tb-hl-wrap';

  try {
    range.surroundContents(mark);
  } catch {
    const frag = range.extractContents();
    mark.appendChild(frag);
    range.insertNode(mark);
  }

  const parent = mark.parentNode;
  if (!parent) return false;

  parent.insertBefore(wrap, mark);
  wrap.appendChild(mark);

  return true;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findBestOffsets(blockText, h) {
  if (!blockText) return null;

  const quote = h.quote != null ? String(h.quote) : '';
  const len = blockText.length;

  // 1) Prefer stored offsets from when the user originally selected the text.
  if (typeof h.start_offset === 'number' && typeof h.end_offset === 'number') {
    let start = h.start_offset;
    let end = h.end_offset;

    // Normalise and clamp into range
    if (end < start) [start, end] = [end, start];
    start = Math.max(0, Math.min(len, start));
    end = Math.max(start, Math.min(len, end));

    if (start < end) {
      return { start, end };
    }
  }

  // 2) Exact quote match (for very old highlights without offsets)
  if (quote) {
    const idx = blockText.indexOf(quote);
    if (idx !== -1) return { start: idx, end: idx + quote.length };
  }

  // 3) Context match prefix + quote + suffix (keep whitespace so boundaries stay accurate)
  const prefix = h.prefix != null ? String(h.prefix) : '';
  const suffix = h.suffix != null ? String(h.suffix) : '';
  const combo = `${prefix}${quote}${suffix}`;
  if (combo && quote) {
    const idx2 = blockText.indexOf(combo);
    if (idx2 !== -1) {
      const start = idx2 + prefix.length;
      const end = start + quote.length;
      if (start < end) return { start, end };
    }
  }

  // 4) Whitespace‑tolerant regex fallback
  if (quote) {
    const norm = (s) => String(s).trim().replace(/\s+/g, ' ');
    const normQuote = norm(quote);
    if (normQuote.length > 0) {
      const re = new RegExp(normQuote.split(/\s+/).map(escapeRegExp).join('\\s+'), 'i');
      const match = blockText.match(re);
      if (match && match.index !== undefined) {
        return { start: match.index, end: match.index + match[0].length };
      }
    }
  }

  return null;
}

/**
 * Decode one HTML entity or plain char; returns { decoded, consumed }.
 * So DOM textContent (decoded) matches our fullText and offsets don't shift in tables/cells.
 */
function decodeOne(html, i) {
  if (html[i] !== '&' || i >= html.length - 1) {
    return { decoded: html[i] ?? '', consumed: 1 };
  }
  const rest = html.slice(i + 1);
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: '\u00A0' };
  const m = rest.match(/^([a-z]+);/i) || rest.match(/^#(\d+);/) || rest.match(/^#x([0-9a-f]+);/i);
  if (m) {
    if (m[1].toLowerCase() in named) {
      return { decoded: named[m[1].toLowerCase()], consumed: m[0].length + 1 };
    }
    if (m[1].match(/^\d+$/)) {
      const code = parseInt(m[1], 10);
      return { decoded: code <= 0xffff ? String.fromCodePoint(code) : '', consumed: m[0].length + 1 };
    }
    if (m[1].match(/^[0-9a-f]+$/i)) {
      const code = parseInt(m[1], 16);
      return { decoded: code <= 0xffff ? String.fromCodePoint(code) : '', consumed: m[0].length + 1 };
    }
  }
  return { decoded: '&', consumed: 1 };
}

/** Normalize line endings to match DOM textContent (browsers collapse \r\n and \r to \n). */
function normalizeLineEndings(s) {
  return String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Decode HTML segment to plain text (so length matches DOM textContent). */
function decodeSegment(htmlSegment) {
  let out = '';
  let i = 0;
  while (i < htmlSegment.length) {
    const { decoded, consumed } = decodeOne(htmlSegment, i);
    out += decoded;
    i += consumed;
  }
  return normalizeLineEndings(out);
}

/** Count normalized decoded length (one newline for \r\n or \r so we match DOM). */
function normalizedDecodedLength(decoded) {
  const n = normalizeLineEndings(decoded);
  return n.length;
}

/** Map decoded character offset within an HTML segment to raw byte offset (for insertion). */
function decodedOffsetToHtmlOffset(htmlSegment, decodedOffset) {
  let dec = 0;
  let i = 0;
  while (i < htmlSegment.length && dec < decodedOffset) {
    const { decoded, consumed } = decodeOne(htmlSegment, i);
    dec += normalizedDecodedLength(decoded);
    i += consumed;
  }
  return i;
}

/**
 * Extract plain text from HTML and segment mapping (text offset -> html offset).
 * Uses decoded text so fullText matches DOM textContent (fixes shift in tables/entities).
 * Returns { fullText, segments } where each segment is { textStart, textEnd, htmlStart, htmlEnd } (exclusive end).
 */
function getTextSegmentsFromHtml(html) {
  const segments = [];
  let fullText = '';
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i + 1);
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    const start = i;
    let raw = '';
    while (i < html.length && html[i] !== '<') {
      raw += html[i];
      i++;
    }
    if (raw.length > 0) {
      const textStart = fullText.length;
      const decoded = decodeSegment(raw);
      fullText += decoded;
      segments.push({
        textStart,
        textEnd: fullText.length,
        htmlStart: start,
        htmlEnd: start + raw.length,
      });
    }
  }
  return { fullText, segments };
}

function getHtmlOffset(segments, textOffset, totalTextLen, html) {
  if (textOffset <= 0) return segments[0] ? segments[0].htmlStart : 0;
  if (textOffset >= totalTextLen && segments.length > 0 && html) {
    const s = segments[segments.length - 1];
    const raw = html.slice(s.htmlStart, s.htmlEnd);
    return s.htmlStart + decodedOffsetToHtmlOffset(raw, s.textEnd - s.textStart);
  }
  for (const s of segments) {
    if (s.textStart <= textOffset && textOffset < s.textEnd && html) {
      const raw = html.slice(s.htmlStart, s.htmlEnd);
      const decOff = textOffset - s.textStart;
      return s.htmlStart + decodedOffsetToHtmlOffset(raw, decOff);
    }
    if (s.textStart < textOffset && textOffset <= s.textEnd && html) {
      const raw = html.slice(s.htmlStart, s.htmlEnd);
      const decOff = textOffset - s.textStart;
      return s.htmlStart + decodedOffsetToHtmlOffset(raw, decOff);
    }
  }
  return segments[0] ? segments[0].htmlStart : 0;
}

/**
 * Inject user highlight markup into HTML string so React can render it as the normal state.
 * Wraps only within each text segment so we never put tags (e.g. </li><li>) inside <mark>,
 * which fixes broken layout with bullet lists and tables.
 * Returns new HTML with <span class="tb-hl-wrap"><mark class="tb-user-mark ..." data-hl-id="...">...</mark></span>.
 */
export function injectUserHighlightsIntoHtml(html, highlights) {
  if (!html || !highlights?.length) return html;

  const { fullText, segments } = getTextSegmentsFromHtml(html);
  if (!fullText) return html;

  // Build insertions per segment so we never wrap across tag boundaries (fixes lists/tables)
  const insertions = []; // { pos, isClose, openTag?, closeTag? }
  for (const h of highlights) {
    const offsets = findBestOffsets(fullText, h);
    if (!offsets) continue;

    const color = (h.color && /^[a-z]+$/.test(h.color)) ? h.color : 'yellow';
    const id = String(h.id || '').replace(/"/g, '&quot;');
    const openTag = `<span class="tb-hl-wrap"><mark class="tb-user-mark tb-user-mark--${color}" data-hl-id="${id}">`;
    const closeTag = '</mark></span>';

    for (const seg of segments) {
      const segStart = Math.max(seg.textStart, offsets.start);
      const segEnd = Math.min(seg.textEnd, offsets.end);
      if (segStart >= segEnd) continue;

      const rawSeg = html.slice(seg.htmlStart, seg.htmlEnd);
      const htmlSegStart = seg.htmlStart + decodedOffsetToHtmlOffset(rawSeg, segStart - seg.textStart);
      const htmlSegEnd = seg.htmlStart + decodedOffsetToHtmlOffset(rawSeg, segEnd - seg.textStart);
      if (htmlSegStart >= htmlSegEnd) continue; // avoid empty wraps (can render as thin bar)

      // skip whitespace-only segments so we don't get a leading bar or extra highlight around punctuation
      const slice = fullText.slice(segStart, segEnd);
      if (/^\s*$/.test(slice)) continue;

      insertions.push({ pos: htmlSegEnd, isClose: true, closeTag });
      insertions.push({ pos: htmlSegStart, isClose: false, openTag });
    }
  }
  insertions.sort((a, b) => b.pos - a.pos);

  let result = html;
  for (const ins of insertions) {
    const tag = ins.isClose ? ins.closeTag : ins.openTag;
    result = result.slice(0, ins.pos) + tag + result.slice(ins.pos);
  }
  return result;
}

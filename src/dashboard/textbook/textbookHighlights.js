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

    // Fallback: try to locate nearest text node
    const el = container?.nodeType === Node.ELEMENT_NODE ? container : container?.parentElement;
    if (!el) return null;

    let cur = 0;
    for (const n of nodes) {
      if (el.contains(n)) {
        // if offset is 0 treat as start of this element's text
        // if offset > 0, we can't map child-index precisely, so best-effort
        return cur;
      }
      cur += n.nodeValue.length;
    }
    return null;
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
  const quote = h.quote != null ? String(h.quote) : '';
  if (!quote || !blockText) return null;

  // 1) offsets are best if within range and quote matches
  if (typeof h.start_offset === 'number' && typeof h.end_offset === 'number' && h.end_offset <= blockText.length) {
    const slice = blockText.slice(h.start_offset, h.end_offset);
    if (slice === quote) return { start: h.start_offset, end: h.end_offset };
  }

  // 2) exact quote match
  const idx = blockText.indexOf(quote);
  if (idx !== -1) return { start: idx, end: idx + quote.length };

  // 3) context match prefix+quote+suffix
  const prefix = h.prefix != null ? String(h.prefix) : '';
  const suffix = h.suffix != null ? String(h.suffix) : '';
  const combo = `${prefix}${quote}${suffix}`.trim();
  if (combo) {
    const idx2 = blockText.indexOf(combo);
    if (idx2 !== -1) {
      const start = idx2 + prefix.length;
      return { start, end: start + quote.length };
    }
  }

  // 4) whitespace-tolerant: collapse runs of whitespace to single space, then find
  const norm = (s) => String(s).trim().replace(/\s+/g, ' ');
  const normBlock = norm(blockText);
  const normQuote = norm(quote);
  if (normQuote.length > 0) {
    const re = new RegExp(normQuote.split(/\s+/).map(escapeRegExp).join('\\s+'), 'i');
    const match = blockText.match(re);
    if (match && match.index !== undefined) {
      return { start: match.index, end: match.index + match[0].length };
    }
  }

  return null;
}

/**
 * Extract plain text from HTML and segment mapping (text offset -> html offset).
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
    let text = '';
    while (i < html.length && html[i] !== '<') {
      text += html[i];
      i++;
    }
    if (text.length > 0) {
      const textStart = fullText.length;
      fullText += text;
      segments.push({
        textStart,
        textEnd: fullText.length,
        htmlStart: start,
        htmlEnd: start + text.length,
      });
    }
  }
  return { fullText, segments };
}

function getHtmlOffset(segments, textOffset, totalTextLen) {
  if (textOffset <= 0) return segments[0] ? segments[0].htmlStart : 0;
  if (textOffset >= totalTextLen && segments.length > 0) {
    const s = segments[segments.length - 1];
    return s.htmlEnd;
  }
  for (const s of segments) {
    if (s.textStart <= textOffset && textOffset < s.textEnd) {
      return s.htmlStart + (textOffset - s.textStart);
    }
    if (s.textStart < textOffset && textOffset <= s.textEnd) {
      return s.htmlStart + (textOffset - s.textStart);
    }
  }
  return segments[0] ? segments[0].htmlStart : 0;
}

/**
 * Inject user highlight markup into HTML string so React can render it as the normal state.
 * Returns new HTML with <span class="tb-hl-wrap"><mark class="tb-user-mark ..." data-hl-id="...">...</mark></span>.
 */
export function injectUserHighlightsIntoHtml(html, highlights) {
  if (!html || !highlights?.length) return html;

  const { fullText, segments } = getTextSegmentsFromHtml(html);
  if (!fullText) return html;

  const insertions = [];
  for (const h of highlights) {
    const offsets = findBestOffsets(fullText, h);
    if (!offsets) continue;
    const htmlStart = getHtmlOffset(segments, offsets.start, fullText.length);
    const htmlEnd = getHtmlOffset(segments, offsets.end, fullText.length);
    if (htmlStart >= htmlEnd) continue;
    insertions.push({ htmlStart, htmlEnd, h });
  }
  insertions.sort((a, b) => b.htmlStart - a.htmlStart);

  let result = html;
  for (const { htmlStart, htmlEnd, h } of insertions) {
    const color = (h.color && /^[a-z]+$/.test(h.color)) ? h.color : 'yellow';
    const id = String(h.id || '').replace(/"/g, '&quot;');
    const openTag = `<span class="tb-hl-wrap"><mark class="tb-user-mark tb-user-mark--${color}" data-hl-id="${id}">`;
    const closeTag = '</mark></span>';
    result = result.slice(0, htmlStart) + openTag + result.slice(htmlStart, htmlEnd) + closeTag + result.slice(htmlEnd);
  }
  return result;
}

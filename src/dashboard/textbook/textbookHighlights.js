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
  // Offsets are based on textContent of the block element (not HTML)
  const fullText = blockEl.innerText || blockEl.textContent || '';

  const pre = range.cloneRange();
  pre.selectNodeContents(blockEl);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;

  const pre2 = range.cloneRange();
  pre2.selectNodeContents(blockEl);
  pre2.setEnd(range.endContainer, range.endOffset);
  const end = pre2.toString().length;

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

  try {
    range.surroundContents(mark);
    return true;
  } catch {
    // If selection crosses complex nodes, fallback to extract+wrap
    const frag = range.extractContents();
    mark.appendChild(frag);
    range.insertNode(mark);
    return true;
  }
}

export function findBestOffsets(blockText, h) {
  // 1) offsets are best if within range and quote matches nearby
  if (h.start_offset >= 0 && h.end_offset <= blockText.length) {
    const slice = blockText.slice(h.start_offset, h.end_offset);
    if (slice === h.quote) return { start: h.start_offset, end: h.end_offset };
  }

  // 2) try exact quote match
  const idx = blockText.indexOf(h.quote);
  if (idx !== -1) return { start: idx, end: idx + h.quote.length };

  // 3) context match prefix+quote+suffix
  const combo = `${h.prefix || ''}${h.quote}${h.suffix || ''}`;
  const idx2 = combo.trim() ? blockText.indexOf(combo) : -1;
  if (idx2 !== -1) {
    const start = idx2 + (h.prefix || '').length;
    return { start, end: start + h.quote.length };
  }

  return null;
}

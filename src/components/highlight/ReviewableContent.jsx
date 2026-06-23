import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react'

/**
 * ReviewableContent — reusable component for reviewer text highlighting.
 *
 * Wraps any content and handles:
 * 1. Capturing text selections (mouseup → offset calculation)
 * 2. Rendering saved highlights (mark wrappers on matching text nodes)
 *
 * Offsets are always computed and applied against the same DOM element's
 * textContent, so they're guaranteed to be consistent.
 *
 * Usage:
 *   <ReviewableContent
 *     blockId="explanation:detailed"
 *     comments={reviewComments}
 *     pendingHighlight={reviewPopover}
 *     onSelect={({ quote, start_offset, end_offset, anchorRect, blockId, contentTitle }) => ...}
 *     onCommentClick={(commentId, event) => ...}
 *     enabled={true}
 *     contentKey={currentQuestion.id}
 *     contentTitle="Detailed Explanation"
 *   >
 *     {children}
 *   </ReviewableContent>
 *
 * To disable highlighting, set enabled={false} or simply don't wrap content.
 */
export default function ReviewableContent({
  children,
  blockId,
  comments = [],
  pendingHighlight = null,
  onSelect,
  onCommentClick,
  enabled = false,
  contentKey = '',
  contentTitle = '',
  className = '',
  style,
  as: Tag = 'div',
}) {
  const containerRef = useRef(null)
  const marksRef = useRef([])

  // ── Selection handler ──────────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    if (!enabled || !containerRef.current || !onSelect) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const selectedText = selection.toString()
    if (!selectedText || /^\s*$/.test(selectedText)) return

    const range = selection.getRangeAt(0)
    if (!containerRef.current.contains(range.commonAncestorContainer)) return

    // Compute offsets against this container's textContent
    let startOffset = getTextOffset(containerRef.current, range.startContainer, range.startOffset)
    let endOffset = getTextOffset(containerRef.current, range.endContainer, range.endOffset)

    if (startOffset == null || endOffset == null) return

    let start = Math.min(startOffset, endOffset)
    let end = Math.max(startOffset, endOffset)
    if (start >= end) return

    // Reconcile: verify offsets match selectedText, fix if drifted
    const containerText = containerRef.current.textContent || ''
    const reconciled = reconcileOffsets(containerText, start, end, selectedText)
    start = reconciled.start
    end = reconciled.end
    if (start >= end) return

    const rect = range.getBoundingClientRect()
    onSelect({
      quote: selectedText,
      start_offset: start,
      end_offset: end,
      anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      blockId,
      block_id: blockId,
      content_title: contentTitle
        ? `${contentTitle}: ${selectedText.slice(0, 50)}`
        : selectedText.slice(0, 80),
    })
  }, [enabled, blockId, contentTitle, onSelect])

  // Attach mouseup listener
  useEffect(() => {
    if (!enabled) return
    const handler = (e) => handleMouseUp()
    document.addEventListener('mouseup', handler)
    return () => document.removeEventListener('mouseup', handler)
  }, [enabled, handleMouseUp])

  // ── Highlight rendering via DOM manipulation ───────────────────────
  // We use useLayoutEffect so marks are applied before the browser paints,
  // avoiding a flash of un-highlighted content.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    // Clean up previous marks
    cleanupMarks(marksRef.current, container)
    marksRef.current = []

    // Collect all highlights to apply
    const blockComments = (comments || []).filter(
      (c) => c.block_id === blockId && c.start_offset != null && c.end_offset != null,
    )

    const pendingArr =
      pendingHighlight &&
      !pendingHighlight.isViewOnly &&
      pendingHighlight.block_id === blockId &&
      pendingHighlight.start_offset != null &&
      pendingHighlight.end_offset != null
        ? [
            {
              id: 'pending-review',
              start_offset: pendingHighlight.start_offset,
              end_offset: pendingHighlight.end_offset,
            },
          ]
        : []

    const allHighlights = [...blockComments, ...pendingArr]
    if (allHighlights.length === 0) return

    // Sort by start_offset descending so later DOM mutations don't shift earlier offsets
    const sorted = [...allHighlights].sort((a, b) => b.start_offset - a.start_offset)

    for (const highlight of sorted) {
      // Re-collect text nodes for each highlight (previous ones may have split nodes)
      const nodeMap = buildTextNodeMap(container)

      // Find overlapping text nodes for this highlight — process right-to-left
      for (let i = nodeMap.length - 1; i >= 0; i--) {
        const { node, start, end } = nodeMap[i]
        const overlapStart = Math.max(highlight.start_offset, start)
        const overlapEnd = Math.min(highlight.end_offset, end)
        if (overlapStart >= overlapEnd) continue

        const localStart = overlapStart - start
        const localEnd = overlapEnd - start

        let target = node
        // Split after the highlighted portion first (so localStart index stays valid)
        if (localEnd < target.textContent.length) {
          target.splitText(localEnd)
        }
        // Split before the highlighted portion
        if (localStart > 0) {
          target = target.splitText(localStart)
        }

        // Create wrapper + mark
        const wrapper = document.createElement('span')
        wrapper.className = 'highlight-wrapper'
        wrapper.setAttribute('data-highlight-id', String(highlight.id))

        const mark = document.createElement('mark')
        mark.className = 'rv-mark'
        mark.setAttribute('data-highlight-id', String(highlight.id))

        wrapper.appendChild(mark)
        target.parentNode.replaceChild(wrapper, target)
        mark.appendChild(target)

        // Click handler for existing comments
        if (onCommentClick && highlight.id !== 'pending-review') {
          wrapper.style.cursor = 'pointer'
          const hId = highlight.id
          wrapper.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            onCommentClick(hId, e)
          })
        }

        marksRef.current.push(wrapper)
      }
    }

    return () => {
      cleanupMarks(marksRef.current, container)
      marksRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, pendingHighlight, blockId, enabled, contentKey, onCommentClick])

  return (
    <Tag
      ref={containerRef}
      className={className || undefined}
      style={style}
      data-review-block={blockId}
    >
      {children}
    </Tag>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Compute the character offset of a selection endpoint within rootEl's textContent.
 * Uses Range comparison for ELEMENT_NODE targets, which is more reliable than
 * manual document-position checks across block boundaries.
 */
function getTextOffset(root, targetNode, nodeOffset) {
  if (!root || !targetNode) return null

  // Filter out text inside highlight delete buttons / ignore markers
  const isIgnored = (n) => {
    let el = n && n.parentNode
    while (el && el.nodeType === 1) {
      if (
        el.classList &&
        (el.classList.contains('hl-mark__delete') || el.classList.contains('rv-mark__delete'))
      )
        return true
      if (el.hasAttribute && el.hasAttribute('data-hl-ignore')) return true
      el = el.parentNode
    }
    return false
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      return isIgnored(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })

  if (targetNode.nodeType === Node.TEXT_NODE) {
    let pos = 0
    let node = walker.nextNode()
    while (node) {
      if (node === targetNode) return pos + nodeOffset
      pos += node.textContent.length
      node = walker.nextNode()
    }
    return null
  }

  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    // Create a collapsed range at the selection point and compare against text nodes
    const pointRange = document.createRange()
    try {
      pointRange.setStart(targetNode, nodeOffset)
      pointRange.collapse(true)
    } catch {
      return null
    }

    let pos = 0
    let node = walker.nextNode()
    while (node) {
      const nodeRange = document.createRange()
      nodeRange.selectNodeContents(node)
      // If the selection point is before or at the start of this text node
      try {
        if (pointRange.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0) {
          return pos
        }
      } catch {
        // compareBoundaryPoints can throw if nodes are in different documents
      }
      pos += node.textContent.length
      node = walker.nextNode()
    }
    // If we've walked past all text nodes, the point is at the end
    return pos
  }

  return null
}

/**
 * Verify that textContent.slice(start, end) matches selectedText.
 * If not, search for selectedText near the computed offsets and correct.
 */
function reconcileOffsets(containerText, start, end, selectedText) {
  if (!containerText || start >= end) return { start, end }

  const computed = containerText.slice(start, end)
  const trimmedSelected = selectedText.trim()

  // Normalise non-breaking spaces for comparison
  const norm = (s) => (s || '').replace(/\u00a0/g, ' ')

  if (norm(computed) === norm(selectedText) || norm(computed) === norm(trimmedSelected)) {
    return { start, end }
  }

  // Check if trimmed selection matches at the start offset
  if (
    norm(containerText.slice(start, start + trimmedSelected.length)) === norm(trimmedSelected)
  ) {
    return { start, end: start + trimmedSelected.length }
  }

  // Search in a window around the expected position
  const needle = norm(trimmedSelected)
  const haystack = norm(containerText)

  // Narrow window first (±64 chars)
  const windowStart = Math.max(0, start - 64)
  const windowEnd = Math.min(haystack.length, end + 64)
  const window_ = haystack.slice(windowStart, windowEnd)
  const localIdx = window_.indexOf(needle)
  if (localIdx !== -1) {
    const absStart = windowStart + localIdx
    return { start: absStart, end: absStart + trimmedSelected.length }
  }

  // Broader: find closest occurrence in the entire text
  let best = -1
  let bestDist = Infinity
  for (let p = 0; p <= haystack.length - needle.length; p++) {
    if (haystack.slice(p, p + needle.length) !== needle) continue
    const d = Math.abs(p - start)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  if (best !== -1) {
    return { start: best, end: best + trimmedSelected.length }
  }

  // Give up — return original offsets
  return { start, end }
}

/**
 * Build a map of text nodes with their cumulative character offsets.
 */
function buildTextNodeMap(root) {
  const nodes = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  let offset = 0
  let node = walker.nextNode()
  while (node) {
    const len = node.textContent.length
    if (len > 0) {
      nodes.push({ node, start: offset, end: offset + len })
      offset += len
    }
    node = walker.nextNode()
  }
  return nodes
}

/**
 * Remove mark wrappers we injected, restoring original text nodes.
 * Normalises the parent afterwards to merge split text nodes.
 */
function cleanupMarks(marks, container) {
  const parents = new Set()
  for (const wrapper of marks) {
    if (!wrapper.parentNode) continue
    parents.add(wrapper.parentNode)
    const mark = wrapper.querySelector('mark')
    const source = mark || wrapper
    while (source.firstChild) {
      wrapper.parentNode.insertBefore(source.firstChild, wrapper)
    }
    wrapper.parentNode.removeChild(wrapper)
  }
  // Merge adjacent text nodes that were split during highlighting
  for (const parent of parents) {
    if (parent && parent.normalize) {
      try {
        parent.normalize()
      } catch {
        // Ignore — parent may have been removed
      }
    }
  }
}

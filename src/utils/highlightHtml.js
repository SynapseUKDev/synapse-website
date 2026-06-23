export function applyHighlightsToHtml(htmlString, highlights) {
  if (!htmlString || !highlights || highlights.length === 0) return htmlString;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const root = doc.body;

  // Collect text nodes
  const textNodes = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while ((n = walker.nextNode())) {
    textNodes.push(n);
  }

  // Sort highlights
  const sorted = [...highlights]
    .filter(h => h.start_offset != null && h.end_offset != null)
    .sort((a, b) => a.start_offset - b.start_offset);

  let currentTextNodeIndex = 0;
  let currentTextNodeOffset = 0; // global offset of the start of the current text node
  
  // We need to apply highlights backwards so we don't mess up offsets?
  // Actually, we can split text nodes.
  // It's easier to build a new string by advancing through text nodes.
  
  return htmlString;
}

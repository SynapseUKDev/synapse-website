/** Shared textbook image extraction — keeps carousel rendering consistent across block formats. */

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitCaptionAttribution(raw) {
  const text = stripHtml(raw)
  if (!text) return { caption: '', attribution: '' }
  const parts = text.split(/\s+[–-]\s+/)
  if (parts.length < 2) return { caption: text, attribution: '' }
  return { caption: parts[0].trim(), attribution: parts.slice(1).join(' - ').trim() }
}

function normalizeItem(item) {
  return {
    url: String(item.url || '').trim(),
    alt: String(item.alt || '').trim(),
    caption: String(item.caption || '').trim(),
    attribution: String(item.attribution || '').trim(),
    license: String(item.license || '').trim(),
  }
}

export function imagesFromImageBlockData(data) {
  if (!data) return []

  if (Array.isArray(data.images) && data.images.length > 0) {
    return data.images
      .map((im) =>
        normalizeItem({
          url: im?.url || '',
          alt: im?.alt ?? '',
          caption: im?.caption ?? data.caption ?? '',
          attribution: im?.attribution ?? data.attribution ?? '',
          license: im?.license ?? data.license ?? '',
        })
      )
      .filter((im) => im.url)
  }

  if (data.url) {
    return [
      normalizeItem({
        url: data.url,
        alt: data.alt ?? '',
        caption: data.caption ?? '',
        attribution: data.attribution ?? '',
        license: data.license ?? '',
      }),
    ]
  }

  return []
}

export function imagesFromLegacyData(data) {
  if (!data) return []

  if (Array.isArray(data.composite) && data.composite.length > 0) {
    return data.composite
      .map((item) => {
        const { caption, attribution } = splitCaptionAttribution(item.caption_html || '')
        return normalizeItem({
          url: item.asset_url || '',
          alt: item.alt || '',
          caption,
          attribution,
          license: '',
        })
      })
      .filter((im) => im.url)
  }

  if (data.asset_url) {
    const { caption, attribution } = splitCaptionAttribution(data.caption_html || data.caption || '')
    return [
      normalizeItem({
        url: data.asset_url,
        alt: data.alt || '',
        caption,
        attribution,
        license: data.license || '',
      }),
    ]
  }

  return []
}

export function imagesFromHtml(content) {
  if (!content) return []
  const html = String(content)
  const images = []

  const figureRe = /<figure[^>]*>([\s\S]*?)<\/figure>/gi
  let match
  while ((match = figureRe.exec(html))) {
    const inner = match[1]
    const imgMatch = inner.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
    if (!imgMatch) continue
    const tag = imgMatch[0]
    const altMatch = tag.match(/alt=["']([^"']*)["']/i)
    const capMatch = inner.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)
    const capText = capMatch ? stripHtml(capMatch[1]) : ''
    const { caption, attribution } = splitCaptionAttribution(capText)
    images.push(
      normalizeItem({
        url: imgMatch[1],
        alt: altMatch?.[1] || '',
        caption,
        attribution,
        license: '',
      })
    )
  }

  if (images.length > 0) return images

  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((match = imgRe.exec(html))) {
    const tag = match[0]
    const altMatch = tag.match(/alt=["']([^"']*)["']/i)
    images.push(
      normalizeItem({
        url: match[1],
        alt: altMatch?.[1] || '',
        caption: '',
        attribution: '',
        license: '',
      })
    )
  }

  return images
}

export function extractImagesFromBlock(block) {
  if (!block) return []
  if (block.block_type === 'image') return imagesFromImageBlockData(block.data)

  const fromLegacy = imagesFromLegacyData(block.data)
  if (fromLegacy.length > 0) return fromLegacy

  return imagesFromHtml(block.content)
}

export function isImageOnlyHtml(content) {
  const stripped = String(content || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<label[^>]*>[\s\S]*?<\/label>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return stripped.length < 20
}

export function isLegacyImageMarkdownBlock(block) {
  if (!block || block.block_type === 'image') return false

  const images = extractImagesFromBlock(block)
  if (images.length === 0) return false

  const data = block.data || {}
  if (data.asset_type === 'image' || data.asset_url || (Array.isArray(data.composite) && data.composite.length > 0)) {
    return true
  }

  const html = block.content || ''
  if (/<figure[\s>]/i.test(html) || /<img[\s>]/i.test(html)) {
    return isImageOnlyHtml(html)
  }

  return false
}

export function shouldRenderAsImageCarousel(block) {
  if (block?.block_type === 'image') return extractImagesFromBlock(block).length > 0
  return isLegacyImageMarkdownBlock(block)
}

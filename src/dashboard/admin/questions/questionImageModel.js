/* Pure helpers for the question image gallery. */

export const MAX_IMAGES = 10
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Client-side pre-check only; the server decodes and validates every file. */
export function precheckImageFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Only PNG, JPEG and WebP images can be uploaded.'
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 8 MB or smaller.'
  return null
}

/** Editable copy of saved images (API shape) in position order. */
export function toEditableImages(images = []) {
  return [...images]
    .sort((a, b) => a.position - b.position)
    .map((image) => ({ ...image, alt: image.alt || '', caption: image.caption || '', credit: image.credit || '' }))
}

export function moveImage(images, id, offset) {
  const from = images.findIndex((image) => image.id === id)
  const to = from + offset
  if (from === -1 || to < 0 || to >= images.length) return images
  const next = [...images]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** PUT body entries: positions come from the current order. */
export function toImageUpdates(images) {
  return images.map((image, index) => ({
    id: image.id,
    position: index + 1,
    alt: image.alt.trim() || null,
    caption: image.caption.trim() || null,
    credit: image.credit.trim() || null,
  }))
}

export function imagesSnapshot(images) {
  return JSON.stringify(toImageUpdates(images))
}

/** Learner asset shape for the preview carousel. */
export function toPreviewAssets(savedImages, pendingImages = []) {
  return [
    ...savedImages.map((image) => ({
      id: image.id,
      type: 'image',
      url: image.asset_url,
      alt: image.alt || null,
      caption: image.caption || null,
      credit: image.credit || null,
    })),
    ...pendingImages.map((image) => ({
      id: image.key,
      type: 'image',
      url: image.url,
      alt: image.alt || null,
      caption: image.caption || null,
      credit: image.credit || null,
    })),
  ]
}

export function missingAltCount(images) {
  return images.filter((image) => !String(image.alt || '').trim()).length
}

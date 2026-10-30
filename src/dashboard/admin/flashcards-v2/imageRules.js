// Card image rules (shared by ImageForm and its callers); they mirror flashcardsV2MediaRoutes.ts.

// The flashcard media route's own limit (multer, MAX_IMAGE_BYTES in qbank/questionImages.ts): 8 MB.
export const MAX_IMAGE_MB = 8
const MAX_BYTES = MAX_IMAGE_MB * 1024 * 1024
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const IMAGE_LIMITS = { alt: 300, attribution: 300, license: 100, sourceUrl: 2000 }
export const ALT_HELP = 'Describe the image without naming the diagnosis'
const URL_RE = /^https?:\/\/\S+$/i

/**
 * The problems with an image form's values, in field order ([] when it can be uploaded). Same rules
 * as the media route: alt 1–300 non-blank, attribution ≤ 300, licence ≤ 100, source URL http(s) ≤ 2000.
 */
export function validateImageForm({ file, alt, attribution, license, sourceUrl }) {
  const problems = []
  if (!file) problems.push('Choose an image file.')
  else if (file.type && !IMAGE_TYPES.includes(file.type)) problems.push(`${file.name} is not a PNG, JPEG or WebP image.`)
  else if (file.size > MAX_BYTES) problems.push(`${file.name} is larger than ${MAX_IMAGE_MB} MB. Resize or compress it and try again.`)
  const altText = (alt ?? '').trim()
  if (!altText) problems.push('Alt text is required.')
  else if (altText.length > IMAGE_LIMITS.alt) problems.push(`Alt text must be at most ${IMAGE_LIMITS.alt} characters.`)
  if ((attribution ?? '').trim().length > IMAGE_LIMITS.attribution)
    problems.push(`Attribution must be at most ${IMAGE_LIMITS.attribution} characters.`)
  if ((license ?? '').trim().length > IMAGE_LIMITS.license) problems.push(`Licence must be at most ${IMAGE_LIMITS.license} characters.`)
  const url = (sourceUrl ?? '').trim()
  if (url && !URL_RE.test(url)) problems.push('Source URL must start with http:// or https://.')
  else if (url.length > IMAGE_LIMITS.sourceUrl) problems.push(`Source URL must be at most ${IMAGE_LIMITS.sourceUrl} characters.`)
  return problems
}

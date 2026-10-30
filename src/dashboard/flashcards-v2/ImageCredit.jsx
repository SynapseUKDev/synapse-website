// "attribution · licence · Source" under a card image (nothing when none of them is set). Shared by the
// learner card and the admin views. The source link renders only for http(s) URLs: a javascript: or
// data: URL stored by mistake must never become a clickable href.

const SAFE_URL = /^https?:\/\//i

export default function ImageCredit({ image, className = 'fcv2a-muted fcv2a-credit' }) {
  const sourceUrl = image?.sourceUrl && SAFE_URL.test(image.sourceUrl) ? image.sourceUrl : null
  const text = [image?.attribution, image?.license].filter(Boolean).join(' · ')
  if (!text && !sourceUrl) return null
  return (
    <p className={className}>
      {text}
      {sourceUrl && (
        <>
          {text ? ' · ' : ''}
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Source
          </a>
        </>
      )}
    </p>
  )
}

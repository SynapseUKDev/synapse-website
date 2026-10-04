import React, { useState } from 'react'
import './Practice.css'

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
}

/**
 * Learner question image carousel shared by solo practice, group practice and
 * the admin preview. One image shows without navigation; several images show
 * previous/next controls, position dots and a text position indicator.
 * Parents reset it per question with a `key`.
 */
export default function QuestionAssetCarousel({ assets = [] }) {
  const images = assets.filter((asset) => asset && asset.url)
  const [index, setIndex] = useState(0)
  if (images.length === 0) return null

  const count = images.length
  const current = images[Math.min(index, count - 1)]
  const multiple = count > 1
  const go = (next) => setIndex((next + count) % count)

  return (
    <div className={`q-carousel ${multiple ? '' : 'q-carousel--single'}`} role="region" aria-label="Question images">
      {multiple && (
        <button type="button" className="qc-nav qc-prev" onClick={() => go(index - 1)} aria-label="Previous image">
          ‹
        </button>
      )}
      <figure key={current.id || current.url} className="q-asset">
        {current.type === 'image' ? (
          <div className="q-carousel__viewport">
            <img src={current.url} alt={current.alt || ''} loading="lazy" decoding="async" />
          </div>
        ) : null}
        {(current.caption || current.credit) && (
          <figcaption className="q-asset__cap">
            {current.caption && <div className="q-asset__caption">{current.caption}</div>}
            {current.credit && <div className="q-asset__credit">{current.credit}</div>}
          </figcaption>
        )}
      </figure>
      {multiple && (
        <button type="button" className="qc-nav qc-next" onClick={() => go(index + 1)} aria-label="Next image">
          ›
        </button>
      )}
      {multiple && (
        <div className="qc-dots" role="group" aria-label="Choose image">
          {images.map((image, i) => (
            <button
              key={image.id || i}
              type="button"
              className={`qc-dot ${i === index ? 'is-active' : ''}`}
              aria-label={`Show image ${i + 1} of ${count}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
      {multiple && (
        <span style={visuallyHidden} aria-live="polite">
          Image {index + 1} of {count}
        </span>
      )}
    </div>
  )
}

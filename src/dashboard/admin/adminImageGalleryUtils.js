export function normalizeTextbookImageItems(data) {
  if (Array.isArray(data?.images)) {
    return data.images.map((img) => ({
      url: img?.url || '',
      alt: img?.alt || '',
      caption: img?.caption || '',
      attribution: img?.attribution || '',
      license: img?.license || '',
      credit: img?.credit || '',
    }))
  }
  if (Array.isArray(data?.composite) && data.composite.length > 0) {
    return data.composite.map((item) => {
      const raw = item?.caption_html || ''
      const text = String(raw).replace(/<[^>]+>/g, '').trim()
      const parts = text.split(/\s+[–-]\s+/)
      const caption = parts.length >= 2 ? parts[0].trim() : text
      const attribution = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : ''
      return {
        url: item?.asset_url || '',
        alt: item?.alt || '',
        caption,
        attribution,
        license: '',
        credit: '',
      }
    })
  }
  if (data?.asset_url) {
    const raw = data?.caption_html || data?.caption || ''
    const text = String(raw).replace(/<[^>]+>/g, '').trim()
    const parts = text.split(/\s+[–-]\s+/)
    const caption = parts.length >= 2 ? parts[0].trim() : text
    const attribution = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : ''
    return [{
      url: data.asset_url || '',
      alt: data.alt || '',
      caption,
      attribution,
      license: data.license || '',
      credit: data.credit || '',
    }]
  }
  if (data?.url) {
    return [{
      url: data.url || '',
      alt: data.alt || '',
      caption: data.caption || '',
      attribution: data.attribution || '',
      license: data.license || '',
      credit: data.credit || '',
    }]
  }
  return []
}

export function imageItemsFromTextbookBlock(block) {
  if (!block) return []
  return normalizeTextbookImageItems(block.data || {})
}

export function questionAssetsToGalleryImages(assets) {
  return (assets || []).map((asset) => ({
    url: asset?.asset_url || asset?.url || '',
    alt: asset?.alt || '',
    caption: asset?.caption || '',
    credit: asset?.credit || '',
    attribution: '',
    license: '',
  }))
}

export function galleryImagesToQuestionAssets(images) {
  return images
    .filter((img) => String(img.url || '').trim())
    .map((img, index) => ({
      asset_type: 'image',
      asset_url: String(img.url).trim(),
      alt: img.alt?.trim() || null,
      caption: img.caption?.trim() || null,
      credit: img.credit?.trim() || null,
      position: index + 1,
    }))
}

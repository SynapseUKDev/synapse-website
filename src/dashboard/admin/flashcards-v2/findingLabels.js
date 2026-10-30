// Plain-language labels for the generator's finding codes (run errors / warnings attached to a card).
// An unknown code is shown as itself, so a new generator code is never hidden.

export const FINDING_LABELS = {
  clinical_textbook_conflict: 'Conflicts with the textbook',
  clinical_guideline_contradicted: 'Contradicts current UK guidance',
  clinical_guideline_unresolved: 'Guideline check unresolved',
  clinical_guideline_unresolved_conflict: 'Guideline conflict unresolved',
  needs_human_verification: 'Needs a human check',
  subtopic_needs_attention: 'Failed its subtopic review',
  unresolved_parent_review: 'Failed its subtopic review',
}

export function findingLabel(code) {
  return FINDING_LABELS[code] ?? String(code ?? '')
}

/** Queue chip for a needs-action card: media_pending → Needs image; needs_attention / draft → Flagged. */
export function cardKind(card) {
  return card?.qaStatus === 'media_pending' ? 'needs_image' : 'flagged'
}

export const KIND_LABELS = { flagged: 'Flagged', needs_image: 'Needs image' }

/** True when Approve must wait for a front image (the approve RPC refuses it: APPROVE_NEEDS_FRONT_IMAGE). */
export function needsFrontImage(card) {
  return !!card?.isMediaRequired && !card?.media?.front
}

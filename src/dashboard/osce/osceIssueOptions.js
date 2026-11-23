// Must match OSCE_ISSUE_CATEGORIES in synapse-backend/src/osce/osceSchemas.ts
export const OSCE_ISSUE_CATEGORY_OPTIONS = [
  { value: 'typo', label: 'Typo or grammar' },
  { value: 'unclear_content', label: 'Unclear or hard to follow' },
  { value: 'factual_error', label: 'Incorrect or outdated information' },
  { value: 'missing_content', label: 'Something is missing' },
  { value: 'broken_image_or_link', label: 'Broken image, table, or link' },
  { value: 'formatting', label: 'Layout or formatting' },
  { value: 'other', label: 'Other' },
]

export const osceIssueCategoryLabel = (value) =>
  OSCE_ISSUE_CATEGORY_OPTIONS.find((o) => o.value === value)?.label || 'Other'

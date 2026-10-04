/*
 * Pure decision rules for the bulk-import review. Valid records default to
 * included; records with duplicate warnings start undecided and need an
 * explicit choice plus acknowledgement before they can be included. Invalid
 * records can never be included.
 */

export function isInvalid(record) {
  return record.outcome === 'invalid'
}

export function hasDuplicateWarning(record) {
  return (record.warnings || []).some((warning) => String(warning.code || '').startsWith('duplicate'))
}

/** Decision state per record id, from the compact summary rows of a batch. */
export function initialDecisions(records, batchStatus) {
  const decisions = {}
  for (const record of records) {
    if (isInvalid(record)) continue
    if (batchStatus !== 'validated') {
      decisions[record.id] = { decision: record.decision, acknowledge: !!record.warnings_acknowledged }
    } else {
      decisions[record.id] = { decision: hasDuplicateWarning(record) ? 'undecided' : 'include', acknowledge: false }
    }
  }
  return decisions
}

export function setDecision(decisions, recordId, decision) {
  const current = decisions[recordId] || { acknowledge: false }
  return { ...decisions, [recordId]: { ...current, decision, acknowledge: decision === 'include' ? current.acknowledge : false } }
}

export function setAcknowledged(decisions, recordId, acknowledge) {
  return { ...decisions, [recordId]: { ...decisions[recordId], acknowledge } }
}

/** Records (by 1-based number) that still block confirmation. */
export function decisionProblems(records, decisions) {
  const undecided = []
  const unacknowledged = []
  for (const record of records) {
    if (isInvalid(record)) continue
    const state = decisions[record.id]
    if (!state || state.decision === 'undecided') undecided.push(record.source_index + 1)
    else if (state.decision === 'include' && hasDuplicateWarning(record) && !state.acknowledge) {
      unacknowledged.push(record.source_index + 1)
    }
  }
  return { undecided, unacknowledged, blocking: undecided.length + unacknowledged.length > 0 }
}

export function selectedCount(records, decisions) {
  return records.filter((record) => !isInvalid(record) && decisions[record.id]?.decision === 'include').length
}

/** Request body decisions: one per valid record, never for invalid ones. */
export function toConfirmDecisions(records, decisions) {
  return records
    .filter((record) => !isInvalid(record))
    .map((record) => ({
      record_id: record.id,
      decision: decisions[record.id]?.decision,
      acknowledge_warnings: !!decisions[record.id]?.acknowledge,
    }))
}

export const OUTCOME_LABELS = {
  invalid: 'Invalid',
  pending: 'Ready',
  processing: 'Processing',
  created: 'Created',
  failed: 'Failed',
  skipped: 'Excluded',
}

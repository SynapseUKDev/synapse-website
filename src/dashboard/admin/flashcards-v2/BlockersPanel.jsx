/** Every reason publish would be refused (computed server-side with the publish RPC's own rules). */
export default function BlockersPanel({ blockers }) {
  const list = blockers ?? []
  return (
    <section aria-label="Publish blockers" className={`fcv2a-panel ${list.length ? 'fcv2a-panel--blocked' : 'fcv2a-panel--clear'}`}>
      <h3 className="fcv2a-panel__title">Publish blockers ({list.length})</h3>
      {list.length === 0 ? (
        <p>No blockers: this run can be published.</p>
      ) : (
        <ul className="fcv2a-blockers">
          {list.map((b, i) => (
            <li key={`${b.code}:${b.semanticKey ?? ''}:${i}`}>
              <code>{b.code}</code> <span>{b.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { plainQuestion } from './plainQuestion'

// One card. The FRONT is the plain-text question and nothing else: no specialty, topic or category
// header, because a diagnosis question with its topic printed above it has already given the answer
// away. The BACK is safe GFM: raw HTML is skipped (never interpreted), links render as their text and
// images come only from the card's own `media`, never from the Markdown.

const QA_LABEL = {
  validated: 'Validated',
  needs_attention: 'Needs attention',
  media_pending: 'Awaiting image',
  draft: 'Draft QA',
  validating: 'Validating',
  rejected: 'Rejected',
}

const Heading = ({ children }) => (
  <p>
    <strong>{children}</strong>
  </p>
)

const MD_COMPONENTS = {
  a: ({ children }) => <span>{children}</span>,
  img: () => null,
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  table: ({ children }) => (
    <div className="fc2-table-wrap">
      <table>{children}</table>
    </div>
  ),
}

export function CardAnswer({ markdown }) {
  return (
    <div className="fc2-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS} skipHtml>
        {markdown || ''}
      </ReactMarkdown>
    </div>
  )
}

/** Admin-only QA/draft marker. Learner DTOs carry none of these fields, and learners never get the prop. */
function AdminBadge({ card }) {
  const draft = card.isPublished === false
  const qa = card.qaStatus && card.qaStatus !== 'validated' ? card.qaStatus : null
  if (!draft && !qa) return null
  return (
    <div className="fc2-admin-badge" aria-label="Admin preview status">
      {draft && <span className="fc2-qa">Draft</span>}
      {qa && <span className={`fc2-qa fc2-qa--${qa}`}>{QA_LABEL[qa] ?? qa}</span>}
    </div>
  )
}

export default function StudyCard({ card, revealed, showAdminBadge = false, answerRef }) {
  const media = card.media?.url ? card.media : null
  return (
    <article className="fc2-card ph-no-capture" aria-label="Flashcard">
      <div className="fc2-card__front">
        {showAdminBadge && <AdminBadge card={card} />}
        {media && <img className="fc2-card__media" src={media.url} alt={media.alt || ''} loading="lazy" />}
        <p className="fc2-question">{plainQuestion(card.question)}</p>
      </div>
      {revealed && (
        <div className="fc2-card__answer" role="region" aria-label="Answer" tabIndex={-1} ref={answerRef}>
          <CardAnswer markdown={card.answerMarkdown} />
        </div>
      )}
    </article>
  )
}

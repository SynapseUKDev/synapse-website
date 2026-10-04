import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { LuCircleCheck, LuLightbulb } from 'react-icons/lu'
import { buildQuickPoints, hasMarkdown, optionLabel, stemMarkdownComponents, toLearnerOptions } from './questionPresentationUtils'
import './Practice.css'

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
}

/*
 * Pure learner-facing question presentation shared by solo practice, group
 * practice and the admin preview. Session state, timers, attempts, highlights
 * and saving stay in the screens that own them.
 */

/** Stem without learner highlights: plain text keeps line breaks, markdown is rendered. */
export function QuestionStem({ text = '' }) {
  return (
    <div className="question-stem">
      {hasMarkdown(text) ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={stemMarkdownComponents}>
          {text}
        </ReactMarkdown>
      ) : (
        <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
      )}
    </div>
  )
}

/** Read-only option list using the learner markup; the answer is styled only when revealed. */
export function QuestionOptionList({ options = [], correctAnswer = null, revealAnswer = false, name = 'preview-option' }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {toLearnerOptions(options).map((o) => {
        let className = 'option'
        if (revealAnswer && correctAnswer === o.id) className += ' option--correct'
        return (
          <div key={o.id} className="option-wrapper" data-option-id={o.id}>
            <label className={className}>
              <input type="radio" name={name} value={o.id} disabled />
              <div className="option__label">{o.label}.</div>
              <div className="option__body">{o.body}</div>
              {revealAnswer && correctAnswer === o.id && <span style={visuallyHidden}> (correct answer)</span>}
            </label>
          </div>
        )
      })}
    </div>
  )
}

const EXPLANATION_TABS = [
  ['quick', 'Quick'],
  ['detailed', 'Detailed'],
  ['eli5', 'ELI5'],
]

/**
 * The learner explanation card body (correct answer banner plus Quick,
 * Detailed and ELI5 tabs) for a question in stored shape.
 */
export function QuestionExplanationPanel({ question, tab, onTabChange }) {
  const options = question.options || []
  const correct = Number.isInteger(question.correct_answer) ? question.correct_answer : null
  const quickPoints = buildQuickPoints(question.explanation_points_by_option, correct, options.length)
  return (
    <div className="card explanation-card">
      <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="ex-card__status ex-card__status--correct">
          <LuCircleCheck aria-hidden />
          Answer and explanations
        </div>
        <div className="tabs" role="tablist" aria-label="Explanation level">
          {EXPLANATION_TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`tab ${tab === key ? 'tab--active' : ''}`}
              onClick={() => onTabChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="card__body explain">
        {correct !== null && options[correct] !== undefined && (
          <div className="correct-answer-banner">
            <LuCircleCheck className="correct-answer-icon" aria-hidden />
            <div>
              <div className="correct-answer-title">Correct Answer</div>
              <div className="correct-answer-text">
                {optionLabel(correct)}. {options[correct]}
              </div>
            </div>
          </div>
        )}
        {tab === 'quick' && (
          <div className="explain__section">
            <div className="explain__label">Explanations:</div>
            {quickPoints.length > 0 ? (
              <ul className="key-points">
                {quickPoints.map((p) => (
                  <li key={p.label} className={`key-point ${p.isCorrect ? 'key-point--correct' : ''}`}>
                    <div className={`key-point-badge ${p.isCorrect ? 'is-correct' : 'is-wrong'}`}>{p.label}</div>
                    <div>{p.text}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div>No quick points available</div>
            )}
          </div>
        )}
        {tab === 'detailed' && (
          <div className="explain__section">
            <div className="explain__label">Detailed Explanation:</div>
            <div>{question.explanation_l2 || 'No detailed explanation available'}</div>
          </div>
        )}
        {tab === 'eli5' && (
          <div className="eli5-section">
            <div className="eli5-header">
              <LuLightbulb className="eli5-icon" aria-hidden />
              <span className="eli5-title">Explain Like I&apos;m 5</span>
            </div>
            <div className="eli5-content">{question.explanation_eli5 || 'No ELI5 explanation available'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

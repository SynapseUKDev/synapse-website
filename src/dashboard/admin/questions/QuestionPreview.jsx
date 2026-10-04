import React, { useState } from 'react'
import { QuestionExplanationPanel, QuestionOptionList, QuestionStem } from '../../practice/QuestionPresentation'
import QuestionAssetCarousel from '../../practice/QuestionAssetCarousel'
import './AdminQuestions.css'

const MODES = [
  ['question', 'Question'],
  ['answer', 'Answer and explanations'],
]

/**
 * Learner-style preview of a question in stored shape (for example the output
 * of toQuestionPayload) and its images in learner asset shape, in carousel
 * order. It only renders: it never saves, activates, or records an attempt.
 */
export default function QuestionPreview({ question, images = [], initialMode = 'question' }) {
  const [mode, setMode] = useState(initialMode)
  const [tab, setTab] = useState('quick')
  const revealAnswer = mode === 'answer'

  return (
    <section className="admin-question-preview" aria-label="Learner preview">
      <div className="admin-question-preview__modes" role="radiogroup" aria-label="Preview mode">
        {MODES.map(([key, label]) => (
          <label key={key} className={`admin-question-preview__mode ${mode === key ? 'is-active' : ''}`}>
            <input
              type="radio"
              name="question-preview-mode"
              value={key}
              checked={mode === key}
              onChange={() => setMode(key)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="card question-card">
        <div className="card__body">
          <div className="question-content">
            <div className="question-stem-wrapper">
              {question.stem?.trim() ? (
                <QuestionStem text={question.stem} />
              ) : (
                <p className="admin-question-preview__empty">No question stem entered yet.</p>
              )}
            </div>
            <QuestionAssetCarousel key={images.map((image) => image.id || image.url).join('|')} assets={images} />
            <QuestionOptionList
              options={question.options || []}
              correctAnswer={question.correct_answer}
              revealAnswer={revealAnswer}
            />
          </div>
        </div>
      </div>

      {revealAnswer &&
        (Number.isInteger(question.correct_answer) ? (
          <QuestionExplanationPanel question={question} tab={tab} onTabChange={setTab} />
        ) : (
          <p className="admin-question-preview__empty" role="status">
            Choose a correct answer to preview the answer state.
          </p>
        ))}
    </section>
  )
}

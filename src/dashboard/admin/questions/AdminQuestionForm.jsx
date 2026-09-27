import React from 'react'
import { LuArrowDown, LuArrowUp, LuPlus, LuTrash2 } from 'react-icons/lu'
import { optionLabel } from '../../practice/questionPresentationUtils'
import { DIFFICULTIES, MAX_OPTIONS, MIN_OPTIONS, fieldDomId } from './questionFormModel'
import TopicCombobox from './TopicCombobox'
import './AdminQuestions.css'

function FieldErrors({ id, messages }) {
  if (!messages?.length) return null
  return (
    <div id={id} className="aqf-error">
      {messages.map((message) => (
        <div key={message}>{message}</div>
      ))}
    </div>
  )
}

/** Props for a field input: stable id plus the invalid/description wiring for its errors. */
function fieldProps(field, messages) {
  const id = fieldDomId(field)
  return {
    id,
    'aria-invalid': messages?.length ? true : undefined,
    'aria-describedby': messages?.length ? `${id}-error` : undefined,
  }
}

/**
 * Controlled MCQ authoring form. State lives in the parent (questionFormReducer);
 * this component only renders fields, dispatches edits and shows errors.
 */
export default function AdminQuestionForm({ form, dispatch, taxonomy = [], errors = {}, readOnly = false }) {
  const fieldErrors = errors.fields || {}
  const optionErrors = errors.options || {}
  const setField = (field) => (event) => dispatch({ type: 'setField', field, value: event.target.value })
  const optionGroupErrors = [...(fieldErrors.options || []), ...(fieldErrors.correct_answer || [])]

  return (
    <fieldset className="aqf" disabled={readOnly}>
      <legend className="aqf__legend">Question content</legend>

      <div className="admin-form__row">
        <div className="aqf-field">
          <label htmlFor={fieldDomId('topic_id')}>Topic</label>
          <TopicCombobox
            id={fieldDomId('topic_id')}
            taxonomy={taxonomy}
            value={form.topic_id}
            onChange={(topicId) => dispatch({ type: 'setField', field: 'topic_id', value: topicId })}
            invalid={!!fieldErrors.topic_id?.length}
            describedBy={fieldErrors.topic_id?.length ? `${fieldDomId('topic_id')}-error` : undefined}
            disabled={readOnly}
          />
          <FieldErrors id={`${fieldDomId('topic_id')}-error`} messages={fieldErrors.topic_id} />
        </div>
        <div className="admin-form__row">
          <label>
            Type
            <input value="Multiple choice (MCQ)" readOnly aria-readonly="true" id={fieldDomId('type')} />
            <FieldErrors id={`${fieldDomId('type')}-error`} messages={fieldErrors.type} />
          </label>
          <label>
            Difficulty
            <select value={form.difficulty} onChange={setField('difficulty')} {...fieldProps('difficulty', fieldErrors.difficulty)}>
              <option value="">Not set</option>
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {level[0].toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
            <FieldErrors id={`${fieldDomId('difficulty')}-error`} messages={fieldErrors.difficulty} />
          </label>
        </div>
      </div>

      <label>
        Question stem
        <span className="aqf__hint">Markdown tables, lists and bold text render as they do for learners.</span>
        <textarea rows={7} value={form.stem} onChange={setField('stem')} {...fieldProps('stem', fieldErrors.stem)} />
        <FieldErrors id={`${fieldDomId('stem')}-error`} messages={fieldErrors.stem} />
      </label>

      <fieldset
        className="aqf-options"
        id={fieldDomId('options')}
        tabIndex={-1}
        aria-describedby={optionGroupErrors.length ? 'aqf-options-error' : undefined}
      >
        <legend className="aqf__legend">
          Answer options <span className="aqf__hint">({MIN_OPTIONS}–{MAX_OPTIONS}; select the correct one)</span>
        </legend>
        <FieldErrors id="aqf-options-error" messages={optionGroupErrors} />

        {form.options.map((option, idx) => {
          const label = optionLabel(idx)
          const messages = optionErrors[option.key]
          const inputId = fieldDomId('options', option.key)
          const isCorrect = form.correctKey === option.key
          return (
            <div key={option.key} className={`aqf-option ${isCorrect ? 'is-correct' : ''}`}>
              <div className="aqf-option__head">
                <label className="aqf-option__text" htmlFor={inputId}>
                  <span className="aqf-option__label">{label}.</span>
                  <input
                    id={inputId}
                    value={option.text}
                    onChange={(event) => dispatch({ type: 'setOption', key: option.key, patch: { text: event.target.value } })}
                    aria-label={`Option ${label} text`}
                    aria-invalid={messages?.length ? true : undefined}
                    aria-describedby={messages?.length ? `${inputId}-error` : undefined}
                  />
                </label>
                <label className="aqf-option__correct">
                  <input
                    type="radio"
                    name="aqf-correct"
                    checked={isCorrect}
                    onChange={() => dispatch({ type: 'setCorrect', key: option.key })}
                  />
                  Correct{' '}
                  <span className="aqf-visually-hidden">answer is option {label}</span>
                </label>
                <div className="aqf-option__actions">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'moveOption', key: option.key, offset: -1 })}
                    disabled={idx === 0}
                    aria-label={`Move option ${label} up`}
                  >
                    <LuArrowUp aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'moveOption', key: option.key, offset: 1 })}
                    disabled={idx === form.options.length - 1}
                    aria-label={`Move option ${label} down`}
                  >
                    <LuArrowDown aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'removeOption', key: option.key })}
                    disabled={form.options.length <= MIN_OPTIONS}
                    aria-label={`Remove option ${label}`}
                  >
                    <LuTrash2 aria-hidden />
                  </button>
                </div>
              </div>
              <label className="aqf-option__points">
                Explanation points for option {label}
                <span className="aqf__hint">One point per line. Learners see the first point in the Quick tab.</span>
                <textarea
                  rows={2}
                  value={option.pointsText}
                  onChange={(event) =>
                    dispatch({ type: 'setOption', key: option.key, patch: { pointsText: event.target.value } })
                  }
                />
              </label>
              <FieldErrors id={`${inputId}-error`} messages={messages} />
            </div>
          )
        })}

        <button
          type="button"
          className="aqf-add-option"
          onClick={() => dispatch({ type: 'addOption' })}
          disabled={form.options.length >= MAX_OPTIONS}
        >
          <LuPlus aria-hidden /> Add option
        </button>
      </fieldset>

      <label>
        Detailed explanation
        <textarea
          rows={7}
          value={form.explanation_l2}
          onChange={setField('explanation_l2')}
          {...fieldProps('explanation_l2', fieldErrors.explanation_l2)}
        />
        <FieldErrors id={`${fieldDomId('explanation_l2')}-error`} messages={fieldErrors.explanation_l2} />
      </label>

      <label>
        Simplified (ELI5) explanation
        <textarea
          rows={4}
          value={form.explanation_eli5}
          onChange={setField('explanation_eli5')}
          {...fieldProps('explanation_eli5', fieldErrors.explanation_eli5)}
        />
        <FieldErrors id={`${fieldDomId('explanation_eli5')}-error`} messages={fieldErrors.explanation_eli5} />
      </label>
    </fieldset>
  )
}

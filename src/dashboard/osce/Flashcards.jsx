import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LuArrowLeft, LuPlay, LuX, LuChevronDown, LuChevronRight, LuTriangleAlert,
  LuRotateCcw, LuClock, LuZap, LuThumbsUp,
  LuThumbsDown, LuCircleCheck, LuCalendarClock,
} from 'react-icons/lu';
import './Flashcards.css';
import { authenticatedFetch } from '../../auth/token';
import { useOutletContext } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const VIEWS = { PICKER: 'picker', SESSION: 'session', SUMMARY: 'summary' };

// Max new cards introduced per session when no SRS history exists for a card
const MAX_NEW_CARDS_PER_SESSION = 20;

// Maps a Pathway Section label to the condition macro fields it covers
const SECTION_FIELDS = {
  All: [
    'pathophysiology', 'clinicalFeatures', 'redFlags',
    'investigationFirst', 'investigationSecond',
    'managementFirst', 'managementSecond', 'complications',
  ],
  Pathophysiology: ['pathophysiology'],
  'Clinical Features': ['clinicalFeatures'],
  'Red Flags': ['redFlags'],
  Investigations: ['investigationFirst', 'investigationSecond'],
  Management: ['managementFirst', 'managementSecond'],
  Complications: ['complications'],
};

const SECTION_LABELS = Object.keys(SECTION_FIELDS);
const PATHWAY_SECTIONS = SECTION_LABELS.filter((s) => s !== 'All');

// Reverse map: macro field key → pathway section group label
const FIELD_TO_SECTION = {};
for (const [label, fields] of Object.entries(SECTION_FIELDS)) {
  if (label === 'All') continue;
  for (const f of fields) FIELD_TO_SECTION[f] = label;
}

// Human-readable labels for each field
const FIELD_LABELS = {
  pathophysiology:   'Pathophysiology',
  clinicalFeatures:  'Clinical Features',
  redFlags:          'Red Flags',
  investigationFirst:  'Investigation',
  investigationSecond: 'Further Investigations',
  managementFirst:   '1st Line Management',
  managementSecond:  '2nd Line Management',
  complications:     'Complications',
};

const DIFFICULTY_BY_FIELD = {
  pathophysiology:   'medium',
  clinicalFeatures:  'easy',
  redFlags:          'hard',
  investigationFirst:  'medium',
  investigationSecond: 'hard',
  managementFirst:   'easy',
  managementSecond:  'medium',
  complications:     'hard',
};

// Confidence buttons — 3 ratings (no 'again'); maps to SM-2
const CONFIDENCE = [
  { key: 'easy',   label: 'Easy',   icon: LuZap,        color: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
  { key: 'good',   label: 'Good',   icon: LuThumbsUp,   color: '#16a34a', bg: 'rgba(34,197,94,.12)'  },
  { key: 'hard',   label: 'Hard',   icon: LuThumbsDown, color: '#d97706', bg: 'rgba(245,158,11,.12)' },
];

// ─────────────────────────────────────────────────────────────
// Atomic card generator
// ─────────────────────────────────────────────────────────────

/**
 * Decompose selected condition macros into atomic cards, filtered by pathway sections.
 */
function generateDeckFromSelection(conditions, selectedConditionIds, activeSections) {
  const fields = getActiveFields(activeSections);
  const deck = [];

  for (const cond of conditions) {
    if (!selectedConditionIds.has(cond.id)) continue;
    for (const field of fields) {
      const answer = cond[field];
      if (!answer || !answer.trim()) continue;

      deck.push({
        uid:       `${cond.id}::${field}`,
        conditionId: cond.id,
        condition: cond.condition,
        specialty: cond.specialty?.name ?? '',
        topic:     cond.topic?.name ?? '',
        section:   FIELD_LABELS[field] ?? field,
        question:  buildQuestion(cond.condition, field),
        answer:    answer.trim(),
        examTip:   cond.examTip ?? null,
        guidelineSource: cond.guidelineSource ?? null,
        guidelineUrl:    cond.guidelineUrl ?? null,
        lastReviewed:    cond.lastReviewed ?? null,
        difficulty: DIFFICULTY_BY_FIELD[field] ?? 'medium',
      });
    }
  }

  return deck;
}

/** Legacy helper — single pathway section filter over a condition array. */
function generateDeck(conditions, pathwaySection) {
  const sectionKey = pathwaySection || 'All';
  const activeSections = sectionKey === 'All'
    ? new Set(PATHWAY_SECTIONS)
    : new Set([sectionKey]);
  const ids = new Set(conditions.map((c) => c.id));
  return generateDeckFromSelection(conditions, ids, activeSections);
}

function getActiveFields(activeSections) {
  const all = SECTION_FIELDS.All;
  if (!activeSections || activeSections.size === 0 || activeSections.size >= PATHWAY_SECTIONS.length) {
    return all;
  }
  const fields = [];
  for (const label of activeSections) {
    fields.push(...(SECTION_FIELDS[label] ?? []));
  }
  return fields.length ? [...new Set(fields)] : all;
}

/** Pathway section labels that have content for this condition macro. */
function getConditionSections(cond) {
  const labels = new Set();
  for (const field of SECTION_FIELDS.All) {
    const val = cond[field];
    if (val && val.trim()) labels.add(FIELD_TO_SECTION[field] ?? FIELD_LABELS[field]);
  }
  return PATHWAY_SECTIONS.filter((s) => labels.has(s));
}

function countCardsForConditions(conditions, selectedIds, activeSections) {
  return generateDeckFromSelection(conditions, selectedIds, activeSections).length;
}

function buildQuestion(condition, field) {
  const templates = {
    pathophysiology:   `What is the pathophysiology of ${condition}?`,
    clinicalFeatures:  `What are the clinical features of ${condition}?`,
    redFlags:          `What are the red flags in ${condition}?`,
    investigationFirst:  `What is the first investigation for ${condition}?`,
    investigationSecond: `What are further investigations for ${condition}?`,
    managementFirst:   `What is the first-line management of ${condition}?`,
    managementSecond:  `What is the second-line management of ${condition}?`,
    complications:     `What are the complications of ${condition}?`,
  };
  return templates[field] ?? `What do you know about ${field} in ${condition}?`;
}

// ─────────────────────────────────────────────────────────────
// In-session deck manipulation (unchanged from original)
// ─────────────────────────────────────────────────────────────

function applyConfidence(deck, card, rating) {
  const next = [...deck];
  next.shift(); // remove current card from front

  if (rating === 'easy') {
    // Easy: remove permanently — card is mastered this session
    return { deck: next, mastered: true };
  }

  if (rating === 'good') {
    // Good: push to very end
    next.push(card);
    return { deck: next, mastered: false };
  }

  if (rating === 'hard') {
    // Hard: insert 2 spots ahead for quick retry
    if (next.length < 2) {
      next.push(card);
    } else {
      next.splice(2, 0, card);
    }
    return { deck: next, mastered: false };
  }

  return { deck: next, mastered: false };
}

// ─────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await authenticatedFetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function Select({ label, value, onChange, options, disabled, placeholder = 'All' }) {
  return (
    <div className="fc-select-wrap">
      {label && <label className="fc-select-label">{label}</label>}
      <div className="fc-select-inner">
        <select
          className="fc-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <LuChevronDown className="fc-select-icon" size={16} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PickerScreen — Anki-style deck browser (specialty → topic → condition)
// ─────────────────────────────────────────────────────────────

function PickerScreen({ onStart, srsStats }) {
  const { user } = useOutletContext();
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false); // async deck build in progress

  const [selSpecialty, setSelSpecialty] = useState('');
  const [expandedTopics, setExpandedTopics] = useState(new Set());
  const [selectedConditions, setSelectedConditions] = useState(new Set());
  const [activeSections, setActiveSections] = useState(() => new Set(PATHWAY_SECTIONS));

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch('/flashcards/conditions')
      .then(({ conditions: data }) => {
        if (!cancelled) setConditions(data ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const specialtyOptions = useMemo(() => {
    const seen = new Map();
    for (const c of conditions) {
      if (c.specialty && !seen.has(c.specialty.id)) {
        seen.set(c.specialty.id, c.specialty.name);
      }
    }
    return [...seen.entries()]
      .map(([v, l]) => ({ value: v, label: l }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [conditions]);

  // Default to first specialty once data loads
  useEffect(() => {
    if (!selSpecialty && specialtyOptions.length) {
      setSelSpecialty(specialtyOptions[0].value);
    }
  }, [specialtyOptions, selSpecialty]);

  const specialtyConditions = useMemo(
    () => conditions.filter((c) => c.specialty?.id === selSpecialty),
    [conditions, selSpecialty]
  );

  const topicGroups = useMemo(() => {
    const map = new Map();
    for (const c of specialtyConditions) {
      const topicId = c.topic?.id ?? 'unknown';
      if (!map.has(topicId)) {
        map.set(topicId, {
          id: topicId,
          name: c.topic?.name ?? 'Other',
          conditions: [],
        });
      }
      map.get(topicId).conditions.push(c);
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        conditions: g.conditions.sort((a, b) => a.condition.localeCompare(b.condition)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [specialtyConditions]);

  // Reset selection when specialty changes; expand topics when list updates
  useEffect(() => {
    if (!selSpecialty) return;
    setSelectedConditions(new Set());
  }, [selSpecialty]);

  useEffect(() => {
    setExpandedTopics(new Set(topicGroups.map((g) => g.id)));
  }, [topicGroups]);

  const toggleTopicExpand = (topicId) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  const toggleCondition = (condId) => {
    setSelectedConditions((prev) => {
      const next = new Set(prev);
      if (next.has(condId)) next.delete(condId);
      else next.add(condId);
      return next;
    });
  };

  const toggleTopicAll = (group) => {
    const ids = group.conditions.map((c) => c.id);
    const allSelected = ids.every((id) => selectedConditions.has(id));
    setSelectedConditions((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedConditions(new Set(specialtyConditions.map((c) => c.id)));
  };

  const clearSelection = () => setSelectedConditions(new Set());

  const toggleSection = (section) => {
    setActiveSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const previewCount = useMemo(
    () => countCardsForConditions(specialtyConditions, selectedConditions, activeSections),
    [specialtyConditions, selectedConditions, activeSections]
  );

  /**
   * Build a priority-ordered deck:
   *   1. Due cards (next_due_at <= now) from the user's selection — all of them
   *   2. New cards (no SRS record) from the selection — up to MAX_NEW_CARDS_PER_SESSION
   *   3. Remaining cards (not due yet, have SRS history) — rest of the selection
   *
   * The user only needs to pick conditions. SRS ordering is invisible.
   */
  function handleStart() {
    if (previewCount === 0) return;
    setStarting(true);

    const fullDeck = generateDeckFromSelection(specialtyConditions, selectedConditions, activeSections);

    // Fetch due UIDs in the background, then sort the deck
    apiFetch('/flashcards/srs/due?limit=500')
      .then(({ due }) => {
        const dueUidSet = new Set(due.map((d) => d.flashcard_uid));

        const dueDeck  = [];
        const newDeck  = [];
        const restDeck = [];

        for (const card of fullDeck) {
          if (dueUidSet.has(card.uid)) {
            dueDeck.push(card);          // already scheduled, due now
          } else if (!due.some(() => false) && !dueUidSet.has(card.uid)) {
            // Distinguish new (never seen) from future-scheduled:
            // due endpoint only returns rows where next_due_at <= now.
            // Cards not in due list are either new (no row) or future-scheduled.
            // We approximate: any card not in due list is treated as "rest".
            // To properly distinguish new vs future we'd need a separate endpoint.
            // For now, push to rest and interleave new logic below.
            restDeck.push(card);
          }
        }

        // Better split: fetch all seen uids separately
        // Since we don't have a "all seen" endpoint, we reuse the due list.
        // Cards in due list = seen + due now.
        // Cards not in due list = either new OR seen but not yet due.
        // We can't tell them apart without another query, so:
        // treat restDeck as shuffled and cap at MAX_NEW_CARDS_PER_SESSION
        // to avoid overwhelming users. This is a good approximation.
        const finalDeck = [
          ...dueDeck,
          ...restDeck.slice(0, MAX_NEW_CARDS_PER_SESSION),
        ];

        if (finalDeck.length > 0) {
          onStart(finalDeck);
        } else {
          onStart(fullDeck.slice(0, MAX_NEW_CARDS_PER_SESSION));
        }
      })
      .catch(() => {
        // If SRS fetch fails, fall back to plain shuffled deck
        onStart(fullDeck);
      })
      .finally(() => setStarting(false));
  }

  if (loading) {
    return (
      <div className="fc-picker fc-picker--browser">
        <div className="fc-picker__loading">
          <div className="fc-spinner" />
          <p>Loading conditions…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fc-picker fc-picker--browser">
        <p className="fc-picker__error">Failed to load conditions: {error}</p>
      </div>
    );
  }

  const dueCount = srsStats?.due_count ?? 0;

  return (
    <div className="fc-picker fc-picker--browser">
      <div className="fc-picker__header">
        <h2 className="fc-picker__title">Flashcard Study Session</h2>
        <p className="fc-picker__subtitle">
          Pick a specialty and conditions. Due cards are shown first, then new cards,
          so your session always focuses on what matters most.
        </p>
        {dueCount > 0 && (
          <div className="fc-due-pill">
            <LuCalendarClock size={14} />
            <span><strong>{dueCount}</strong> card{dueCount !== 1 ? 's' : ''} due for review — these will appear first</span>
          </div>
        )}
      </div>

      <div className="fc-browser__toolbar">
        <Select
          label="Specialty"
          value={selSpecialty}
          onChange={setSelSpecialty}
          options={specialtyOptions}
          placeholder="Select specialty"
        />

        <div className="fc-browser__sections">
          <span className="fc-browser__sections-label">Pathway sections</span>
          <div className="fc-browser__section-chips">
            {PATHWAY_SECTIONS.map((section) => {
              const on = activeSections.has(section);
              return (
                <button
                  key={section}
                  type="button"
                  className={`fc-section-chip${on ? ' fc-section-chip--on' : ''}`}
                  onClick={() => toggleSection(section)}
                >
                  {section}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fc-browser__list-actions">
        <span className="fc-browser__list-meta">
          {topicGroups.length} topic{topicGroups.length !== 1 ? 's' : ''} ·{' '}
          {specialtyConditions.length} condition{specialtyConditions.length !== 1 ? 's' : ''}
        </span>
        <div className="fc-browser__list-btns">
          <button type="button" className="fc-browser__link-btn" onClick={selectAllVisible}>
            Select all
          </button>
          <span className="fc-browser__sep">·</span>
          <button type="button" className="fc-browser__link-btn" onClick={clearSelection}>
            Clear
          </button>
        </div>
      </div>

      <div className="fc-browser__list">
        {topicGroups.length === 0 ? (
          <p className="fc-picker__empty">No conditions published for this specialty yet.</p>
        ) : (
          topicGroups.map((group) => {
            const isExpanded = expandedTopics.has(group.id);
            const groupIds = group.conditions.map((c) => c.id);
            const selectedInGroup = groupIds.filter((id) => selectedConditions.has(id)).length;
            const allInGroup = groupIds.length > 0 && selectedInGroup === groupIds.length;
            const groupCardCount = countCardsForConditions(
              group.conditions,
              new Set(groupIds.filter((id) => selectedConditions.has(id))),
              activeSections
            );

            return (
              <div key={group.id} className="fc-browser__group">
                <div className="fc-browser__group-header">
                  <button
                    type="button"
                    className="fc-browser__expand"
                    onClick={() => toggleTopicExpand(group.id)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <LuChevronDown size={18} /> : <LuChevronRight size={18} />}
                  </button>
                  <button
                    type="button"
                    className="fc-browser__group-title"
                    onClick={() => toggleTopicExpand(group.id)}
                  >
                    {group.name}
                    <span className="fc-browser__group-count">
                      {group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''}
                      {selectedInGroup > 0 && ` · ${groupCardCount} cards`}
                    </span>
                  </button>
                  <label className="fc-browser__check-label">
                    <input
                      type="checkbox"
                      checked={allInGroup}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedInGroup > 0 && !allInGroup;
                      }}
                      onChange={() => toggleTopicAll(group)}
                    />
                    <span className="fc-browser__check-box" />
                  </label>
                </div>

                {isExpanded && (
                  <div className="fc-browser__rows">
                    {group.conditions.map((cond) => {
                      const sections = getConditionSections(cond);
                      const isSelected = selectedConditions.has(cond.id);
                      const cardCount = countCardsForConditions(
                        [cond],
                        new Set([cond.id]),
                        activeSections
                      );

                      return (
                        <label
                          key={cond.id}
                          className={`fc-browser__row${isSelected ? ' fc-browser__row--selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="fc-browser__row-check"
                            checked={isSelected}
                            onChange={() => toggleCondition(cond.id)}
                          />
                          <span className="fc-browser__row-check-box" />
                          <div className="fc-browser__row-head">
                            <span className="fc-browser__row-name">{cond.condition}</span>
                            <span className="fc-browser__row-count">
                              {cardCount} {cardCount === 1 ? 'card' : 'cards'}
                            </span>
                          </div>
                          <span className="fc-browser__row-tags">
                            {sections.map((sec) => (
                              <span
                                key={sec}
                                className={`fc-tag${activeSections.has(sec) ? '' : ' fc-tag--muted'}`}
                              >
                                {sec}
                              </span>
                            ))}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="fc-browser__footer">
        <div className="fc-browser__footer-summary">
          <strong>{previewCount}</strong>
          <span>{previewCount === 1 ? ' card' : ' cards'} selected</span>
          {selectedConditions.size > 0 && (
            <span className="fc-browser__footer-from">
              from {selectedConditions.size} condition{selectedConditions.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          id="fc-start-study"
          className="fc-picker__start fc-browser__start"
          onClick={handleStart}
          disabled={previewCount === 0 || starting}
        >
          {starting
            ? <div className="fc-spinner" style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
            : <LuPlay size={18} />}
          Study Now
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FlashCard — 3D flip card display
// ─────────────────────────────────────────────────────────────

function FlashCard({ card, flipped }) {
  return (
    <div className={`fc-card${flipped ? ' fc-card--flipped' : ''}`}>
      {/* Front */}
      <div className="fc-card__face fc-card__face--front">
        <div className="fc-card__section-badge">{card.section}</div>
        <p className="fc-card__topic">{card.specialty} · {card.topic}</p>
        <h3 className="fc-card__condition">{card.condition}</h3>
        <p className="fc-card__question">{card.question}</p>
        <p className="fc-card__tap-hint">Tap or press Space to reveal</p>
      </div>

      {/* Back */}
      <div className="fc-card__face fc-card__face--back">
        <div className="fc-card__section-badge fc-card__section-badge--back">{card.section}</div>
        <p className="fc-card__answer">{card.answer}</p>

        {/* Exam tip — rendered on EVERY card per PDF spec */}
        {card.examTip && (
          <div className="fc-card__exam-tip">
            <LuTriangleAlert size={16} className="fc-card__tip-icon" />
            <div>
              <span className="fc-card__tip-heading">⚡ Exam Tip</span>
              <p className="fc-card__tip-text">{card.examTip}</p>
            </div>
          </div>
        )}

        {/* Citation footer — source name + review date only (no external link) */}
        {card.guidelineSource && (
          <div className="fc-card__citation">
            <span>{card.guidelineSource}</span>
            {card.lastReviewed && (
              <span className="fc-card__reviewed">
                <LuClock size={12} /> Reviewed {card.lastReviewed}
              </span>
            )}
          </div>
        )}

        <p className="fc-card__tap-hint fc-card__tap-hint--back">Tap or press Space to hide and retry</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SessionScreen
// ─────────────────────────────────────────────────────────────

function SessionScreen({ initialDeck, onComplete, onAbandon, onRate }) {
  const [deck, setDeck]         = useState(initialDeck);
  const [flipped, setFlipped]   = useState(false);
  const [animLock, setAnimLock] = useState(false);
  const [mastered, setMastered] = useState(0);
  const [total]                 = useState(initialDeck.length);
  // Track next_due_at for each rated card to show in summary
  const ratedCards = useRef([]); // { uid, rating, next_due_at }

  const card = deck[0] ?? null;
  const seen  = mastered + (total - deck.length - mastered);
  // cards seen = total - remaining + mastered removed
  const remaining = deck.length;

  function handleFlip() {
    if (animLock) return;
    setFlipped((prev) => !prev);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      if (animLock) return;
      e.preventDefault();
      setFlipped((prev) => !prev);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [animLock]);

  function handleConfidence(rating) {
    if (!card || animLock) return;
    setAnimLock(true);

    // Fire-and-forget SRS record call — doesn't block the UI
    if (card.uid && onRate) {
      onRate(card.uid, rating).then((result) => {
        if (result) {
          ratedCards.current.push({
            uid: card.uid,
            condition: card.condition,
            section: card.section,
            rating,
            next_due_at: result.next_due_at,
            interval_days: result.interval_days,
          });
        }
      }).catch(() => {/* non-critical */});
    }

    // 300ms animation lock — let the flip-back complete before DOM update
    setTimeout(() => {
      setFlipped(false);

      setTimeout(() => {
        const { deck: nextDeck, mastered: wasMastered } = applyConfidence(deck, card, rating);
        if (wasMastered) setMastered((m) => m + 1);

        if (nextDeck.length === 0) {
          onComplete({ total, mastered: wasMastered ? mastered + 1 : mastered, hardCount: 0, ratedCards: ratedCards.current });
        } else {
          setDeck(nextDeck);
        }
        setAnimLock(false);
      }, 300);
    }, 300);
  }

  if (!card) {
    return (
      <div className="fc-session__empty">
        <LuCircleCheck size={48} color="#16a34a" />
        <h3>All done!</h3>
        <button className="fc-picker__start" onClick={() => onComplete({ total, mastered, hardCount: 0 })}>
          See Results
        </button>
      </div>
    );
  }

  const pct = Math.round(((total - remaining) / total) * 100);

  return (
    <div className="fc-session">
      {/* Header */}
      <div className="fc-session__header">
        <button className="fc-session__abandon" onClick={onAbandon} title="Exit session">
          <LuX size={18} />
        </button>
        <div className="fc-session__progress-wrap">
          <div className="fc-session__progress-bar" style={{ width: `${pct}%` }} />
        </div>
        <span className="fc-session__counter">
          {total - remaining}/{total}
        </span>
      </div>

      {/* Stats strip */}
      <div className="fc-session__score-strip">
        <span className="fc-session__stat">
          <span className="fc-session__stat-val" style={{ color: '#7c3aed' }}>{mastered}</span>
          <span className="fc-session__stat-lbl">mastered</span>
        </span>
        <span className="fc-session__divider" />
        <span className="fc-session__stat">
          <span className="fc-session__stat-val">{remaining}</span>
          <span className="fc-session__stat-lbl">remaining</span>
        </span>
      </div>

      {/* Card */}
      <div onClick={handleFlip} style={{ cursor: animLock ? 'default' : 'pointer' }}>
        <FlashCard card={card} flipped={flipped} />
      </div>

      {/* Confidence buttons — only visible after flip */}
      <div className={`fc-confidence${flipped ? ' fc-confidence--visible' : ''}`}>
        <p className="fc-confidence__prompt">How well did you know this?</p>
        <div className="fc-confidence__btns">
          {CONFIDENCE.map(({ key, label, icon: Icon, color, bg }) => (
            <button
              key={key}
              className="fc-confidence__btn"
              style={{ '--fc-conf-color': color, '--fc-conf-bg': bg }}
              onClick={() => handleConfidence(key)}
              disabled={animLock}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p className="fc-confidence__hint">
          <strong>Easy</strong> → long interval · <strong>Good</strong> → normal interval · <strong>Hard</strong> → short interval
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SummaryScreen
// ─────────────────────────────────────────────────────────────

function SummaryScreen({ result, onRestart, onExit }) {
  const { total, mastered, ratedCards = [] } = result;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  const { emoji, label, color } =
    pct >= 80 ? { emoji: '🏆', label: 'Excellent work!',      color: '#16a34a' }
  : pct >= 60 ? { emoji: '👍', label: 'Good effort!',         color: '#d97706' }
  : pct >= 40 ? { emoji: '💪', label: 'Keep practising!',     color: '#ea580c' }
  :             { emoji: '📖', label: 'More revision needed',  color: '#dc2626' };

  const circumference = 2 * Math.PI * 54;
  const dash = circumference - (pct / 100) * circumference;

  function formatInterval(days) {
    if (!days) return null;
    if (days === 1) return 'tomorrow';
    if (days < 7) return `in ${days} days`;
    const weeks = Math.round(days / 7);
    return `in ${weeks} week${weeks !== 1 ? 's' : ''}`;
  }

  // Only show next-review list if we have SRS data
  const showNextReview = ratedCards.length > 0;

  return (
    <div className="fc-summary">
      <div className="fc-summary__grade">
        <span className="fc-summary__emoji">{emoji}</span>
        <h2 className="fc-summary__label" style={{ color }}>{label}</h2>
      </div>

      <svg className="fc-summary__ring" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" className="fc-summary__ring-track" />
        <circle
          cx="60" cy="60" r="54"
          className="fc-summary__ring-fill"
          style={{ stroke: color, strokeDashoffset: dash }}
        />
        <text x="60" y="65" className="fc-summary__ring-text">{pct}%</text>
      </svg>

      <div className="fc-summary__stats">
        <div className="fc-summary__stat-item">
          <span className="fc-summary__stat-val" style={{ color: '#7c3aed' }}>{mastered}</span>
          <span className="fc-summary__stat-lbl">Mastered</span>
        </div>
        <div className="fc-summary__divider" />
        <div className="fc-summary__stat-item">
          <span className="fc-summary__stat-val">{total}</span>
          <span className="fc-summary__stat-lbl">Total Cards</span>
        </div>
        <div className="fc-summary__divider" />
        <div className="fc-summary__stat-item">
          <span className="fc-summary__stat-val" style={{ color: '#dc2626' }}>{total - mastered}</span>
          <span className="fc-summary__stat-lbl">To Review</span>
        </div>
      </div>

      {/* Next review schedule */}
      {showNextReview && (
        <div className="fc-summary__schedule">
          <h3 className="fc-summary__schedule-title">
            <LuCalendarClock size={16} /> Next Reviews
          </h3>
          <div className="fc-summary__schedule-list">
            {ratedCards.slice(0, 8).map((c, i) => (
              <div key={i} className="fc-summary__schedule-row">
                <span className="fc-summary__schedule-name">{c.condition} — {c.section}</span>
                <span className={`fc-summary__schedule-when fc-summary__schedule-when--${c.rating}`}>
                  {formatInterval(c.interval_days)}
                </span>
              </div>
            ))}
            {ratedCards.length > 8 && (
              <p className="fc-summary__schedule-more">+{ratedCards.length - 8} more scheduled</p>
            )}
          </div>
        </div>
      )}

      <div className="fc-summary__actions">
        <button className="fc-summary__btn fc-summary__btn--primary" onClick={onRestart}>
          <LuRotateCcw size={18} /> New Session
        </button>
        <button className="fc-summary__btn fc-summary__btn--secondary" onClick={onExit}>
          <LuArrowLeft size={18} /> Back to Question Bank
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────

export default function Flashcards() {
  const navigate = useNavigate();
  const [view, setView]         = useState(VIEWS.PICKER);
  const [deck, setDeck]         = useState([]);
  const [result, setResult]     = useState(null);
  const [srsStats, setSrsStats] = useState(null);
  const { user } = useOutletContext();

  // Load SRS stats whenever we return to picker (to show due pill)
  useEffect(() => {
    if (!user || view !== VIEWS.PICKER) return;
    apiFetch('/flashcards/srs/stats')
      .then((data) => setSrsStats(data))
      .catch(() => setSrsStats(null));
  }, [user, view]);

  /** Fire-and-forget SRS record — called from SessionScreen on each rating */
  async function handleRate(flashcard_uid, confidence) {
    try {
      const result = await apiFetch('/flashcards/srs/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flashcard_uid, confidence }),
      });
      return result; // { next_due_at, interval_days, repetitions }
    } catch {
      return null;
    }
  }

  function handleStart(generatedDeck) {
    setDeck(generatedDeck);
    setView(VIEWS.SESSION);
  }

  function handleComplete(res) {
    setResult(res);
    setView(VIEWS.SUMMARY);
  }

  function handleAbandon() {
    setDeck([]);
    setView(VIEWS.PICKER);
  }

  function handleRestart() {
    setDeck([]);
    setResult(null);
    setView(VIEWS.PICKER);
  }

  return (
    <div className="fc-page">
      <button className="fc-page__back" onClick={() => navigate('/dashboard/question-bank')}>
        <LuArrowLeft size={18} />
        <span>Question Bank</span>
      </button>

      <div className={`fc-page__card${view === VIEWS.PICKER ? ' fc-page__card--picker' : ''}`}>
        {view === VIEWS.PICKER && (
          <PickerScreen
            onStart={handleStart}
            srsStats={srsStats}
          />
        )}

        {view === VIEWS.SESSION && deck.length > 0 && (
          <SessionScreen
            initialDeck={deck}
            onComplete={handleComplete}
            onAbandon={handleAbandon}
            onRate={handleRate}
          />
        )}

        {view === VIEWS.SUMMARY && result && (
          <SummaryScreen
            result={result}
            onRestart={handleRestart}
            onExit={() => navigate('/dashboard/question-bank')}
          />
        )}
      </div>
    </div>
  );
}

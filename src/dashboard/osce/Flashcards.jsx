import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LuArrowLeft, LuPlay, LuX, LuChevronDown, LuAlertTriangle,
  LuExternalLink, LuRotateCcw, LuClock, LuZap, LuThumbsUp,
  LuThumbsDown, LuCheckCircle, LuFilter,
} from 'react-icons/lu';
import './Flashcards.css';

const API = import.meta.env.VITE_API_URL ?? '';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const VIEWS = { PICKER: 'picker', SESSION: 'session', SUMMARY: 'summary' };

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

// Confidence buttons (Easy / Medium / Hard — per PDF spec)
const CONFIDENCE = [
  { key: 'easy',   label: 'Easy',   icon: LuZap,        color: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
  { key: 'medium', label: 'Medium', icon: LuThumbsUp,   color: '#16a34a', bg: 'rgba(34,197,94,.12)'  },
  { key: 'hard',   label: 'Hard',   icon: LuThumbsDown, color: '#d97706', bg: 'rgba(245,158,11,.12)' },
];

// ─────────────────────────────────────────────────────────────
// Atomic card generator
// ─────────────────────────────────────────────────────────────

/**
 * Decompose a condition macro-object into an array of atomic card objects.
 * Only generates a card for fields that are non-null/non-empty.
 */
function generateDeck(conditions, pathwaySection) {
  const fields = SECTION_FIELDS[pathwaySection] ?? SECTION_FIELDS.All;
  const deck = [];

  for (const cond of conditions) {
    for (const field of fields) {
      const answer = cond[field];
      if (!answer || !answer.trim()) continue; // skip null / empty

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
// Spaced repetition (array mutation per PDF spec)
// ─────────────────────────────────────────────────────────────

function applyConfidence(deck, card, rating) {
  const next = [...deck];
  next.shift(); // remove current card from front

  if (rating === 'easy') {
    // Easy: remove permanently — card is gone
    return { deck: next, mastered: true };
  }

  if (rating === 'medium') {
    // Medium: push to very end
    next.push(card);
    return { deck: next, mastered: false };
  }

  if (rating === 'hard') {
    // Hard: insert 2 spots ahead for immediate retry
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
  const token = localStorage.getItem('sb-access-token') ?? '';
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
// PickerScreen — 4-tier cascading filter
// ─────────────────────────────────────────────────────────────

function PickerScreen({ onStart }) {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 4-tier filter state
  const [selSpecialty, setSelSpecialty] = useState('');
  const [selTopic, setSelTopic]         = useState('');
  const [selCondition, setSelCondition] = useState('');
  const [selSection, setSelSection]     = useState('All');

  useEffect(() => {
    setLoading(true);
    apiFetch('/flashcards/conditions')
      .then(({ conditions: data }) => setConditions(data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Cascade: reset downstream when upstream changes
  useEffect(() => { setSelTopic(''); setSelCondition(''); }, [selSpecialty]);
  useEffect(() => { setSelCondition(''); }, [selTopic]);

  // Derived option lists
  const specialtyOptions = useMemo(() => {
    const seen = new Map();
    for (const c of conditions) {
      if (c.specialty && !seen.has(c.specialty.id)) {
        seen.set(c.specialty.id, c.specialty.name);
      }
    }
    return [...seen.entries()].map(([v, l]) => ({ value: v, label: l }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [conditions]);

  const topicOptions = useMemo(() => {
    const filtered = selSpecialty
      ? conditions.filter((c) => c.specialty?.id === selSpecialty)
      : conditions;
    const seen = new Map();
    for (const c of filtered) {
      if (c.topic && !seen.has(c.topic.id)) seen.set(c.topic.id, c.topic.name);
    }
    return [...seen.entries()].map(([v, l]) => ({ value: v, label: l }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [conditions, selSpecialty]);

  const conditionOptions = useMemo(() => {
    let filtered = conditions;
    if (selSpecialty) filtered = filtered.filter((c) => c.specialty?.id === selSpecialty);
    if (selTopic)     filtered = filtered.filter((c) => c.topic?.id === selTopic);
    return filtered
      .map((c) => ({ value: c.id, label: c.condition }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [conditions, selSpecialty, selTopic]);

  const sectionOptions = SECTION_LABELS.slice(1).map((s) => ({ value: s, label: s }));

  // Filtered condition set for session
  const filteredConditions = useMemo(() => {
    let out = conditions;
    if (selSpecialty) out = out.filter((c) => c.specialty?.id === selSpecialty);
    if (selTopic)     out = out.filter((c) => c.topic?.id === selTopic);
    if (selCondition) out = out.filter((c) => c.id === selCondition);
    return out;
  }, [conditions, selSpecialty, selTopic, selCondition]);

  const previewCount = useMemo(
    () => generateDeck(filteredConditions, selSection || 'All').length,
    [filteredConditions, selSection]
  );

  function handleStart() {
    const deck = generateDeck(filteredConditions, selSection || 'All');
    if (!deck.length) return;
    onStart(deck);
  }

  if (loading) {
    return (
      <div className="fc-picker">
        <div className="fc-picker__loading">
          <div className="fc-spinner" />
          <p>Loading conditions…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fc-picker">
        <p className="fc-picker__error">Failed to load conditions: {error}</p>
      </div>
    );
  }

  return (
    <div className="fc-picker">
      <div className="fc-picker__header">
        <h2 className="fc-picker__title">Flashcard Study Session</h2>
        <p className="fc-picker__subtitle">
          Filter by specialty, topic or condition — then choose which part of the pathway to study.
        </p>
      </div>

      <div className="fc-picker__filters">
        <LuFilter size={16} className="fc-picker__filter-icon" />
        <span className="fc-picker__filter-label">Filter</span>
      </div>

      <div className="fc-picker__selects">
        <Select
          label="Specialty"
          value={selSpecialty}
          onChange={setSelSpecialty}
          options={specialtyOptions}
          placeholder="All Specialties"
        />
        <Select
          label="Topic"
          value={selTopic}
          onChange={setSelTopic}
          options={topicOptions}
          disabled={!topicOptions.length}
          placeholder="All Topics"
        />
        <Select
          label="Condition"
          value={selCondition}
          onChange={setSelCondition}
          options={conditionOptions}
          disabled={!conditionOptions.length}
          placeholder="All Conditions"
        />
        <Select
          label="Pathway Section"
          value={selSection === 'All' ? '' : selSection}
          onChange={(v) => setSelSection(v || 'All')}
          options={sectionOptions}
          placeholder="All Sections"
        />
      </div>

      <div className="fc-picker__summary">
        <span className="fc-picker__count">
          <strong>{previewCount}</strong> {previewCount === 1 ? 'card' : 'cards'} will be generated
        </span>
        <span className="fc-picker__from">
          from <strong>{filteredConditions.length}</strong> condition{filteredConditions.length !== 1 ? 's' : ''}
        </span>
      </div>

      <button
        className="fc-picker__start"
        onClick={handleStart}
        disabled={previewCount === 0}
      >
        <LuPlay size={18} />
        Start Session
      </button>
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
        <p className="fc-card__tap-hint">Tap to reveal</p>
      </div>

      {/* Back */}
      <div className="fc-card__face fc-card__face--back">
        <div className="fc-card__section-badge fc-card__section-badge--back">{card.section}</div>
        <p className="fc-card__answer">{card.answer}</p>

        {/* Exam tip — rendered on EVERY card per PDF spec */}
        {card.examTip && (
          <div className="fc-card__exam-tip">
            <LuAlertTriangle size={16} className="fc-card__tip-icon" />
            <div>
              <span className="fc-card__tip-heading">⚡ Exam Tip</span>
              <p className="fc-card__tip-text">{card.examTip}</p>
            </div>
          </div>
        )}

        {/* Citation footer */}
        {card.guidelineSource && (
          <div className="fc-card__citation">
            <span>{card.guidelineSource}</span>
            {card.lastReviewed && (
              <span className="fc-card__reviewed">
                <LuClock size={12} /> Reviewed {card.lastReviewed}
              </span>
            )}
            {card.guidelineUrl && (
              <a
                href={card.guidelineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="fc-card__citation-link"
                onClick={(e) => e.stopPropagation()}
              >
                <LuExternalLink size={12} /> Source
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SessionScreen
// ─────────────────────────────────────────────────────────────

function SessionScreen({ initialDeck, onComplete, onAbandon }) {
  const [deck, setDeck]         = useState(initialDeck);
  const [flipped, setFlipped]   = useState(false);
  const [animLock, setAnimLock] = useState(false);
  const [mastered, setMastered] = useState(0);
  const [total]                 = useState(initialDeck.length);

  const card = deck[0] ?? null;
  const seen  = mastered + (total - deck.length - mastered);
  // cards seen = total - remaining + mastered removed
  const remaining = deck.length;

  function handleFlip() {
    if (!flipped && !animLock) setFlipped(true);
  }

  function handleConfidence(rating) {
    if (!card || animLock) return;
    setAnimLock(true);

    // 300ms animation lock — let the flip-back complete before DOM update
    setTimeout(() => {
      setFlipped(false);

      setTimeout(() => {
        const { deck: nextDeck, mastered: wasMastered } = applyConfidence(deck, card, rating);
        if (wasMastered) setMastered((m) => m + 1);

        if (nextDeck.length === 0) {
          onComplete({ total, mastered: wasMastered ? mastered + 1 : mastered, hardCount: 0 });
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
        <LuCheckCircle size={48} color="#16a34a" />
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
      <div onClick={handleFlip} style={{ cursor: flipped ? 'default' : 'pointer' }}>
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
          <strong>Easy</strong> removes card · <strong>Medium</strong> moves to end · <strong>Hard</strong> repeats soon
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SummaryScreen
// ─────────────────────────────────────────────────────────────

function SummaryScreen({ result, onRestart, onExit }) {
  const { total, mastered } = result;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  const { emoji, label, color } =
    pct >= 80 ? { emoji: '🏆', label: 'Excellent work!',      color: '#16a34a' }
  : pct >= 60 ? { emoji: '👍', label: 'Good effort!',         color: '#d97706' }
  : pct >= 40 ? { emoji: '💪', label: 'Keep practising!',     color: '#ea580c' }
  :             { emoji: '📖', label: 'More revision needed',  color: '#dc2626' };

  const circumference = 2 * Math.PI * 54;
  const dash = circumference - (pct / 100) * circumference;

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

      <div className="fc-summary__actions">
        <button className="fc-summary__btn fc-summary__btn--primary" onClick={onRestart}>
          <LuRotateCcw size={18} /> New Session
        </button>
        <button className="fc-summary__btn fc-summary__btn--secondary" onClick={onExit}>
          <LuArrowLeft size={18} /> Back to OSCE
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
  const [view, setView]       = useState(VIEWS.PICKER);
  const [deck, setDeck]       = useState([]);
  const [result, setResult]   = useState(null);

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
      <button className="fc-page__back" onClick={() => navigate('/dashboard/osce')}>
        <LuArrowLeft size={18} />
        <span>OSCE Dashboard</span>
      </button>

      <div className="fc-page__card">
        {view === VIEWS.PICKER && (
          <PickerScreen onStart={handleStart} />
        )}

        {view === VIEWS.SESSION && deck.length > 0 && (
          <SessionScreen
            initialDeck={deck}
            onComplete={handleComplete}
            onAbandon={handleAbandon}
          />
        )}

        {view === VIEWS.SUMMARY && result && (
          <SummaryScreen
            result={result}
            onRestart={handleRestart}
            onExit={() => navigate('/dashboard/osce')}
          />
        )}
      </div>
    </div>
  );
}

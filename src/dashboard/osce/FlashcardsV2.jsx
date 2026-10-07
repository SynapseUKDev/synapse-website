import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  LuArrowLeft, LuPlay, LuX, LuChevronDown, LuChevronRight,
  LuRotateCcw, LuZap, LuThumbsUp, LuThumbsDown, LuCircleCheck, LuCalendarClock,
} from 'react-icons/lu';
import { authenticatedFetch } from '../../auth/token';
import './Flashcards.css';
import { track } from '../../usage/client.js';
import { EVENTS } from '../../usage/catalog.js';

// ─────────────────────────────────────────────────────────────
// Flashcards V2 — real per-card rows.
//
// Differences from V1 that are deliberate, per the V2 design:
//  - the card FRONT shows the question and nothing else: no specialty, topic
//    or section header, because a diagnosis question with its topic printed
//    above it has already given the answer away;
//  - the BACK is Markdown (bullets, numbered steps, bold, small tables);
//  - there is no repeated exam-tip panel;
//  - SRS is keyed by the card's real id, never a derived string;
//  - questions arrive authored — nothing here templates them.
//
// Admin-only while in beta: the route is reachable, but non-admins see a
// closed door rather than an empty deck, so "nothing here" is never ambiguous.
// ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const VIEWS = { PICKER: 'picker', SESSION: 'session', SUMMARY: 'summary' };
const MODES = { DUE: 'due', NEW: 'new', FREE: 'free' };
const MAX_NEW_CARDS_PER_SESSION = 20;

const CONFIDENCE = [
  { key: 'easy', label: 'Easy', icon: LuZap,        color: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
  { key: 'good', label: 'Good', icon: LuThumbsUp,   color: '#16a34a', bg: 'rgba(34,197,94,.12)'  },
  { key: 'hard', label: 'Hard', icon: LuThumbsDown, color: '#d97706', bg: 'rgba(245,158,11,.12)' },
];

const QA_LABEL = {
  validated: 'Validated',
  needs_attention: 'Needs attention',
  media_pending: 'Awaiting image',
  draft: 'Draft',
  validating: 'Validating',
  rejected: 'Rejected',
};

async function apiFetch(path, opts = {}) {
  const res = await authenticatedFetch(`${API_BASE}${path}`, { credentials: 'include', ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function isAdmin(user) {
  return !!user?.is_admin || !!user?.capabilities?.is_admin || !!user?.capabilities?.can_manage_osce;
}

/** Same session re-queue rule as V1: easy = mastered, good = to the back, hard = two ahead. */
function applyConfidence(deck, card, rating) {
  const next = [...deck];
  next.shift();
  if (rating === 'easy') return { deck: next, mastered: true };
  if (rating === 'good') { next.push(card); return { deck: next, mastered: false }; }
  if (next.length < 2) next.push(card); else next.splice(2, 0, card);
  return { deck: next, mastered: false };
}

// Markdown is rendered without rehype-raw on purpose: card text is model-authored,
// so raw HTML must never be interpreted. GFM gives tables and task lists.
const MD_COMPONENTS = {
  a: ({ children }) => <span>{children}</span>, // cards carry no links by policy
  img: () => null,
  h1: ({ children }) => <strong>{children}</strong>,
  h2: ({ children }) => <strong>{children}</strong>,
  h3: ({ children }) => <strong>{children}</strong>,
};

function CardBack({ markdown }) {
  return (
    <div className="fc2-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{markdown}</ReactMarkdown>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Picker — specialty → topic, with QA state visible to the reviewer
// ─────────────────────────────────────────────────────────────

function PickerScreen({ cards, loading, error, mode, onModeChange, srsStats, onStart }) {
  const [expanded, setExpanded] = useState(new Set());
  const [selectedTopics, setSelectedTopics] = useState(new Set());
  const [starting, setStarting] = useState(false);

  const tree = useMemo(() => {
    const spMap = new Map();
    for (const c of cards) {
      const spId = c.specialty?.id ?? 'unknown';
      const spName = c.specialty?.name ?? 'Other';
      const tpId = c.topic?.id ?? c.topicId;
      const tpName = c.topic?.name ?? 'Topic';
      if (!spMap.has(spId)) spMap.set(spId, { id: spId, name: spName, topics: new Map() });
      const sp = spMap.get(spId);
      if (!sp.topics.has(tpId)) sp.topics.set(tpId, { id: tpId, name: tpName, cards: [] });
      sp.topics.get(tpId).cards.push(c);
    }
    return [...spMap.values()]
      .map((sp) => ({ ...sp, topics: [...sp.topics.values()].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

  const draftCount = useMemo(() => cards.filter((c) => c.isDraft).length, [cards]);
  const attentionCount = useMemo(() => cards.filter((c) => c.qaStatus === 'needs_attention').length, [cards]);

  function toggleSpecialty(id) {
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTopic(id) {
    setSelectedTopics((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAllInSpecialty(sp) {
    const ids = sp.topics.map((t) => t.id);
    const all = ids.every((id) => selectedTopics.has(id));
    setSelectedTopics((s) => { const n = new Set(s); ids.forEach((id) => (all ? n.delete(id) : n.add(id))); return n; });
  }

  const selectedDeck = useMemo(
    () => cards.filter((c) => selectedTopics.has(c.topic?.id ?? c.topicId)),
    [cards, selectedTopics],
  );

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      if (mode === MODES.DUE) {
        const { due } = await apiFetch('/flashcards/v2/srs/due?limit=500');
        const dueSet = new Set(due.map((d) => d.card_id));
        const base = selectedTopics.size ? selectedDeck : cards;
        const deck = base.filter((c) => dueSet.has(c.id));
        if (deck.length) onStart(deck);
      } else if (mode === MODES.NEW) {
        const { seen } = await apiFetch('/flashcards/v2/srs/seen?limit=5000');
        const seenSet = new Set(seen);
        const deck = selectedDeck.filter((c) => !seenSet.has(c.id)).slice(0, MAX_NEW_CARDS_PER_SESSION);
        if (deck.length) onStart(deck);
      } else if (selectedDeck.length) {
        onStart(selectedDeck);
      }
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="fc-picker fc-picker--browser">
        <div className="fc-picker__loading"><div className="fc-spinner" /><p>Loading cards…</p></div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="fc-picker fc-picker--browser">
        <p className="fc-picker__error">Failed to load cards: {error}</p>
      </div>
    );
  }

  const dueCount = srsStats?.due_count ?? 0;
  const canStart = mode === MODES.DUE ? dueCount > 0 : selectedDeck.length > 0;

  return (
    <div className="fc-picker fc-picker--browser">
      <div className="fc-preview-banner" role="status">
        <strong>Flashcards V2 · beta</strong> — {cards.length} cards across {tree.length} specialt{tree.length === 1 ? 'y' : 'ies'}.
        {' '}{draftCount} unpublished, {attentionCount} need{attentionCount === 1 ? 's' : ''} attention. Visible to admins only.
      </div>

      <div className="fc-picker__header">
        <h2 className="fc-picker__title">Flashcards</h2>
        <p className="fc-picker__subtitle">Pick topics, choose a mode, start.</p>
      </div>

      <div className="fc-mode-tabs" role="tablist">
        {[
          [MODES.DUE, 'Due', dueCount],
          [MODES.NEW, 'New', null],
          [MODES.FREE, 'Free study', null],
        ].map(([key, label, badge]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            className={`fc-mode-tab${mode === key ? ' fc-mode-tab--active' : ''}`}
            onClick={() => onModeChange(key)}
          >
            {label}
            {badge > 0 && <span className="fc-mode-tab__badge">{badge}</span>}
          </button>
        ))}
      </div>

      <div className="fc2-tree">
        {tree.map((sp) => {
          const open = expanded.has(sp.id);
          const allSel = sp.topics.every((t) => selectedTopics.has(t.id));
          return (
            <div key={sp.id} className="fc2-tree__specialty">
              <div className="fc2-tree__row fc2-tree__row--specialty">
                <button className="fc2-tree__toggle" onClick={() => toggleSpecialty(sp.id)} aria-expanded={open}>
                  {open ? <LuChevronDown size={16} /> : <LuChevronRight size={16} />}
                  <span>{sp.name}</span>
                  <span className="fc2-tree__count">{sp.topics.length} topic{sp.topics.length === 1 ? '' : 's'}</span>
                </button>
                <label className="fc2-tree__check">
                  <input type="checkbox" checked={allSel} onChange={() => toggleAllInSpecialty(sp)} /> all
                </label>
              </div>
              {open && sp.topics.map((t) => {
                const na = t.cards.filter((c) => c.qaStatus === 'needs_attention').length;
                return (
                  <label key={t.id} className="fc2-tree__row fc2-tree__row--topic">
                    <input type="checkbox" checked={selectedTopics.has(t.id)} onChange={() => toggleTopic(t.id)} />
                    <span className="fc2-tree__topic">{t.name}</span>
                    <span className="fc2-tree__count">{t.cards.length} cards</span>
                    {na > 0 && <span className="fc2-qa fc2-qa--needs_attention">{na} need attention</span>}
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>

      <button className="fc-picker__start" disabled={!canStart || starting} onClick={start}>
        <LuPlay size={18} />
        {mode === MODES.DUE ? `Review ${dueCount} due` : `Start · ${selectedDeck.length} card${selectedDeck.length === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card — question-only front, Markdown back
// ─────────────────────────────────────────────────────────────

function FlashCard({ card, flipped }) {
  const qa = card.qaStatus;
  return (
    <div className={`fc-card${flipped ? ' fc-card--flipped' : ''}`}>
      <div className="fc-card__face fc-card__face--front ph-no-capture">
        {(card.isDraft || qa !== 'validated') && (
          <div className={`fc2-qa fc2-qa--${qa}`}>{QA_LABEL[qa] ?? qa}{card.isDraft ? ' · draft' : ''}</div>
        )}
        <p className="fc-card__question fc2-question">{card.question}</p>
        <p className="fc-card__tap-hint">Tap or press Space to reveal</p>
      </div>
      <div className="fc-card__face fc-card__face--back ph-no-capture">
        <CardBack markdown={card.answerMarkdown} />
        {card.guidelineSensitive && (
          <div className="fc-card__draft">Guideline-sensitive — verify before publishing</div>
        )}
        <p className="fc-card__tap-hint fc-card__tap-hint--back">Tap or press Space to hide and retry</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────

function SessionScreen({ initialDeck, onComplete, onAbandon, onRate }) {
  const [deck, setDeck] = useState(initialDeck);
  const [flipped, setFlipped] = useState(false);
  const [animLock, setAnimLock] = useState(false);
  const [mastered, setMastered] = useState(0);
  const [total] = useState(initialDeck.length);
  const rated = useRef([]);

  const card = deck[0] ?? null;
  const remaining = deck.length;

  useEffect(() => {
    function onKeyDown(e) {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      if (animLock) return;
      e.preventDefault();
      setFlipped((p) => !p);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [animLock]);

  function handleConfidence(rating) {
    if (!card || animLock) return;
    setAnimLock(true);
    if (onRate) {
      onRate(card.id, rating).then((r) => {
        if (r) rated.current.push({ question: card.question, rating, interval_days: r.interval_days });
      }).catch(() => {});
    }
    setTimeout(() => {
      setFlipped(false);
      setTimeout(() => {
        const { deck: nextDeck, mastered: was } = applyConfidence(deck, card, rating);
        if (was) setMastered((m) => m + 1);
        if (nextDeck.length === 0) {
          onComplete({ total, mastered: was ? mastered + 1 : mastered, ratedCards: rated.current });
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
        <button className="fc-picker__start" onClick={() => onComplete({ total, mastered, ratedCards: rated.current })}>See Results</button>
      </div>
    );
  }

  const pct = Math.round(((total - remaining) / total) * 100);

  return (
    <div className="fc-session">
      <div className="fc-session__header">
        <button className="fc-session__abandon" onClick={onAbandon} title="Exit session"><LuX size={18} /></button>
        <div className="fc-session__progress-wrap"><div className="fc-session__progress-bar" style={{ width: `${pct}%` }} /></div>
        <span className="fc-session__counter">{total - remaining}/{total}</span>
      </div>

      <div className="fc-session__score-strip">
        <span className="fc-session__stat"><span className="fc-session__stat-val" style={{ color: '#7c3aed' }}>{mastered}</span><span className="fc-session__stat-lbl">mastered</span></span>
        <span className="fc-session__divider" />
        <span className="fc-session__stat"><span className="fc-session__stat-val">{remaining}</span><span className="fc-session__stat-lbl">remaining</span></span>
      </div>

      <div onClick={() => !animLock && setFlipped((p) => !p)} style={{ cursor: animLock ? 'default' : 'pointer' }}>
        <FlashCard card={card} flipped={flipped} />
      </div>

      <div className={`fc-confidence${flipped ? ' fc-confidence--visible' : ''}`}>
        <p className="fc-confidence__prompt">How well did you know this?</p>
        <div className="fc-confidence__btns">
          {CONFIDENCE.map(({ key, label, icon: Icon, color, bg }) => (
            <button key={key} className="fc-confidence__btn" style={{ '--fc-conf-color': color, '--fc-conf-bg': bg }} onClick={() => handleConfidence(key)} disabled={animLock}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────

function SummaryScreen({ result, onRestart, onExit }) {
  const { total, mastered, ratedCards = [] } = result;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  const { emoji, label, color } =
    pct >= 80 ? { emoji: '🏆', label: 'Excellent work!', color: '#16a34a' }
    : pct >= 60 ? { emoji: '👍', label: 'Good effort!', color: '#d97706' }
    : pct >= 40 ? { emoji: '💪', label: 'Keep practising!', color: '#ea580c' }
    : { emoji: '📖', label: 'More revision needed', color: '#dc2626' };
  const circumference = 2 * Math.PI * 54;
  const dash = circumference - (pct / 100) * circumference;

  function formatInterval(days) {
    if (!days) return null;
    if (days === 1) return 'tomorrow';
    if (days < 7) return `in ${days} days`;
    const w = Math.round(days / 7);
    return `in ${w} week${w !== 1 ? 's' : ''}`;
  }

  return (
    <div className="fc-summary">
      <div className="fc-summary__grade"><span className="fc-summary__emoji">{emoji}</span><h2 className="fc-summary__label" style={{ color }}>{label}</h2></div>
      <svg className="fc-summary__ring" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" className="fc-summary__ring-track" />
        <circle cx="60" cy="60" r="54" className="fc-summary__ring-fill" style={{ stroke: color, strokeDashoffset: dash }} />
        <text x="60" y="65" className="fc-summary__ring-text">{pct}%</text>
      </svg>
      <div className="fc-summary__stats">
        <div className="fc-summary__stat-item"><span className="fc-summary__stat-val" style={{ color: '#7c3aed' }}>{mastered}</span><span className="fc-summary__stat-lbl">Mastered</span></div>
        <div className="fc-summary__divider" />
        <div className="fc-summary__stat-item"><span className="fc-summary__stat-val">{total}</span><span className="fc-summary__stat-lbl">Total Cards</span></div>
        <div className="fc-summary__divider" />
        <div className="fc-summary__stat-item"><span className="fc-summary__stat-val" style={{ color: '#dc2626' }}>{total - mastered}</span><span className="fc-summary__stat-lbl">To Review</span></div>
      </div>
      {ratedCards.length > 0 && (
        <div className="fc-summary__schedule">
          <h3 className="fc-summary__schedule-title"><LuCalendarClock size={16} /> Next Reviews</h3>
          <div className="fc-summary__schedule-list">
            {ratedCards.slice(0, 8).map((c, i) => (
              <div key={i} className="fc-summary__schedule-row">
                <span className="fc-summary__schedule-name">{c.question}</span>
                <span className={`fc-summary__schedule-when fc-summary__schedule-when--${c.rating}`}>{formatInterval(c.interval_days)}</span>
              </div>
            ))}
            {ratedCards.length > 8 && <p className="fc-summary__schedule-more">+{ratedCards.length - 8} more scheduled</p>}
          </div>
        </div>
      )}
      <div className="fc-summary__actions">
        <button className="fc-summary__btn fc-summary__btn--primary" onClick={onRestart}><LuRotateCcw size={18} /> New Session</button>
        <button className="fc-summary__btn fc-summary__btn--secondary" onClick={onExit}><LuArrowLeft size={18} /> Back to Question Bank</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────

export default function FlashcardsV2() {
  const navigate = useNavigate();
  const { user } = useOutletContext();
  const admin = isAdmin(user);

  const [view, setView] = useState(VIEWS.PICKER);
  const [mode, setMode] = useState(MODES.FREE);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deck, setDeck] = useState([]);
  const [result, setResult] = useState(null);
  const [srsStats, setSrsStats] = useState(null);

  useEffect(() => {
    if (!user || !admin) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch('/flashcards/v2/cards?preview=1')
      .then(({ cards: data }) => { if (!cancelled) setCards(data ?? []); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, admin]);

  useEffect(() => {
    if (!user || !admin || view !== VIEWS.PICKER) return;
    apiFetch('/flashcards/v2/srs/stats').then(setSrsStats).catch(() => setSrsStats(null));
  }, [user, admin, view]);

  async function handleRate(card_id, confidence) {
    try {
      return await apiFetch('/flashcards/v2/srs/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id, confidence }),
      });
    } catch { return null; }
  }

  if (!admin) {
    return (
      <div className="fc-page">
        <button className="fc-page__back" onClick={() => navigate('/dashboard/question-bank')}><LuArrowLeft size={18} /><span>Question Bank</span></button>
        <div className="fc-page__card fc-page__card--picker">
          <div className="fc-picker fc-picker--browser">
            <p className="fc-picker__error">Flashcards V2 is in admin-only beta.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-page">
      <button className="fc-page__back" onClick={() => navigate('/dashboard/question-bank')}><LuArrowLeft size={18} /><span>Question Bank</span></button>
      <div className={`fc-page__card${view === VIEWS.PICKER ? ' fc-page__card--picker' : ''}`}>
        {view === VIEWS.PICKER && (
          <PickerScreen cards={cards} loading={loading} error={error} mode={mode} onModeChange={setMode} srsStats={srsStats}
            onStart={(d) => { track(EVENTS.FLASHCARDS_SESSION_STARTED, { card_count: d.length }); setDeck(d); setView(VIEWS.SESSION); }} />
        )}
        {view === VIEWS.SESSION && deck.length > 0 && (
          <SessionScreen initialDeck={deck} onRate={handleRate}
            onComplete={(r) => { track(EVENTS.FLASHCARDS_SESSION_COMPLETED, { card_count: r.total }); setResult(r); setView(VIEWS.SUMMARY); }}
            onAbandon={() => { setDeck([]); setView(VIEWS.PICKER); }} />
        )}
        {view === VIEWS.SUMMARY && result && (
          <SummaryScreen result={result}
            onRestart={() => { setDeck([]); setResult(null); setView(VIEWS.PICKER); }}
            onExit={() => navigate('/dashboard/question-bank')} />
        )}
      </div>
    </div>
  );
}

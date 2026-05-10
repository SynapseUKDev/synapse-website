import React, { useState } from 'react';
import { LuBrain, LuCircleAlert, LuCheck, LuX, LuCopy } from 'react-icons/lu';

const PROMPT_TEMPLATES = {
  full: `# Station: [Title]
Type: [history_taking | examination | communication | procedural | emergency | data_interpretation | prescribing | documentation | paeds_obs_gynae]
Difficulty: [easy | medium | hard]
Summary: [Short description]
Diagnosis: [Diagnosis]

## Section: Instructions [Role: candidate, observer]
Markdown:
[Instructions here]

## Section: Patient Script [Role: patient, examiner, observer]
Markdown:
### Opening Statement
"..."

Key-Value:
- Site: 
- Onset: 
- Character: 
- Radiation: 
- Associated symptoms: 
- Time course: 
- Exacerbating/Relieving factors: 
- Severity: 

Key-Value:
- Past Medical History: 
- Drug History: 
- Family History: 
- Social History: 

Markdown:
### Red Flags and Escalation Points
Candidate MUST identify:
- Non-blanching rash
- Reduced consciousness
- Neck stiffness / photophobia
- Seizures
- Signs of sepsis

Markdown:
### Escalation:
- Immediate senior review
- Consider sepsis pathway
- Urgent hospital admission

Markdown:
### ICE
- Ideas: 
- Concerns: 
- Expectations: 

## Mark Scheme
Domain: [Domain Name] (Max Marks)
- [Item Description] ([Marks]) [Critical]
- [Item Description] ([Marks])

## Viva Questions
1. [Question]?
Answer: [Answer]

## Fail Criteria
- [Reason 1]
- [Reason 2]`,
  marks: `Domain: [Domain Name] (10)
- [Item Description] (2) [Critical]
- [Item Description] (1)
...`,
  viva: `1. [Question]?
Answer: [Expected Answer]
...`,
  fails: `- [Description of automatic failure reason]
- [Description 2]
...`,
  section: `Markdown:
[Content text]

Checklist:
- [Item 1]
- [Item 2]`,
  patient: `Markdown:
### Opening Statement
"..."

Key-Value:
- Site: 
- Onset: 
- Character: 
- Radiation: 
- Associated symptoms: 
- Time course: 
- Exacerbating/Relieving factors: 
- Severity: 

Key-Value:
- Past Medical History: 
- Drug History: 
- Family History: 
- Social History: 

Markdown:
### Red Flags and Escalation Points
Candidate MUST identify:
- Non-blanching rash
- Reduced consciousness
- Neck stiffness / photophobia
- Seizures
- Signs of sepsis

Markdown:
### Escalation:
- Immediate senior review
- Consider sepsis pathway
- Urgent hospital admission

Markdown:
### ICE
- Ideas: 
- Concerns: 
- Expectations: `
};

export default function OsceImportModal({ isOpen, type, onImport, onClose, isNew }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyTemplate = () => {
    const template = PROMPT_TEMPLATES[type] || PROMPT_TEMPLATES.section;
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePreview = () => {
    try {
      // Lazy load parser to keep bundle small if needed
      import('./OsceParser').then(parser => {
        let parsed = null;
        if (type === 'full') parsed = parser.parseFullStation(text);
        else if (type === 'marks') parsed = parser.parseMarkScheme(text);
        else if (type === 'viva') parsed = parser.parseViva(text);
        else if (type === 'fails') parsed = parser.parseFails(text);
        else if (type === 'section') parsed = parser.parseFullStation('## Section: New Section\n' + text);

        setPreview(parsed);
        setError(null);
      });
    } catch (e) {
      setError('Failed to parse text. Please check the format.');
    }
  };

  const schemaHints = {
    full: `# Station: Title\nType: history_taking\nDifficulty: Medium\n\n## Section: Instructions [Role: candidate]\nMarkdown: Your text here...\n\n## Mark Scheme\nDomain: Clinical (10)\n- Item 1 (2) [Critical]`,
    marks: `Domain: Communication (10)\n- Greeted patient (2)\n- Confirmed name (2) [Critical]\n\nDomain: Knowledge (20)\n- Item 1 (5)`,
    viva: `1. What is the diagnosis?\nAnswer: ACS\n\n2. Next step?\nAnswer: ECG`,
    fails: `- Rude to patient\n- Did not wash hands`,
    section: `Markdown: Type your content here...\n\nChecklist:\n- Item 1\n- Item 2`,
    patient: `Markdown:\n### Opening Statement\n"..."\n\nKey-Value:\n- Site: ...`
  };

  return (
    <div className="osce-admin-modal-overlay">
      <div className="osce-admin-modal" style={{ maxWidth: 800, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--syn-navy-800)' }}>
            <LuBrain style={{ color: 'var(--syn-primary)' }} />
            Import {type === 'full' ? 'Full Station' : type.charAt(0).toUpperCase() + type.slice(1)}
          </h2>
          <button className="osce-admin-icon-btn" onClick={onClose}><LuX size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: 20, flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--syn-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Paste the text generated below.</span>
              <button 
                onClick={handleCopyTemplate}
                className={`osce-btn osce-btn--sm ${copied ? '' : 'osce-btn--secondary'}`}
                style={{ 
                  height: 32,
                  padding: '0 12px',
                  background: copied ? 'var(--syn-green)' : undefined, 
                  borderColor: copied ? 'var(--syn-green)' : undefined,
                  color: copied ? 'white' : undefined,
                  gap: 6
                }}
              >
                {copied ? <><LuCheck size={14} /> Copied!</> : <><LuCopy size={14} /> Copy Template</>}
              </button>
            </div>
            <textarea
              className="osce-group__input"
              style={{ flex: 1, minHeight: 300, fontFamily: 'monospace', fontSize: 13, resize: 'none' }}
              placeholder={`Paste Markdown here...\n\nExample:\n${schemaHints[type]}`}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>

          {preview && (
            <div style={{ width: 300, background: 'var(--surface-tint-navy)', borderRadius: 12, padding: 16, overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parsed Preview</h4>
              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {type === 'full' && (
                  <>
                    <div style={{ fontWeight: 700 }}>{preview.station_updates?.title || 'No Title'}</div>
                    <div style={{ color: 'var(--syn-muted)' }}>{preview.sections?.length} Sections</div>
                    <div style={{ color: 'var(--syn-muted)' }}>{preview.domains?.length} Mark Domains</div>
                  </>
                )}
                {type === 'marks' && preview.map((d, i) => (
                  <div key={i}>• {d.title} ({d.items?.length} items)</div>
                ))}
                {type === 'viva' && preview.map((q, i) => (
                  <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i + 1}. {q.question_text}</div>
                ))}
                {type === 'fails' && preview.map((f, i) => (
                  <div key={i}>• {f.description}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {type === 'full' && !isNew && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <LuCircleAlert style={{ color: '#ef4444', flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
              Warning: Importing a full station will OVERWRITE all existing sections and content blocks.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="osce-btn osce-btn--secondary" onClick={onClose}>Cancel</button>
          {!preview ? (
            <button className="osce-btn" onClick={handlePreview} disabled={!text.trim()}>Preview Import</button>
          ) : (
            <button className="osce-btn" style={{ background: type === 'full' ? '#dc2626' : undefined }} onClick={() => onImport(preview)}>
              <LuCheck size={16} /> Confirm & Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

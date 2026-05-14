/**
 * Parses structured Markdown text into OSCE station data.
 * Supports: Metadata, Sections, Blocks, Mark Scheme, Viva Questions, and Fail Criteria.
 */
export function parseFullStation(text) {
  const result = {
    station_updates: {},
    sections: [],
    domains: [],
    viva_questions: [],
    fail_criteria: []
  };

  const lines = text.split('\n');
  let currentContext = null;
  let currentSection = null;
  let currentDomain = null;
  let currentViva = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line || line === '---') continue;

    // --- Station Metadata ---
    if (line.startsWith('# Station:')) {
      result.station_updates.title = line.replace('# Station:', '').trim();
      continue;
    }
    if (line.startsWith('Type:')) {
      result.station_updates.station_type = line.replace('Type:', '').trim().toLowerCase();
      continue;
    }
    if (line.startsWith('Difficulty:')) {
      result.station_updates.difficulty = line.replace('Difficulty:', '').trim().toLowerCase();
      continue;
    }
    if (line.startsWith('Summary:')) {
      result.station_updates.summary = line.replace('Summary:', '').trim();
      continue;
    }
    if (line.startsWith('Diagnosis:')) {
      result.station_updates.actual_diagnosis = line.replace('Diagnosis:', '').trim();
      continue;
    }

    // --- Top Level Headings (Context Switchers) ---
    if (line.startsWith('## Section:')) {
      currentContext = 'section';
      const titleMatch = line.match(/## Section:\s*(.*?)(?:\s*\[Role:\s*(.*?)\])?$/);
      currentSection = {
        title: titleMatch?.[1]?.trim() || 'New Section',
        visible_to: titleMatch?.[2]?.split(',').map(r => r.trim().toLowerCase()) || ['candidate', 'observer'],
        blocks: [],
        position: result.sections.length
      };
      result.sections.push(currentSection);
      continue;
    }

    if (line.startsWith('## Mark Scheme')) {
      currentContext = 'mark_scheme';
      continue;
    }

    if (line.startsWith('## Viva Questions')) {
      currentContext = 'viva';
      continue;
    }

    if (line.startsWith('## Fail Criteria')) {
      currentContext = 'fails';
      continue;
    }

    // --- Content Parsing Based on Context ---
    if (currentContext === 'section' && currentSection) {
      // Check for block type indicators
      if (line.startsWith('Markdown:')) {
        currentSection.blocks.push({
          block_type: 'markdown',
          content: { text: line.replace('Markdown:', '').trim() },
          position: currentSection.blocks.length
        });
      } else if (line.startsWith('Checklist:')) {
        currentSection.blocks.push({
          block_type: 'checklist',
          content: { items: [] },
          position: currentSection.blocks.length
        });
      } else if (line.startsWith('Key-Value:')) {
        currentSection.blocks.push({
          block_type: 'key_value',
          content: { pairs: [] },
          position: currentSection.blocks.length
        });
      } else if (line.startsWith('Table:')) {
        currentSection.blocks.push({
          block_type: 'table',
          content: { headers: [], rows: [] },
          position: currentSection.blocks.length
        });
      } else if (line.startsWith('Callout:')) {
        const parts = line.replace('Callout:', '').trim().split(' ');
        const variant = ['info', 'tip', 'warning', 'danger'].includes(parts[0]) ? parts[0] : 'info';
        const title = parts.slice(1).join(' ').trim();
        currentSection.blocks.push({
          block_type: 'callout',
          content: { variant, title, text: '' },
          position: currentSection.blocks.length
        });
      } else if (line.startsWith('Image:')) {
        currentSection.blocks.push({
          block_type: 'image',
          content: { url: line.replace('Image:', '').trim(), caption: '', width: 50 },
          position: currentSection.blocks.length
        });
      } else if (line.startsWith('List:')) {
        const ordered = line.toLowerCase().includes('ordered') && !line.toLowerCase().includes('unordered');
        currentSection.blocks.push({
          block_type: 'list',
          content: { items: [], ordered },
          position: currentSection.blocks.length
        });
      } else if (line.match(/^\s*([-*]|\d+\.)\s+/) && currentSection.blocks.length > 0) {
        // Append to last block if it's a list type
        const lastBlock = currentSection.blocks[currentSection.blocks.length - 1];
        if (lastBlock.block_type === 'checklist') {
          lastBlock.content.items.push({ label: line.replace(/^\s*([-*]|\d+\.)\s+/, '').trim(), required: false });
        } else if (lastBlock.block_type === 'key_value') {
          const parts = line.replace(/^\s*([-*]|\d+\.)\s+/, '').split(':');
          const k = parts[0];
          const v = parts.slice(1).join(':');
          lastBlock.content.pairs.push({ key: k?.trim() || '', value: v?.trim() || '' });
        } else if (lastBlock.block_type === 'table') {
          if (line.includes('|')) {
            const cells = line.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);
            if (cells.length > 0) {
              if (line.includes('---')) {
                // Skip separator row
              } else if (lastBlock.content.headers.length === 0) {
                lastBlock.content.headers = cells;
              } else {
                lastBlock.content.rows.push(cells);
              }
            }
          }
        } else if (lastBlock.block_type === 'callout') {
          lastBlock.content.text = (lastBlock.content.text ? lastBlock.content.text + '\n' : '') + rawLine;
        } else if (lastBlock.block_type === 'image') {
          if (line.startsWith('Caption:')) lastBlock.content.caption = line.replace('Caption:', '').trim();
          if (line.startsWith('Width:')) lastBlock.content.width = parseInt(line.replace('Width:', '')) || 50;
        } else if (lastBlock.block_type === 'list') {
          lastBlock.content.items.push(line.replace(/^\s*([-*]|\d+\.)\s+/, '').trim());
        } else if (lastBlock.block_type === 'markdown') {
          const text = lastBlock.content.text;
          lastBlock.content.text = (text ? text + '\n' : '') + rawLine;
        }
      } else if (currentSection.blocks.length > 0) {
        // Assume continuing markdown
        const lastBlock = currentSection.blocks[currentSection.blocks.length - 1];
        if (lastBlock.block_type === 'markdown') {
          const text = lastBlock.content.text;
          lastBlock.content.text = (text ? text + '\n' : '') + rawLine;
        }
      }
    }

    if (currentContext === 'mark_scheme') {
      if (line.startsWith('Domain:')) {
        const match = line.match(/Domain:\s*(.*?)(?:\s*\((\d+)\s*(?:marks?)?\))?$/i);
        currentDomain = {
          title: match?.[1]?.trim() || 'Domain',
          max_marks: parseInt(match?.[2] || '10'),
          items: [],
          position: result.domains.length
        };
        result.domains.push(currentDomain);
      } else if (line.match(/^\s*([-*]|\d+\.)\s+/) && currentDomain) {
        const isCritical = line.includes('[Critical]');
        const marksMatch = line.match(/\((\d+)\)/);
        const marks = parseInt(marksMatch?.[1] || '1');
        const desc = line.replace(/^\s*([-*]|\d+\.)\s+/, '').replace(/\(\d+\)/, '').replace('[Critical]', '').trim();
        currentDomain.items.push({
          description: desc,
          marks,
          is_critical: isCritical,
          position: currentDomain.items.length
        });
      }
    }

    if (currentContext === 'viva') {
      if (line.match(/^\d+\./)) {
        currentViva = {
          question_text: line.replace(/^\d+\./, '').trim(),
          answer_text: '',
          position: result.viva_questions.length
        };
        result.viva_questions.push(currentViva);
      } else if (line.startsWith('Answer:') && currentViva) {
        currentViva.answer_text = line.replace('Answer:', '').trim();
      } else if (currentViva) {
        currentViva.answer_text += (currentViva.answer_text ? '\n' : '') + line;
      }
    }

    if (currentContext === 'fails') {
      if (line.match(/^\s*([-*]|\d+\.)\s+/)) {
        result.fail_criteria.push({
          description: line.replace(/^\s*([-*]|\d+\.)\s+/, '').trim(),
          position: result.fail_criteria.length
        });
      }
    }
  }

  return result;
}

export function parseMarkScheme(text) {
  const full = parseFullStation('## Mark Scheme\n' + text);
  return full.domains;
}

export function parseViva(text) {
  const full = parseFullStation('## Viva Questions\n' + text);
  return full.viva_questions;
}

export function parseFails(text) {
  const full = parseFullStation('## Fail Criteria\n' + text);
  return full.fail_criteria;
}

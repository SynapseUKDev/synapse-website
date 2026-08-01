/**
 * Reading a student roster out of a CSV, in the browser.
 *
 * Parsing here means the backend only ever receives JSON rows, so there is no
 * file handling on the server and no spreadsheet dependency on either side.
 */

/** Header spellings we accept, compared after lowercasing and collapsing separators. */
const COLUMN_ALIASES = {
  name: ['name', 'full name', 'student name', 'student'],
  email: ['email', 'email address', 'e mail'],
  year_group: ['year group', 'year', 'cohort', 'yeargroup', 'group'],
}

/**
 * Minimal RFC-4180 parser, ported from the mock paper importer on the backend.
 * Handles quoted fields, escaped quotes and commas inside values, which is
 * what a spreadsheet exports when a name contains a comma.
 */
export function parseCsv(text) {
  const lines = []
  let field = ''
  let row = []
  let inQuotes = false
  const normalised = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < normalised.length; i += 1) {
    const ch = normalised[i]
    if (inQuotes) {
      if (ch === '"' && normalised[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      field = ''
      lines.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((f) => f !== '')) lines.push(row)

  return lines
}

/** "Year Group" and "year_group" both become "year group". */
function normaliseHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
}

/** Match each column we care about to a position in the header row, if present. */
function mapColumns(headers) {
  const cleaned = headers.map(normaliseHeader)
  const find = (aliases) => cleaned.findIndex((h) => aliases.includes(h))
  return {
    name: find(COLUMN_ALIASES.name),
    email: find(COLUMN_ALIASES.email),
    year_group: find(COLUMN_ALIASES.year_group),
  }
}

function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.readAsText(file)
  })
}

/**
 * Rows of `{ name, email, year_group }` from an uploaded CSV.
 *
 * Throws with a message meant for the admin. Only blank lines are dropped:
 * everything else is left for the backend planner to judge, so the rules are
 * not written twice and cannot disagree.
 */
export async function readRosterCsv(file) {
  if (!/\.csv$/i.test(file.name)) {
    throw new Error('That is not a CSV file.')
  }

  const lines = parseCsv(await readText(file))
  if (lines.length < 2) throw new Error('That file has a header row but no students in it.')

  const columns = mapColumns(lines[0])
  if (columns.email === -1) {
    throw new Error('The file needs a column called Email. Name and Year group are optional.')
  }

  const rows = lines
    .slice(1)
    .map((cells) => ({
      name: columns.name === -1 ? '' : (cells[columns.name] || '').trim(),
      email: (cells[columns.email] || '').trim(),
      year_group: columns.year_group === -1 ? '' : (cells[columns.year_group] || '').trim(),
    }))
    .filter((row) => row.name || row.email || row.year_group)

  if (rows.length === 0) throw new Error('That file has a header row but no students in it.')
  return rows
}

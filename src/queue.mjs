import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { PATHS } from './config.mjs';

export const QUEUE_COLUMNS = [
  'company',
  'title',
  'location',
  'ats_type',
  'job_url',
  'posted_at',
  'score',
  'reason',
  'matched_keywords',
  'sponsorship_signal',
  'apply_mode',
  'status',
];

export function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function serializeCsv(rows) {
  const lines = [QUEUE_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(QUEUE_COLUMNS.map(column => csvEscape(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

export function readQueue(path = PATHS.queue) {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

export function writeQueue(rows, path = PATHS.queue) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeCsv(rows), 'utf8');
}

export function dedupQueueRows(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = String(row.job_url || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

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

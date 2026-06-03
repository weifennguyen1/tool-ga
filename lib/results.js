const fs = require('fs');
const XLSX = require('xlsx');
const { resultPath } = require('./paths');

function normalizeLink(url) {
  if (!url || typeof url !== 'string') return '';
  let s = url.trim();
  try {
    const u = new URL(s);
    u.hash = '';
    s = u.toString();
  } catch {
    /* giữ nguyên nếu không parse được */
  }
  if (s.endsWith('/')) s = s.slice(0, -1);
  return s.toLowerCase();
}

function readAllDrawRows() {
  const file = resultPath();
  if (!fs.existsSync(file)) return [];

  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const draws = [];
  for (let i = 1; i < rows.length; i++) {
    const [link, date, number] = rows[i];
    if (link === '' && date === '' && number === '') continue;
    draws.push({
      link: String(link || '').trim(),
      date: String(date || '').trim(),
      number: number
    });
  }
  return draws;
}

function getDrawsForLink(targetLink) {
  const norm = normalizeLink(targetLink);
  if (!norm) return [];

  return readAllDrawRows()
    .filter(row => normalizeLink(row.link) === norm)
    .map(row => ({
      number: row.number,
      date: row.date
    }))
    .reverse();
}

module.exports = { normalizeLink, getDrawsForLink, readAllDrawRows };

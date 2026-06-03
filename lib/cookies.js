const fs = require('fs');
const path = require('path');
const { ASSETS_DIR, importedCookiePath } = require('./paths');

const DATED_COOKIE_RE = /^www\.facebook\.com_(\d{2})-(\d{2})-(\d{4})\.json$/;

function parseCookieFilename(filename) {
  const m = filename.match(DATED_COOKIE_RE);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(date.getTime()) ? null : date;
}

function listDatedCookieFiles() {
  if (!fs.existsSync(ASSETS_DIR)) return [];

  return fs
    .readdirSync(ASSETS_DIR)
    .filter(name => DATED_COOKIE_RE.test(name))
    .map(name => ({
      name,
      path: path.join(ASSETS_DIR, name),
      date: parseCookieFilename(name)
    }))
    .filter(entry => entry.date)
    .sort((a, b) => b.date - a.date);
}

function findLatestDatedCookie() {
  return listDatedCookieFiles()[0] || null;
}

/** Ưu tiên cookie dated mới nhất, sau đó file import thủ công. */
function resolveCookiesPath() {
  const latest = findLatestDatedCookie();
  if (latest) {
    return {
      path: latest.path,
      file: latest.name,
      source: 'auto',
      requiresImport: false
    };
  }

  const imported = importedCookiePath();
  if (fs.existsSync(imported)) {
    return {
      path: imported,
      file: 'facebook-cookies.json',
      source: 'import',
      requiresImport: false
    };
  }

  return {
    path: imported,
    file: null,
    source: 'none',
    requiresImport: true
  };
}

module.exports = {
  findLatestDatedCookie,
  resolveCookiesPath,
  listDatedCookieFiles
};

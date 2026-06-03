const fs = require('fs');
const path = require('path');
const { ROOT, ASSETS_DIR } = require('./paths');
const { ensureAssetsDir } = require('./settings');

const ROOT_FILES = [
  'link.txt',
  'facebook_comment_numbers.txt',
  'ga-result.xlsx',
  'settings.json',
  'facebook-cookies.json'
];

const DATED_COOKIE_RE = /^www\.facebook\.com_\d{2}-\d{2}-\d{4}\.json$/;

function migrateRootDataToAssets() {
  ensureAssetsDir();

  for (const name of ROOT_FILES) {
    const from = path.join(ROOT, name);
    const to = path.join(ASSETS_DIR, name);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      fs.renameSync(from, to);
    }
  }

  if (!fs.existsSync(ROOT)) return;

  for (const name of fs.readdirSync(ROOT)) {
    if (!DATED_COOKIE_RE.test(name)) continue;
    const from = path.join(ROOT, name);
    const to = path.join(ASSETS_DIR, name);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      fs.renameSync(from, to);
    }
  }
}

module.exports = { migrateRootDataToAssets };

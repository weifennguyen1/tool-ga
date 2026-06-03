const fs = require('fs');
const path = require('path');
const { ASSETS_DIR } = require('./paths');

const ROOT = path.join(__dirname, '..');
const SETTINGS_FILE = path.join(ASSETS_DIR, 'settings.json');

const DEFAULTS = {
  randomMin: 0,
  randomMax: 9999
};

function ensureAssetsDir() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }
}

function loadSettings() {
  ensureAssetsDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    saveSettings(DEFAULTS);
    return { ...DEFAULTS };
  }
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    return {
      randomMin: Number.isFinite(Number(data.randomMin)) ? Number(data.randomMin) : DEFAULTS.randomMin,
      randomMax: Number.isFinite(Number(data.randomMax)) ? Number(data.randomMax) : DEFAULTS.randomMax
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(partial) {
  ensureAssetsDir();
  const current = loadSettings();
  const next = { ...current, ...partial };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = {
  ROOT,
  ASSETS_DIR,
  SETTINGS_FILE,
  DEFAULTS,
  ensureAssetsDir,
  loadSettings,
  saveSettings
};

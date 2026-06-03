const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');

const linkPath = () => path.join(ASSETS_DIR, 'link.txt');
const numbersPath = () => path.join(ASSETS_DIR, 'facebook_comment_numbers.txt');
const resultPath = () => path.join(ASSETS_DIR, 'ga-result.xlsx');
const importedCookiePath = () => path.join(ASSETS_DIR, 'facebook-cookies.json');

module.exports = {
  ROOT,
  ASSETS_DIR,
  linkPath,
  numbersPath,
  resultPath,
  importedCookiePath
};

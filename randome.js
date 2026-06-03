const fs = require('fs');
const XLSX = require('xlsx');
const { loadSettings } = require('./lib/settings');
const { linkPath, numbersPath, resultPath } = require('./lib/paths');
const HEADERS = ['Links', 'Date', 'Number'];

function formatDate(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function readPostLink() {
  const file = linkPath();
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }
  return fs.readFileSync(file, 'utf8').trim();
}

function appendResultLog(link, number, date = new Date()) {
  let rows;

  const resultFile = resultPath();
  if (fs.existsSync(resultFile)) {
    const workbook = XLSX.readFile(resultFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows.length) rows = [HEADERS];
  } else {
    rows = [HEADERS];
  }

  rows.push([link, formatDate(date), number]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Log');
  XLSX.writeFile(workbook, resultFile);

  console.log(`✅ Saved log: ${resultFile} (row ${rows.length - 1})`);
  return resultFile;
}

function generateUniqueRandomNumberFromFile(filePath, min, max) {
  const content = fs.readFileSync(filePath, 'utf8');
  const existingNumbers = content
    .split('\n')
    .map(n => Number(n.trim()))
    .filter(n => !isNaN(n));

  let randomNumber;
  let attempts = 0;

  do {
    randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    attempts++;
    if (attempts > 1000) {
      randomNumber = -1;
      for (let i = min; i <= max; i++) {
        if (existingNumbers.indexOf(i) === -1) {
          randomNumber = i;
          break;
        }
      }
      break;
    }
  } while (existingNumbers.indexOf(randomNumber) !== -1);

  if (randomNumber === -1) {
    console.log('No unique number in range!!!');
    const frequency = {};
    for (const num of existingNumbers) {
      frequency[num] = (frequency[num] || 0) + 1;
    }
    const uniqueOnce = existingNumbers.filter(num => frequency[num] === 1);
    console.log('List numbers that appear only once:', uniqueOnce);
  } else {
    console.log('Generated unique number not in file:', randomNumber);
  }

  return randomNumber;
}

function runRandom() {
  const { randomMin, randomMax } = loadSettings();
  const min = Math.min(randomMin, randomMax);
  const max = Math.max(randomMin, randomMax);
  const link = readPostLink();
  const number = generateUniqueRandomNumberFromFile(numbersPath(), min, max);
  appendResultLog(link, number);
  return { link, number, min, max };
}

if (require.main === module) {
  runRandom();
}

module.exports = { runRandom };

const fs = require('fs');

function generateUniqueRandomNumberFromFile(filePath, min, max) {
  const content = fs.readFileSync(filePath, 'utf8');
  const existingNumbers = new Set(content.split('\n').map(n => n.trim()));

  let randomNumber;
  let attempts = 0;
  do {
    randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    attempts++;
    if (attempts > 1000) throw new Error('Unable to find unique number in given range');
  } while (existingNumbers.has(randomNumber.toString()));

  console.log('Generated unique number not in file:', randomNumber);
  return randomNumber;
}

generateUniqueRandomNumberFromFile('facebook_comment_numbers.txt', 0, 999)
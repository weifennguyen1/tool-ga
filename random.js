const fs = require('fs');

function generateUniqueRandomNumberFromFile(filePath, min, max) {
  const content = fs.readFileSync(filePath, 'utf8');
  const existingNumbers = new Set(content.split('\n').map(n => Number(n.trim())));

  let randomNumber;
  let attempts = 0;

  do {
    randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    attempts++;
    if (attempts > 1000) {
      randomNumber = -1;
      for (let i = min; i <= max; i++) {
        if (!existingNumbers.has(i)) {
          randomNumber = i;
          break;
        }
      }
      break;
    }
  } while (existingNumbers.has(randomNumber));

  if (randomNumber == -1) {
    console.log('No unique number in range');
  } else {
    console.log('Generated unique number not in file:', randomNumber);
  }
  
  return randomNumber;
}

generateUniqueRandomNumberFromFile('facebook_comment_numbers.txt', 0, 99)
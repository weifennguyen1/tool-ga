const fs = require('fs');

function generateUniqueRandomNumberFromFile(filePath, min, max) {
  const content = fs.readFileSync(filePath, 'utf8');
  const existingNumbers = content.split('\n').map(n => Number(n.trim())).filter(n => !isNaN(n));

  let randomNumber;
  let attempts = 0;

  do {
    randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    attempts++;
    if (attempts > 1000) {
      randomNumber = -1;
      for (let i = min; i <= max; i++) {
        if (existingNumbers.indexOf(i) == -1) {
          randomNumber = i;
          break;
        }
      }
      break;
    }
  } while (existingNumbers.indexOf(randomNumber) != -1);

  if (randomNumber == -1) {
    console.log('No unique number in range!!!');
    const numberList = existingNumbers;
    const frequency = {};
    for (const num of numberList) {
      frequency[num] = (frequency[num] || 0) + 1;
    }

    const uniqueOnce = numberList.filter(num => frequency[num] === 1);

    console.log('List numbers that appear only once:', uniqueOnce);
  } else {
    console.log('Generated unique number not in file:', randomNumber);
  }
  
  return randomNumber;
}

generateUniqueRandomNumberFromFile('facebook_comment_numbers.txt', 0,999)
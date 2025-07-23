const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline/promises');
const { exec } = require('child_process');

var FACEBOOK_POST_URL = '';
const COOKIES_PATH = './www.facebook.com_21-07-2025.json';
const loadTimePerBatch = 2.1; // seconds, from observation

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

(async () => {
  FACEBOOK_POST_URL = fs.readFileSync('link.txt', 'utf8');
  const browser = await puppeteer.launch({
    headless: true, // open chrome browser
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  // Load cookies from file if available
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    console.log('✅ Loaded cookies from file.');
  }

  // Go to Facebook post directly
  await page.goto(FACEBOOK_POST_URL, { waitUntil: 'networkidle2' });

  // If redirected to login, allow manual login and save cookies
  if (page.url().includes('login')) {
    console.log('\n⏳ Please log in manually...');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('✅ Cookies saved after login.');

    await page.goto(FACEBOOK_POST_URL, { waitUntil: 'networkidle2' });
  }

  // Wait for comments to load
  await page.waitForSelector('[aria-label="Comment"]');

  // Wait for "Most relevant" button and click it
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('span')].some(el => el.textContent.includes('Most relevant'));
  });

  await page.evaluate(() => {
    const items = [...document.querySelectorAll('span')];
    const sortSpan = items.find(el => el.textContent.includes('Most relevant'));
    if (sortSpan) sortSpan.click();
  });

  // Select "Newest" from the dropdown
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('span')];
    const newest = items.find(el => el.textContent.includes('All comments'));
    if (newest) newest.click();
  });

  console.log('✅ Selected "All comments" sort. Now loading all comments...');

  // Extract comment progress and estimate load time
  const progressText = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('span, div'))
      .map(el => el.textContent.trim())
      .filter(text => /^\d+\s+of\s+\d+$/.test(text));
    return elements.length > 0 ? elements[0] : null;
  });

  if (progressText) {
    const [loaded, total] = progressText.split('of').map(s => parseInt(s.trim(), 10));
    const estimatedTimeSec = ((total - loaded) / loaded) * loadTimePerBatch;
    const minutes = Math.floor(estimatedTimeSec / 60);
    const seconds = Math.round(estimatedTimeSec % 60);

    console.log(`⏱️ Estimated time to load all comments with progressText: ${minutes}m ${seconds}s`);
  } else {
    console.log('⚠️ Could not estimated time to load all comments.');

    const input = await rl.question('💬 Please input the current comments loaded and the total comments (e.g. 6 364): ');
    const [loadedStr, totalStr] = input.trim().split(/\s+/);
    const loaded = parseInt(loadedStr, 10);
    const total = parseInt(totalStr, 10);
    if (!isNaN(loaded) && !isNaN(total) && total > loaded) {
      const estimatedTimeSec = ((total - loaded) / loaded) * loadTimePerBatch;
      const minutes = Math.floor(estimatedTimeSec / 60);
      const seconds = Math.round(estimatedTimeSec % 60);
      console.log(`⏱️ Estimated time to load all comments: ${minutes}m ${seconds}s`);
    } else {
      console.log('⚠️ Invalid input. Skipping time estimation.');
    }
  }

  // Auto-scroll and click "View more comments" until fully loaded
  try {
    let loadMoreVisible = true;
    while (loadMoreVisible) {
      console.time('LoadComments');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 2000));

      const clicked = await page.evaluate(() => {
        const moreButtons = Array.from(document.querySelectorAll('span'))
          .filter(el => el.textContent.includes('View more comments'));
        if (moreButtons.length > 0) {
          moreButtons[0].click();
          return true;
        }
        return false;
      });

      if (!clicked) loadMoreVisible = false;
      console.timeEnd('LoadComments');
    }
  } catch (e) {
    console.log('⚠️ Error during loading comment:', e.message);
  }

  // Extract comments (text only)
  const comments = await page.evaluate(() => {
    const commentEls = document.querySelectorAll('div[aria-label^="Comment by"]');
    return Array.from(commentEls).map(el => {
      const textEl = el.querySelector('div[dir="auto"]');
      return textEl ? textEl.innerText.trim() : '';
    }).filter(Boolean);
  });

  // Extract numbers with length >= 2
  const numbers = [];
  comments.forEach(comment => {
    const found = comment.match(/\b\d{2,}\b/g);
    if (found) {
      numbers.push(...found);
    }
  });

  console.log(`✅ Total comments extracted: ${comments.length}`);

  // Write file output
  const output = numbers.join('\n');
  fs.writeFileSync('facebook_comment_numbers.txt', output, 'utf8');
  console.log(`✅ Exported list numbers of comment to facebook_comment_numbers.txt`);
  exec(process.platform === 'win32' ? 'start facebook_comment_numbers.txt' :
    process.platform === 'darwin' ? 'open facebook_comment_numbers.txt' :
      'xdg-open facebook_comment_numbers.txt');
  await browser.close();
})();

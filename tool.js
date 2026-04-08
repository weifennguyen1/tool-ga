const puppeteer = require('puppeteer');
const fs = require('fs');
const { text } = require('stream/consumers');

var FACEBOOK_POST_URL = '';
const COOKIES_PATH = './www.facebook.com_04-02-2026.json';

(async () => {
  FACEBOOK_POST_URL = fs.readFileSync('link.txt', 'utf8').trim();

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  // Load cookies
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    console.log('✅ Loaded cookies.');
  }

  await page.goto(FACEBOOK_POST_URL, { waitUntil: 'networkidle2' });

  // Login nếu cần
  if (page.url().includes('login')) {
    console.log('⏳ Please login manually...');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('✅ Cookies saved.');

    await page.goto(FACEBOOK_POST_URL, { waitUntil: 'networkidle2' });
  }

  // ✅ FIX: Wait comment load
  await page.waitForSelector('div[role="article"]');

  // ✅ FIX: chọn sort comment (đa ngôn ngữ)
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('span')]
      .some(el => /relevant|phù hợp|liên quan/i.test(el.textContent));
  });

  await page.evaluate(() => {
    const items = [...document.querySelectorAll('span')];
    const sortBtn = items.find(el =>
      /relevant|phù hợp|liên quan/i.test(el.textContent)
    );
    if (sortBtn) sortBtn.click();
  });

  await new Promise(r => setTimeout(r, 1500));

// chọn "All comments" đúng cách
await page.evaluate(() => {
  const menuItems = [...document.querySelectorAll('[role="menuitem"]')];

  // Ưu tiên ALL COMMENTS trước
  let target = menuItems.find(el =>
    /all comments|tất cả bình luận/i.test(el.textContent)
  );

  // fallback nếu không có
  if (!target) {
    target = menuItems.find(el =>
      /all|tất cả/i.test(el.textContent)
    );
  }

  if (target) target.click();
});

  console.log('✅ Switched to all comments');

  console.log(`⏱️ Start: ${new Date().toLocaleTimeString()}`);

  // ✅ LOAD ALL COMMENTS
  let countPress = 0;
  let hasMore = true;

  while (hasMore) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 2);
    });

    await new Promise(r => setTimeout(r, 2500));

    const clicked = await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('div[role="button"], span')
      );

      const btn = buttons.find(el =>
        /more comments|xem thêm bình luận|view more/i.test(el.textContent)
      );

      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log(`✅ Clicked "view more": ${countPress} times`);
      countPress++;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Clicked "view more": ${countPress} times`);

  // ✅ FIX: Extract comments
  const comments = await page.evaluate(() => {
    const nodes = document.querySelectorAll('div[role="article"]');

    return Array.from(nodes).map(el => {
      const texts = el.querySelectorAll('div[dir="auto"]');
      console.log(texts)

      return Array.from(texts)
        .map(t => t.innerText.trim())
        .join(' ');
    }).filter(Boolean);
  });

  console.log(`✅ Total comments: ${comments.length}`);

  // Extract numbers
  const numbers = [];
  comments.forEach(c => {
    const found = c.match(/\b\d{2,}\b/g);
    if (found) numbers.push(...found);
  });

  fs.writeFileSync('facebook_comment_numbers.txt', numbers.join('\n'));
  console.log('✅ Exported file');

  await browser.close();
})();
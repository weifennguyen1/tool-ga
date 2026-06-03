const puppeteer = require('puppeteer');
const fs = require('fs');
const { resolveCookiesPath } = require('./lib/cookies');
const { linkPath, numbersPath } = require('./lib/paths');
const SORT_WAIT_MS = 8000;
const SORT_PATTERN =
  'most relevant|phù hợp nhất|newest|mới nhất|all comments|tất cả bình luận|top comments';

function normalizeCookies(raw) {
  return raw.map(cookie => {
    const c = { ...cookie };
    if (!c.domain) c.domain = '.facebook.com';
    if (c.expirationDate != null && c.expires == null) {
      c.expires = c.expirationDate;
    }
    if (typeof c.expiry === 'string') c.expires = Number(c.expiry);
    if (c.sameSite === 'no_restriction') c.sameSite = 'None';
    else if (typeof c.sameSite === 'string') {
      c.sameSite = c.sameSite.charAt(0).toUpperCase() + c.sameSite.slice(1).toLowerCase();
    }
    delete c.expirationDate;
    delete c.expiry;
    delete c.hostOnly;
    delete c.session;
    delete c.storeId;
    return c;
  });
}

async function loadFacebookCookies(page, cookiesPath) {
  if (!fs.existsSync(cookiesPath)) {
    console.log('⚠️ No cookie file — login manually if needed.');
    return;
  }

  const cookies = normalizeCookies(JSON.parse(fs.readFileSync(cookiesPath, 'utf8')));
  await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' });

  let loaded = 0;
  for (const cookie of cookies) {
    try {
      await page.setCookie(cookie);
      loaded++;
    } catch {
      // skip invalid / expired cookies
    }
  }
  console.log(`✅ Loaded ${loaded}/${cookies.length} cookies.`);
}

/** Mở menu sort (nếu có) và chọn Tất cả bình luận, hoặc Mới nhất. Không throw khi profile không có menu. */
async function trySwitchCommentSort(page) {
  const hasSort = await page
    .waitForFunction(
      pattern => {
        const label = new RegExp(`^(${pattern})$`, 'i');
        return [...document.querySelectorAll('span')].some(el => {
          const t = (el.textContent || '').trim();
          return t.length > 0 && t.length < 50 && label.test(t);
        });
      },
      { timeout: SORT_WAIT_MS },
      SORT_PATTERN
    )
    .then(() => true)
    .catch(() => false);

  if (!hasSort) {
    console.log('ℹ️ Profile này không có menu sắp xếp bình luận — bỏ qua, tiếp tục load.');
    return false;
  }

  const openResult = await page.evaluate(pattern => {
    const label = new RegExp(`^(${pattern})$`, 'i');
    const spans = [...document.querySelectorAll('span')];
    const trigger = spans.find(el => {
      const t = (el.textContent || '').trim();
      return t.length > 0 && t.length < 50 && label.test(t);
    });
    if (!trigger) return 'missing';

    const current = (trigger.textContent || '').trim();
    if (/all comments|tất cả bình luận/i.test(current)) return 'already_all';

    trigger.click();
    return 'opened';
  }, SORT_PATTERN);

  if (openResult === 'missing') {
    console.log('ℹ️ Không tìm thấy nút sort — tiếp tục load.');
    return false;
  }
  if (openResult === 'already_all') {
    console.log('✅ Đang ở chế độ Tất cả bình luận.');
    return true;
  }

  await new Promise(r => setTimeout(r, 1500));

  const picked = await page.evaluate(() => {
    const menuItems = [...document.querySelectorAll('[role="menuitem"]')];

    const all = menuItems.find(el =>
      /all comments|tất cả bình luận/i.test(el.textContent || '')
    );
    if (all) {
      all.click();
      return 'all';
    }

    const newest = menuItems.find(el =>
      /newest|mới nhất/i.test(el.textContent || '')
    );
    if (newest) {
      newest.click();
      return 'newest';
    }

    return null;
  });

  if (picked === 'all') console.log('✅ Đã chuyển sang Tất cả bình luận.');
  else if (picked === 'newest') console.log('✅ Đã chuyển sang Mới nhất (không có Tất cả bình luận).');
  else console.log('⚠️ Có menu sort nhưng không chọn được mục — tiếp tục load.');

  return !!picked;
}

async function runCrawl() {
  const cookie = resolveCookiesPath();
  if (cookie.requiresImport) {
    throw new Error(
      'Chưa có file cookie Facebook (www.facebook.com_DD-MM-YYYY.json). Import profile trên web UI.'
    );
  }
  const COOKIES_PATH = cookie.path;
  const FACEBOOK_POST_URL = fs.readFileSync(linkPath(), 'utf8').trim();

  const launchOptions = {
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  };
  if (process.env.CHROME_PATH) {
    launchOptions.executablePath = process.env.CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
  });

  await loadFacebookCookies(page, COOKIES_PATH);
  await page.goto(FACEBOOK_POST_URL, { waitUntil: 'networkidle2' });

  if (page.url().includes('login')) {
    console.log('⏳ Please login manually...');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('✅ Cookies saved.');

    await page.goto(FACEBOOK_POST_URL, { waitUntil: 'networkidle2' });
  }

  await page.waitForSelector('div[role="article"]', { timeout: 60000 });
  await trySwitchCommentSort(page);

  console.log(`⏱️ Start: ${new Date().toLocaleTimeString()}`);

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

  const comments = await page.evaluate(() => {
    const nodes = document.querySelectorAll('div[role="article"]');

    return Array.from(nodes)
      .map(el => {
        const texts = el.querySelectorAll('div[dir="auto"]');
        return Array.from(texts)
          .map(t => t.innerText.trim())
          .join(' ');
      })
      .filter(Boolean);
  });

  console.log(`✅ Total comments: ${comments.length}`);

  const numbers = [];
  comments.forEach(c => {
    const found = c.match(/\b\d{2,}\b/g);
    if (found) numbers.push(...found);
  });

  fs.writeFileSync(numbersPath(), numbers.join('\n'));
  console.log('✅ Exported file');

  await browser.close();
}

if (require.main === module) {
  runCrawl().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runCrawl };

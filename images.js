const puppeteer = require('puppeteer');
const fs = require('fs');

const COOKIES_FILE_PATH = './www.facebook.com_06-07-2025.json';
const FACEBOOK_POST_URL = 'https://www.facebook.com/TrungTamTiengHan/posts/pfbid07xN4BnP2idkv7G2d5P7bz4gKjWZtPwx62s6xbrAqrmkyy1uWJ3TQQprpCGFhNo5Vl';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // Load cookies
  const cookiesString = fs.readFileSync(COOKIES_FILE_PATH, 'utf8');
  const cookies = JSON.parse(cookiesString);
  await page.setCookie(...cookies);
  console.log('✅ Cookies loaded.');

  await page.goto(FACEBOOK_POST_URL, { waitUntil: 'networkidle2' });
  console.log('🌐 Page loaded.');

  // Select "All comments" filter using text matching
  try {
    await new Promise(resolve => setTimeout(resolve, 3000)); // let DOM settle

    const dialog = await page.$('[role="dialog"]');
    const allDivs = dialog ? await dialog.$$('div') : [];
    let mostRelevantHandle = null;

    for (const div of allDivs) {
      const text = await page.evaluate(el => el.textContent, div);
      if (text?.includes('Most relevant')) {
        mostRelevantHandle = div;
        break;
      }
    }

    if (mostRelevantHandle) {
      const box = await mostRelevantHandle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        console.log('🖱️ Fallback mouse click on Most relevant');
      } else {
        console.log('❌ Could not get bounding box of Most relevant');
      }
      console.log('🔽 Clicked Most relevant');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const spanTexts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('span')).map(span => span.textContent?.trim());
      });
      console.log('🔍 Available span options:', spanTexts);

      const clickedAll = await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('div'));
        const all = divs.find(div => {
          const text = div.textContent?.toLowerCase();
          return text?.includes('all comments') || text?.includes('tất cả bình luận');
        });
        if (all) {
          all.click();
          return true;
        }
        return false;
      });

      if (clickedAll) {
        console.log('✅ Switched to All comments.');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log('⚠️ "All comments" option not found.');
      }
    }
  } catch (err) {
    console.log('⚠️ Error switching comment sort mode:', err.message);
  }

  // Dynamically detect the scrollable container after page load
  // const scrollableHandle = await page.evaluateHandle(() => {
  //   const candidates = Array.from(document.querySelectorAll('div'));
  //   return candidates.reduce((best, el) => {
  //     const height = el.scrollHeight || 0;
  //     const client = el.clientHeight || 0;
  //     const scrollable = height > client + 100;
  //     if (scrollable && (!best || el.scrollHeight > best.scrollHeight)) {
  //       return el;
  //     }
  //     return best;
  //   }, null);
  // });

  // console.log(`🔍 Dynamically detected scrollable container.`);

  // let sameHeightCounter = 0;
  // let previousHeight = 0;

  // while (sameHeightCounter < 5) {
  //   const scrollHeight = await page.evaluate((el) => {
  //     el.scrollBy(0, 1000);
  //     return el.scrollHeight;
  //   }, scrollableHandle);

  //   console.log(`🔽 Scrolling... Height: ${scrollHeight}`);

  //   if (scrollHeight === previousHeight) {
  //     sameHeightCounter++;
  //   } else {
  //     sameHeightCounter = 0;
  //     previousHeight = scrollHeight;
  //   }

  //   await new Promise(resolve => setTimeout(resolve, 2500));
  // }

  // console.log('✅ Finished scrolling. Extracting comments...');

  // const comments = await page.evaluate(() => {
  //   const spans = document.querySelectorAll('[data-ad-preview="message"] span');
  //   return Array.from(spans).map(span => span.innerText).filter(Boolean);
  // });

  // console.log(`🗨️ Total Comments Loaded: ${comments.length}`);
  // console.log(comments);

  // await browser.close();
})();

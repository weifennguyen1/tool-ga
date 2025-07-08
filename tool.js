const fs = require('fs');
const { Builder, By, until } = require('selenium-webdriver');

function exportNumbersToExcel(numbers) {
  const output = numbers.join('\n');
  fs.writeFileSync('facebook_comment_numbers.txt', output, 'utf8');
  console.log('--------------------Exported numbers to facebook_comment_numbers.xlsx--------------------');
}

async function extractFacebookCommentTexts() {
  const page = fs.readFileSync('link.txt', 'utf8');

  const driver = await new Builder().forBrowser('chrome').build();

  try {
    // Load cookies from file
    const cookies = JSON.parse(fs.readFileSync('www.facebook.com_06-07-2025.json'));

    // Initial navigation required to set cookies
    await driver.get('https://www.facebook.com');
    for (let cookie of cookies) {
      // Patch domain if missing
      if (!cookie.domain) {
        cookie.domain = '.facebook.com';
      }

      // Convert expiry to number if needed
      if (typeof cookie.expiry === 'string') {
        cookie.expiry = Number(cookie.expiry);
      }

      // Fix invalid SameSite value
      if (cookie.sameSite === 'no_restriction') {
        cookie.sameSite = 'None';
      } else if (cookie.sameSite === 'lax') {
        cookie.sameSite = 'Lax';
      } else if (cookie.sameSite === 'strict') {
        cookie.sameSite = 'Strict';
      }

      try {
        await driver.manage().addCookie(cookie);
      } catch (err) {
        console.warn('Skipping invalid cookie:', cookie.name, err.message);
      }
    }

    // Navigate to the target Facebook post/page
    await driver.get(page);

        // Try selecting "All comments" instead of "Most Relevant"
    try {
      await driver.wait(until.elementLocated(By.xpath("//span[contains(text(), 'Most relevant') or contains(text(), 'All comments')]")), 10000);
      const filterButton = await driver.findElement(By.xpath("//span[contains(text(), 'Most relevant') or contains(text(), 'All comments')]"));
      await driver.executeScript("arguments[0].scrollIntoView({behavior: 'auto', block: 'center'});", filterButton);
      await filterButton.click();
      await driver.sleep(1000);

      const allCommentsOption = await driver.findElement(By.xpath("//span[text()='All comments']"));
      await allCommentsOption.click();
      await driver.sleep(2000);
    } catch (err) {
      console.warn('Could not switch to All Comments view:', err.message);
    }

    // Wait for page body to load
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    console.log("--------------------Loading page done !!!--------------------")

    // Scroll down incrementally to load dynamic content
    let previousHeight = 0;
    for (let i = 0; i < 20; i++) {
      await driver.executeScript('window.scrollBy(0, window.innerHeight);');
      await driver.sleep(2000);
      const currentHeight = await driver.executeScript('return document.body.scrollHeight');
      if (currentHeight === previousHeight) break;
      previousHeight = currentHeight;
    }

    // Expand all comments and replies
    while (true) {
      const buttons = await driver.findElements(By.xpath(
        "//span[text()='View more comments' or text()='View more replies' or text()='See more']"
      ));

      if (buttons.length === 0) break;

      for (const btn of buttons) {
        try {
          await driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", btn);
          await driver.sleep(1000);
          await btn.click();
          await driver.sleep(1500);
        } catch (err) {
          console.warn('Could not click a button:', err.message);
        }
      }

      await driver.sleep(1000);
    }

    console.log("--------------------Loading all comments done !!!!--------------------")

    // Wait for any comment/message element to appear
    await driver.wait(until.elementsLocated(By.xpath("//div[@role='article']//div[@dir='auto' and string-length(text()) > 0]")), 10000);

    // Get all visible comment/message blocks
    const commentElements = await driver.findElements(By.xpath("//div[@role='article']//div[@dir='auto' and string-length(text()) > 0]"));
    console.log(`--------------------Found comment/message elements: ${commentElements.length}--------------------`)

    let commentTexts = new Set();

    for (let el of commentElements) {
      let text = await el.getText();
      if (text.trim()) {
        commentTexts.add(text.trim());
      }
    }

    let allNumbers = Array.from(commentTexts)
      .map(text => text.match(/\d+/g))
      .filter(matches => matches !== null)
      .flat();

    exportNumbersToExcel(allNumbers);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await driver.quit();
  }
}

extractFacebookCommentTexts();
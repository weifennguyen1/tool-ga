const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const multer = require('multer');
const { ROOT, linkPath, importedCookiePath, ASSETS_DIR } = require('./lib/paths');
const { loadSettings, saveSettings, ensureAssetsDir } = require('./lib/settings');
const { resolveCookiesPath } = require('./lib/cookies');
const { migrateRootDataToAssets } = require('./lib/migrate');
const { getDrawsForLink } = require('./lib/results');

const PORT = Number(process.env.PORT) || 3000;
const DATED_COOKIE_RE = /^www\.facebook\.com_\d{2}-\d{2}-\d{4}\.json$/i;

let job = null;
let lastRandom = null;
const logBuffer = [];
const MAX_LOG = 400;

migrateRootDataToAssets();

function pushLog(line) {
  logBuffer.push({ t: Date.now(), line: String(line) });
  if (logBuffer.length > MAX_LOG) logBuffer.shift();
}

function readLink() {
  const file = linkPath();
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8').trim();
}

function writeLink(link) {
  ensureAssetsDir();
  fs.writeFileSync(linkPath(), link.trim() + '\n', 'utf8');
}

function getCookieInfo() {
  return resolveCookiesPath();
}

function logCookieOnStartup() {
  const cookie = getCookieInfo();
  if (cookie.source === 'auto') {
    pushLog(`🍪 Tự động dùng cookie mới nhất: ${cookie.file}`);
  } else if (cookie.source === 'import') {
    pushLog(`🍪 Dùng cookie đã import: ${cookie.file}`);
  } else {
    pushLog('⚠️ Chưa có cookie — import profile Facebook hoặc thêm file www.facebook.com_DD-MM-YYYY.json vào assets/');
  }
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function runScript(scriptName, label) {
  if (job?.running) {
    return Promise.reject(new Error('Đang có tác vụ khác chạy. Vui lòng đợi xong.'));
  }

  return new Promise((resolve, reject) => {
    job = { running: true, label, startedAt: Date.now() };
    pushLog(`▶ Bắt đầu: ${label}`);

    const child = spawn(process.execPath, [path.join(ROOT, scriptName)], {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    child.stdout.on('data', d => pushLog(d.toString().trimEnd()));
    child.stderr.on('data', d => pushLog(d.toString().trimEnd()));

    child.on('close', code => {
      job.running = false;
      job.finishedAt = Date.now();
      job.exitCode = code;
      if (code === 0) {
        pushLog(`✅ Hoàn tất: ${label}`);
        resolve({ code });
      } else {
        pushLog(`❌ Lỗi (${code}): ${label}`);
        reject(new Error(`${label} thất bại (mã ${code})`));
      }
    });
  });
}

function createApp() {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
  });

  app.use(express.json());
  app.use(express.static(path.join(ROOT, 'public')));

  app.get('/api/settings', (req, res) => {
    const settings = loadSettings();
    const cookie = getCookieInfo();
    res.json({
      link: readLink(),
      randomMin: settings.randomMin,
      randomMax: settings.randomMax,
      cookiesFile: cookie.file,
      cookiesSource: cookie.source,
      cookiesExists: !cookie.requiresImport,
      requiresCookieImport: cookie.requiresImport,
      lastRandom
    });
  });

  app.get('/api/draw-history', (req, res) => {
    const link = (req.query.link || readLink() || '').trim();
    if (!link) {
      return res.status(400).json({ error: 'Chưa có link bài viết. Hãy nhập và lưu link trước.' });
    }
    if (!link.includes('facebook.com')) {
      return res.status(400).json({ error: 'Link Facebook không hợp lệ.' });
    }
    const draws = getDrawsForLink(link);
    res.json({ link, draws, count: draws.length });
  });

  app.get('/api/job', (req, res) => {
    res.json({
      job: job
        ? {
            running: job.running,
            label: job.label,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
            exitCode: job.exitCode
          }
        : null,
      logs: logBuffer.slice(-80)
    });
  });

  app.post('/api/link', (req, res) => {
    const link = (req.body?.link || '').trim();
    if (!link.includes('facebook.com')) {
      return res.status(400).json({ error: 'Link Facebook không hợp lệ.' });
    }
    writeLink(link);
    pushLog('🔗 Đã cập nhật link bài viết.');
    res.json({ ok: true, link });
  });

  app.post('/api/range', (req, res) => {
    const min = Number(req.body?.min);
    const max = Number(req.body?.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      return res.status(400).json({ error: 'Khoảng số không hợp lệ (min ≥ 0, max ≥ min).' });
    }
    const settings = saveSettings({ randomMin: min, randomMax: max });
    pushLog(`🎲 Đã lưu khoảng số: ${settings.randomMin} → ${settings.randomMax}`);
    res.json({ ok: true, randomMin: settings.randomMin, randomMax: settings.randomMax });
  });

  app.post('/api/cookies', upload.single('cookies'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Chưa chọn file cookie.' });
    }
    let parsed;
    try {
      parsed = JSON.parse(req.file.buffer.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'File không phải JSON hợp lệ.' });
    }
    if (!Array.isArray(parsed)) {
      return res.status(400).json({ error: 'Cookie phải là mảng JSON (export từ extension).' });
    }

    ensureAssetsDir();
    const uploadName = path.basename(req.file.originalname || '');
    const dest = DATED_COOKIE_RE.test(uploadName)
      ? path.join(ASSETS_DIR, uploadName)
      : importedCookiePath();

    fs.writeFileSync(dest, JSON.stringify(parsed, null, 2), 'utf8');

    const cookie = getCookieInfo();
    pushLog(`🍪 Đã import cookie → ${path.basename(dest)}`);
    if (cookie.source === 'auto' && cookie.file !== path.basename(dest)) {
      pushLog(`ℹ️ Đang dùng cookie mới hơn: ${cookie.file}`);
    }

    res.json({
      ok: true,
      cookiesFile: path.basename(dest),
      cookiesSource: cookie.source,
      cookiesExists: !cookie.requiresImport,
      requiresCookieImport: cookie.requiresImport,
      count: parsed.length
    });
  });

  app.post('/api/crawl', async (req, res) => {
    const cookie = getCookieInfo();
    if (cookie.requiresImport) {
      return res.status(400).json({
        error:
          'Chưa có cookie Facebook. Thêm file www.facebook.com_DD-MM-YYYY.json vào assets/ hoặc import profile.'
      });
    }
    try {
      await runScript('tool.js', 'Thu thập bình luận');
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/random', async (req, res) => {
    if (job?.running) {
      return res.status(409).json({ error: 'Đang có tác vụ khác chạy. Vui lòng đợi xong.' });
    }
    try {
      job = { running: true, label: 'Quay số ngẫu nhiên', startedAt: Date.now() };
      pushLog('▶ Bắt đầu: Quay số ngẫu nhiên');

      const { runRandom } = require('./randome');
      const result = runRandom();

      lastRandom = {
        number: result.number,
        link: result.link,
        min: result.min,
        max: result.max,
        at: Date.now()
      };

      if (result.number === -1) {
        pushLog('⚠️ Hết số unique trong khoảng đã chọn.');
      } else {
        pushLog(`🎉 Số đã quay: ${result.number}`);
      }
      pushLog('✅ Hoàn tất: Quay số ngẫu nhiên (đã lưu vết assets/ga-result.xlsx)');

      job.running = false;
      job.finishedAt = Date.now();
      job.exitCode = 0;

      res.json({ ok: true, ...lastRandom });
    } catch (e) {
      if (job) {
        job.running = false;
        job.exitCode = 1;
      }
      pushLog(`❌ Lỗi quay số: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  return app;
}

function startServer() {
  const app = createApp();
  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`🌈 GA Tool đang chạy tại ${url}`);
    pushLog(`Server sẵn sàng — ${url}`);
    logCookieOnStartup();
    if (process.env.GA_OPEN_BROWSER !== '0') {
      openBrowser(url);
    }
  });
}

if (process.env.GA_SERVER_CHILD === '1') {
  startServer();
} else {
  function launchChild() {
    const child = spawn(process.execPath, [__filename], {
      cwd: ROOT,
      env: { ...process.env, GA_SERVER_CHILD: '1' },
      stdio: 'inherit'
    });
    child.on('exit', code => {
      console.log(`\n⏳ Server dừng (mã ${code}). Khởi động lại sau 2 giây...`);
      setTimeout(launchChild, 2000);
    });
  }
  console.log('🚀 GA Tool — auto-restart bật. Dừng hẳn: Ctrl+C\n');
  launchChild();
}

const $ = id => document.getElementById(id);

const linkInput = $('linkInput');
const minInput = $('minInput');
const maxInput = $('maxInput');
const cookieFile = $('cookieFile');
const cookieStatus = $('cookieStatus');
const logBox = $('logBox');
const jobBadge = $('jobBadge');
const luckyNumber = $('luckyNumber');
const luckyHint = $('luckyHint');
const toast = $('toast');
const historyModal = $('historyModal');
const historyContent = $('historyContent');
const historyLinkPreview = $('historyLinkPreview');

let pollTimer = null;

function showToast(msg, type = 'ok') {
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function setBusy(busy) {
  ['saveLinkBtn', 'openLinkBtn', 'viewHistoryBtn', 'saveRangeBtn', 'crawlBtn', 'randomBtn'].forEach(id => {
    $(id).disabled = busy;
  });
  cookieFile.disabled = busy;
}

function showLuckyNumber(number, min, max) {
  luckyNumber.classList.remove('reveal', 'negative');

  if (number === -1) {
    luckyNumber.textContent = 'Hết số';
    luckyNumber.classList.add('negative');
    luckyHint.textContent = `Không còn số unique trong khoảng ${min}–${max}`;
    return;
  }

  luckyNumber.textContent = String(number);
  luckyHint.textContent = `Khoảng ${min}–${max}`;
  void luckyNumber.offsetWidth;
  luckyNumber.classList.add('reveal');
}

function getLinkForOpen() {
  const link = linkInput.value.trim();
  if (!link) throw new Error('Chưa có link. Nhập và lưu link trước.');
  if (!link.includes('facebook.com')) throw new Error('Link Facebook không hợp lệ.');
  return link;
}

function openHistoryModal() {
  historyModal.hidden = false;
  historyModal.setAttribute('aria-hidden', 'false');
}

function closeHistoryModal() {
  historyModal.hidden = true;
  historyModal.setAttribute('aria-hidden', 'true');
}

function renderHistory(data) {
  historyLinkPreview.textContent = data.link;

  if (!data.count) {
    historyContent.innerHTML = `
      <div class="history-empty">
        <span class="emoji">🍀</span>
        <p><strong>Chưa có lần quay số nào</strong> cho link bài viết này.</p>
        <p>Hãy nhấn <strong>「Quay số ngẫu nhiên」</strong> để bắt đầu nhé!</p>
      </div>`;
    return;
  }

  const items = data.draws
    .map(
      d => `<li><span class="num">${escapeHtml(String(d.number))}</span><span class="date">${escapeHtml(d.date)}</span></li>`
    )
    .join('');

  historyContent.innerHTML = `
    <p class="history-count">Tổng <strong>${data.count}</strong> lần quay</p>
    <ul class="history-list">${items}</ul>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadSettings() {
  const data = await api('/api/settings');
  linkInput.value = data.link || '';
  minInput.value = data.randomMin;
  maxInput.value = data.randomMax;
  updateCookieStatus(data);
}

function updateCookieStatus(data) {
  cookieStatus.classList.remove('ok', 'warn');
  if (data.cookiesSource === 'auto') {
    cookieStatus.textContent = `✅ Tự động: ${data.cookiesFile}`;
    cookieStatus.classList.add('ok');
  } else if (data.cookiesSource === 'import') {
    cookieStatus.textContent = `✅ Import: ${data.cookiesFile}`;
    cookieStatus.classList.add('ok');
  } else {
    cookieStatus.textContent =
      '⚠️ Chưa có cookie — import hoặc thêm www.facebook.com_DD-MM-YYYY.json vào assets/';
    cookieStatus.classList.add('warn');
  }
  if (data.lastRandom && data.lastRandom.number != null) {
    showLuckyNumber(data.lastRandom.number, data.lastRandom.min, data.lastRandom.max);
  }
}

function renderLogs(logs, job) {
  logBox.textContent = logs.map(l => l.line).join('\n') || 'Chưa có hoạt động...';
  logBox.scrollTop = logBox.scrollHeight;

  if (job?.running) {
    jobBadge.textContent = job.label;
    jobBadge.className = 'job-badge running';
    setBusy(true);
  } else {
    jobBadge.textContent = 'Sẵn sàng';
    jobBadge.className = 'job-badge idle';
    setBusy(false);
  }
}

async function pollJob() {
  try {
    const { job, logs } = await api('/api/job');
    renderLogs(logs, job);
  } catch {
    /* ignore */
  }
}

function startPolling() {
  pollJob();
  if (!pollTimer) pollTimer = setInterval(pollJob, 1500);
}

$('saveLinkBtn').addEventListener('click', async () => {
  try {
    await api('/api/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: linkInput.value })
    });
    showToast('Đã lưu link!');
  } catch (e) {
    showToast(e.message, 'error');
  }
});

$('openLinkBtn').addEventListener('click', () => {
  try {
    window.open(getLinkForOpen(), '_blank', 'noopener,noreferrer');
  } catch (e) {
    showToast(e.message, 'error');
  }
});

$('viewHistoryBtn').addEventListener('click', async () => {
  try {
    const link = getLinkForOpen();
    historyContent.innerHTML = '<p class="history-empty">Đang tải...</p>';
    openHistoryModal();
    const data = await api(`/api/draw-history?link=${encodeURIComponent(link)}`);
    renderHistory(data);
  } catch (e) {
    closeHistoryModal();
    showToast(e.message, 'error');
  }
});

$('closeHistoryModal').addEventListener('click', closeHistoryModal);
$('historyBackdrop').addEventListener('click', closeHistoryModal);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !historyModal.hidden) closeHistoryModal();
});

$('saveRangeBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/range', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        min: Number(minInput.value),
        max: Number(maxInput.value)
      })
    });
    minInput.value = data.randomMin;
    maxInput.value = data.randomMax;
    showToast(`Khoảng ${data.randomMin} → ${data.randomMax}`);
  } catch (e) {
    showToast(e.message, 'error');
  }
});

cookieFile.addEventListener('change', async () => {
  const file = cookieFile.files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append('cookies', file);

  try {
    const data = await api('/api/cookies', { method: 'POST', body: fd });
    updateCookieStatus(data);
    showToast('Import cookie thành công!');
    cookieFile.value = '';
  } catch (e) {
    showToast(e.message, 'error');
  }
});

$('crawlBtn').addEventListener('click', async () => {
  try {
    setBusy(true);
    jobBadge.textContent = 'Đang thu thập...';
    await api('/api/crawl', { method: 'POST' });
    showToast('Thu thập bình luận xong!');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    pollJob();
  }
});

$('randomBtn').addEventListener('click', async () => {
  try {
    setBusy(true);
    jobBadge.textContent = 'Đang quay...';
    luckyNumber.textContent = '…';
    luckyHint.textContent = 'Đang quay số...';

    const data = await api('/api/random', { method: 'POST' });
    showLuckyNumber(data.number, data.min, data.max);

    if (data.number === -1) {
      showToast('Hết số unique trong khoảng', 'error');
    } else {
      showToast(`Số của bạn: ${data.number}!`);
    }
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    pollJob();
  }
});

loadSettings().then(startPolling).catch(e => showToast(e.message, 'error'));

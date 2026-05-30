function getText(selector, context = document) {
  const el = context.querySelector(selector);
  return el ? el.innerText.trim() : '';
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeCsv(str) {
  if (str === null || str === undefined) return '';
  str = String(str).replace(/"/g, '""');
  if (str.search(/("|,|\n|\r)/g) >= 0) {
    str = `"${str}"`;
  }
  return str;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN');
}

function safeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return '';
  }
}

function sanitizeHref(url) {
  const safe = safeUrl(url);
  return safe || 'javascript:void(0)';
}

async function getStorageUsage() {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      const maxBytes = chrome.storage.local.QUOTA_BYTES || 10485760;
      resolve({
        used: bytes,
        total: maxBytes,
        percentage: ((bytes / maxBytes) * 100).toFixed(1),
        isNearLimit: bytes > maxBytes * 0.9
      });
    });
  });
}

function parseSalaryRange(salaryStr) {
  if (!salaryStr) return { min: 0, max: 0, avg: 0 };
  const match = salaryStr.match(/(\d+)[~-](\d+)/);
  if (match) {
    const min = parseInt(match[1]);
    const max = parseInt(match[2]);
    const multiplier = /万/.test(salaryStr) ? 10000 : (/k/i.test(salaryStr) ? 1000 : 1);
    return { min: min * multiplier, max: max * multiplier, avg: (min + max) / 2 * multiplier };
  }
  return { min: 0, max: 0, avg: 0 };
}

const JOB_STATUS = {
  PENDING: 'pending',
  APPLIED: 'applied',
  INTERVIEW: 'interview',
  OFFER: 'offer',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn'
};

const STATUS_LABELS = {
  [JOB_STATUS.PENDING]: '待投递',
  [JOB_STATUS.APPLIED]: '已投递',
  [JOB_STATUS.INTERVIEW]: '面试中',
  [JOB_STATUS.OFFER]: '已Offer',
  [JOB_STATUS.REJECTED]: '已拒绝',
  [JOB_STATUS.WITHDRAWN]: '已撤回'
};

const STATUS_COLORS = {
  [JOB_STATUS.PENDING]: '#6c757d',
  [JOB_STATUS.APPLIED]: '#007bff',
  [JOB_STATUS.INTERVIEW]: '#ffc107',
  [JOB_STATUS.OFFER]: '#28a745',
  [JOB_STATUS.REJECTED]: '#dc3545',
  [JOB_STATUS.WITHDRAWN]: '#6c757d'
};

const DEFAULT_TAGS = ['远程', '外企', '国企', '高优先级', '低优先级', '已收藏', '待跟进'];

function generateJobId(job) {
  const raw = `${job.url || ''}_${job.title || ''}_${job.company || ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'job_' + Math.abs(hash).toString(36);
}

export {
  getText, escapeHtml, escapeCsv, formatTimestamp,
  safeUrl, sanitizeHref, getStorageUsage, parseSalaryRange,
  JOB_STATUS, STATUS_LABELS, STATUS_COLORS, DEFAULT_TAGS,
  generateJobId
};

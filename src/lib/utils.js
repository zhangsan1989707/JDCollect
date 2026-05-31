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
  if (!salaryStr) return { min: 0, max: 0, avg: 0, currency: 'CNY', unit: 'month', period: 12 };
  if (salaryStr.includes('面议') || salaryStr.includes('待定')) {
    return { min: 0, max: 0, avg: 0, currency: 'CNY', unit: 'month', period: 12 };
  }

  let text = salaryStr.replace(/\s+/g, '').toLowerCase();
  let multiplier = 1; 
  let daily = false;

  if (text.includes('年') || text.includes('year')) {
    multiplier = 1;
  } else if (text.includes('天') || text.includes('日') || text.includes('day') || text.includes('/天') || text.includes('/日')) {
    daily = true;
  }

  let months = 12;
  const monthMatch = text.match(/[·•\*]\s*(\d+)\s*薪/);
  if (monthMatch) {
    months = parseInt(monthMatch[1]);
    text = text.replace(monthMatch[0], '');
  }

  let min = 0, max = 0;
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-~至]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    min = parseFloat(rangeMatch[1]);
    max = parseFloat(rangeMatch[2]);
  } else {
    const singleMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (singleMatch) {
      min = max = parseFloat(singleMatch[1]);
    }
  }

  let kMultiplier = 1;
  if (text.includes('k') || text.includes('千')) {
    kMultiplier = 1000;
  } else if (text.includes('w') || text.includes('万')) {
    kMultiplier = 10000;
  }

  min *= kMultiplier;
  max *= kMultiplier;

  if (multiplier === 1) {
    min = min / 12;
    max = max / 12;
  }

  if (daily) {
    min = min * 22;
    max = max * 22;
  }

  const avg = min && max ? Math.round((min + max) / 2) : (min || max || 0);

  return {
    min: Math.round(min),
    max: Math.round(max),
    avg: Math.round(avg),
    currency: 'CNY',
    unit: 'month',
    period: months
  };
}

function formatSalaryDisplay(salary) {
  if (!salary) return '面议';
  if (salary.min === 0 && salary.max === 0) return '面议';
  
  const format = (num) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'k';
    }
    return num.toString();
  };

  if (salary.min === salary.max) {
    return format(salary.min) + '/月';
  }
  return format(salary.min) + '-' + format(salary.max) + '/月';
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
  generateJobId, formatSalaryDisplay
};

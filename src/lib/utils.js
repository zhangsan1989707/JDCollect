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

export { getText, escapeHtml, escapeCsv, formatTimestamp };

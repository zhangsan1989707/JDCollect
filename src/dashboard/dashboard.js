import { escapeHtml, sanitizeHref, JOB_STATUS, STATUS_LABELS, STATUS_COLORS, DEFAULT_TAGS, parseSalaryRange } from '../lib/utils.js';

const PAGE_SIZE = 20;
let allJobs = [];
let filteredJobs = [];
let currentPage = 1;
let sortField = 'collectedAt';
let sortDirection = 'desc';
let activeDropdown = null;

const SOURCE_LABELS = {
  zhipin: 'BOSS直聘', liepin: '猎聘', lagou: '拉勾', zhaopin: '智联', 'import': '导入', unknown: '未知'
};

document.addEventListener('DOMContentLoaded', function() {
  loadData();
  bindEvents();
});

function bindEvents() {
  document.getElementById('refreshBtn').addEventListener('click', loadData);
  document.getElementById('exportBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'export_csv' }, (r) => {
      alert(r && r.success ? '导出已开始' : '导出失败: ' + (r ? r.message : ''));
    });
  });
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      chrome.runtime.sendMessage({ action: 'clear_data' }, (r) => {
        if (r && r.success) loadData();
      });
    }
  });
  document.getElementById('syncFeishuBtn').addEventListener('click', () => {
    const btn = document.getElementById('syncFeishuBtn');
    btn.textContent = '☁️ 同步中...';
    chrome.runtime.sendMessage({ action: 'sync_feishu' }, (r) => {
      btn.textContent = '☁️ 同步飞书';
      if (r && r.success) {
        alert(`同步成功！已同步 ${r.count} 条数据。`);
        loadData();
      } else {
        alert('同步失败: ' + (r ? r.message : '未知错误'));
      }
    });
  });

  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('sourceFilter').addEventListener('change', applyFilters);
  document.getElementById('starFilter').addEventListener('change', applyFilters);
  document.getElementById('tagFilter').addEventListener('change', applyFilters);

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'stats') renderStats();
    });
  });

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortDirection = 'asc';
      }
      applyFilters();
    });
  });

  document.getElementById('selectAll').addEventListener('change', (e) => {
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = e.target.checked);
    updateBatchActions();
  });

  document.getElementById('batchDeleteBtn').addEventListener('click', batchDelete);
  document.getElementById('batchStatusBtn').addEventListener('click', batchChangeStatus);
  document.getElementById('batchTagBtn').addEventListener('click', batchAddTag);

  document.getElementById('importBtn').addEventListener('click', importCsv);
  document.getElementById('csvFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('csvInput').value = ev.target.result;
      };
      reader.readAsText(file);
    }
  });

  document.addEventListener('click', (e) => {
    if (activeDropdown && !activeDropdown.contains(e.target)) {
      activeDropdown.remove();
      activeDropdown = null;
    }
  });
}

function loadData() {
  chrome.storage.local.get(['jobs'], (result) => {
    allJobs = result.jobs || [];
    updateTagFilter();
    applyFilters();
  });
}

function updateTagFilter() {
  const tagSet = new Set();
  allJobs.forEach(j => (j.tags || []).forEach(t => tagSet.add(t)));
  DEFAULT_TAGS.forEach(t => tagSet.add(t));
  const select = document.getElementById('tagFilter');
  const current = select.value;
  select.innerHTML = '<option value="">全部</option>';
  Array.from(tagSet).sort().forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    select.appendChild(opt);
  });
  select.value = current;
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const source = document.getElementById('sourceFilter').value;
  const star = document.getElementById('starFilter').value;
  const tag = document.getElementById('tagFilter').value;

  filteredJobs = allJobs.filter(job => {
    if (search && !(
      (job.title || '').toLowerCase().includes(search) ||
      (job.company || '').toLowerCase().includes(search) ||
      (job.location || '').toLowerCase().includes(search) ||
      (job.description || '').toLowerCase().includes(search)
    )) return false;
    if (status && job.status !== status) return false;
    if (source && job.source !== source) return false;
    if (star === 'starred' && !job.starred) return false;
    if (star === 'unstarred' && job.starred) return false;
    if (tag && !(job.tags || []).includes(tag)) return false;
    return true;
  });

  filteredJobs.sort((a, b) => {
    let va = a[sortField] || '';
    let vb = b[sortField] || '';
    if (sortField === 'salary') {
      va = parseSalaryRange(va).avg;
      vb = parseSalaryRange(vb).avg;
    }
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDirection === 'asc' ? va - vb : vb - va;
    }
    va = String(va).toLowerCase();
    vb = String(vb).toLowerCase();
    return sortDirection === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tableBody = document.querySelector('#jobsTable tbody');
  const emptyState = document.getElementById('emptyState');
  const table = document.getElementById('jobsTable');

  document.getElementById('totalCount').textContent = allJobs.length;

  if (filteredJobs.length === 0) {
    table.style.display = 'none';
    emptyState.style.display = 'block';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  table.style.display = 'table';
  emptyState.style.display = 'none';

  const totalPages = Math.ceil(filteredJobs.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageJobs = filteredJobs.slice(start, start + PAGE_SIZE);

  tableBody.innerHTML = '';
  pageJobs.forEach(job => {
    const tr = document.createElement('tr');
    tr.dataset.id = job.id;
    const safeUrl = sanitizeHref(job.url);
    const statusClass = `status-${job.status || 'pending'}`;
    const statusLabel = STATUS_LABELS[job.status] || '待投递';
    const sourceClass = `source-${job.source || 'unknown'}`;
    const sourceLabel = SOURCE_LABELS[job.source] || '未知';

    const tagsHtml = (job.tags || []).map(t =>
      `<span class="tag" data-id="${job.id}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}<span class="remove-tag">×</span></span>`
    ).join('') + `<span class="add-tag-btn" data-id="${job.id}">+</span>`;

    tr.innerHTML = `
      <td class="checkbox-col"><input type="checkbox" class="row-checkbox" data-id="${job.id}"></td>
      <td class="star-col"><button class="star-btn ${job.starred ? 'starred' : ''}" data-id="${job.id}">${job.starred ? '★' : '☆'}</button></td>
      <td><a href="${safeUrl}" target="_blank" title="${escapeHtml(job.title)}">${escapeHtml(job.title)}</a></td>
      <td>${escapeHtml(job.company)}</td>
      <td>${escapeHtml(job.salary)}</td>
      <td>${escapeHtml(job.location)}</td>
      <td>${escapeHtml(job.experience)} / ${escapeHtml(job.education)}</td>
      <td><span class="status-badge ${statusClass}" data-id="${job.id}">${statusLabel}</span></td>
      <td>${tagsHtml}</td>
      <td><span class="source-badge ${sourceClass}">${sourceLabel}</span></td>
      <td><input class="notes-input" data-id="${job.id}" value="${escapeHtml(job.notes || '')}" placeholder="备注..." /></td>
      <td class="action-col">
        <button class="btn-sm btn-info-sm detail-btn" data-url="${safeUrl}">详情</button>
        <button class="btn-sm btn-danger-sm delete-btn" data-id="${job.id}">删除</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  bindTableEvents();
  renderPagination(totalPages);
  updateSortIcons();
}

function bindTableEvents() {
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.addEventListener('change', updateBatchActions);
  });

  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      chrome.runtime.sendMessage({ action: 'toggle_star', id }, (r) => {
        if (r && r.success) {
          const job = allJobs.find(j => j.id === id);
          if (job) job.starred = r.starred;
          btn.classList.toggle('starred', r.starred);
          btn.textContent = r.starred ? '★' : '☆';
        }
      });
    });
  });

  document.querySelectorAll('.status-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      showStatusDropdown(badge, badge.dataset.id);
    });
  });

  document.querySelectorAll('.add-tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showTagDropdown(btn, btn.dataset.id);
    });
  });

  document.querySelectorAll('.tag .remove-tag').forEach(span => {
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagEl = span.closest('.tag');
      const id = tagEl.dataset.id;
      const tag = tagEl.dataset.tag;
      chrome.runtime.sendMessage({ action: 'remove_tag', id, tag }, () => loadData());
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('确定删除这条记录吗？')) {
        chrome.runtime.sendMessage({ action: 'delete_jobs', ids: [btn.dataset.id] }, () => loadData());
      }
    });
  });

  document.querySelectorAll('.detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      if (url && url !== 'javascript:void(0)') window.open(url, '_blank');
    });
  });

  document.querySelectorAll('.notes-input').forEach(input => {
    input.addEventListener('blur', () => {
      const id = input.dataset.id;
      const notes = input.value;
      chrome.runtime.sendMessage({ action: 'update_job', id, patch: { notes } });
    });
  });
}

function showStatusDropdown(anchor, jobId) {
  if (activeDropdown) { activeDropdown.remove(); activeDropdown = null; }

  const dropdown = document.createElement('div');
  dropdown.className = 'status-dropdown';

  Object.entries(JOB_STATUS).forEach(([key, value]) => {
    const item = document.createElement('div');
    item.className = 'status-dropdown-item';
    item.innerHTML = `<span class="status-badge status-${value}">${STATUS_LABELS[value]}</span>`;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: 'update_job', id: jobId, patch: { status: value } }, () => {
        dropdown.remove();
        activeDropdown = null;
        loadData();
      });
    });
    dropdown.appendChild(item);
  });

  const rect = anchor.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.top = (rect.bottom + 4) + 'px';
  document.body.appendChild(dropdown);
  activeDropdown = dropdown;
}

function showTagDropdown(anchor, jobId) {
  if (activeDropdown) { activeDropdown.remove(); activeDropdown = null; }

  const dropdown = document.createElement('div');
  dropdown.className = 'tag-dropdown';

  const job = allJobs.find(j => j.id === jobId);
  const existingTags = new Set(job ? job.tags || [] : []);

  DEFAULT_TAGS.forEach(tag => {
    const item = document.createElement('div');
    item.className = 'tag-dropdown-item';
    item.textContent = existingTags.has(tag) ? `✓ ${tag}` : tag;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (existingTags.has(tag)) {
        chrome.runtime.sendMessage({ action: 'remove_tag', id: jobId, tag }, () => {
          dropdown.remove(); activeDropdown = null; loadData();
        });
      } else {
        chrome.runtime.sendMessage({ action: 'add_tag', id: jobId, tag }, () => {
          dropdown.remove(); activeDropdown = null; loadData();
        });
      }
    });
    dropdown.appendChild(item);
  });

  const customItem = document.createElement('div');
  customItem.className = 'tag-dropdown-item';
  customItem.style.borderTop = '1px solid #dee2e6';
  customItem.style.marginTop = '4px';
  customItem.style.paddingTop = '4px';
  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.placeholder = '自定义标签...';
  customInput.style.cssText = 'border:1px solid #dee2e6;border-radius:3px;padding:2px 6px;font-size:11px;width:100%;';
  customInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && customInput.value.trim()) {
      chrome.runtime.sendMessage({ action: 'add_tag', id: jobId, tag: customInput.value.trim() }, () => {
        dropdown.remove(); activeDropdown = null; loadData();
      });
    }
  });
  customItem.appendChild(customInput);
  dropdown.appendChild(customItem);

  const rect = anchor.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.top = (rect.bottom + 4) + 'px';
  document.body.appendChild(dropdown);
  activeDropdown = dropdown;
  customInput.focus();
}

function updateBatchActions() {
  const checked = document.querySelectorAll('.row-checkbox:checked');
  const batchActions = document.getElementById('batchActions');
  document.getElementById('selectedCount').textContent = checked.length;
  batchActions.classList.toggle('visible', checked.length > 0);
}

function batchDelete() {
  const ids = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id);
  if (ids.length === 0) return;
  if (!confirm(`确定删除选中的 ${ids.length} 条记录吗？`)) return;
  chrome.runtime.sendMessage({ action: 'delete_jobs', ids }, () => loadData());
}

function batchChangeStatus() {
  const ids = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id);
  if (ids.length === 0) return;
  const status = prompt('输入新状态 (pending/applied/interview/offer/rejected/withdrawn):');
  if (!status || !JOB_STATUS[status.toUpperCase()]) {
    alert('无效状态');
    return;
  }
  chrome.runtime.sendMessage({ action: 'batch_update_status', ids, status: status.toLowerCase() }, () => loadData());
}

function batchAddTag() {
  const ids = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id);
  if (ids.length === 0) return;
  const tag = prompt('输入要添加的标签:');
  if (!tag) return;
  let pending = ids.length;
  ids.forEach(id => {
    chrome.runtime.sendMessage({ action: 'add_tag', id, tag }, () => {
      pending--;
      if (pending === 0) loadData();
    });
  });
}

function renderPagination(totalPages) {
  const container = document.getElementById('pagination');
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button ${currentPage === 1 ? 'disabled' : ''} id="prevPage">上一页</button>`;
  html += `<span class="page-info">第 ${currentPage} / ${totalPages} 页 (共 ${filteredJobs.length} 条)</span>`;
  html += `<button ${currentPage === totalPages ? 'disabled' : ''} id="nextPage">下一页</button>`;
  container.innerHTML = html;

  document.getElementById('prevPage')?.addEventListener('click', () => { currentPage--; renderTable(); });
  document.getElementById('nextPage')?.addEventListener('click', () => { currentPage++; renderTable(); });
}

function updateSortIcons() {
  document.querySelectorAll('th[data-sort]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (th.dataset.sort === sortField) {
      icon.textContent = sortDirection === 'asc' ? '▲' : '▼';
    } else {
      icon.textContent = '';
    }
  });
}

function importCsv() {
  const csvData = document.getElementById('csvInput').value.trim();
  if (!csvData) { alert('请先粘贴或选择 CSV 文件'); return; }
  chrome.runtime.sendMessage({ action: 'import_csv', data: csvData }, (r) => {
    if (r && r.success) {
      alert(`导入成功！新增 ${r.count} 条，共 ${r.total} 条`);
      document.getElementById('csvInput').value = '';
      loadData();
    } else {
      alert('导入失败: ' + (r ? r.message : '未知错误'));
    }
  });
}

function renderStats() {
  if (allJobs.length === 0) return;

  const total = allJobs.length;
  const starred = allJobs.filter(j => j.starred).length;
  const statusCounts = {};
  Object.values(JOB_STATUS).forEach(s => statusCounts[s] = 0);
  allJobs.forEach(j => { statusCounts[j.status || 'pending'] = (statusCounts[j.status || 'pending'] || 0) + 1; });

  const avgSalary = calculateAvgSalary();
  const topLocations = getTopItems(allJobs.map(j => j.location).filter(Boolean), 5);
  const topSources = getTopItems(allJobs.map(j => j.source || 'unknown').filter(Boolean), 5);

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card"><div class="stat-label">总职位数</div><div class="stat-value">${total}</div></div>
    <div class="stat-card"><div class="stat-label">收藏数</div><div class="stat-value">${starred}</div></div>
    <div class="stat-card"><div class="stat-label">平均薪资</div><div class="stat-value">${avgSalary}</div><div class="stat-sub">基于可解析的薪资数据</div></div>
    <div class="stat-card"><div class="stat-label">已投递</div><div class="stat-value">${statusCounts.applied || 0}</div><div class="stat-sub">面试中: ${statusCounts.interview || 0} | Offer: ${statusCounts.offer || 0}</div></div>
  `;

  renderSalaryChart();
  renderLocationChart(topLocations);
  renderStatusPie(statusCounts);
  renderSourceChart(topSources);
}

function calculateAvgSalary() {
  const salaries = allJobs.map(j => parseSalaryRange(j.salary)).filter(s => s.avg > 0);
  if (salaries.length === 0) return '暂无数据';
  const avg = salaries.reduce((sum, s) => sum + s.avg, 0) / salaries.length;
  if (avg >= 10000) return (avg / 10000).toFixed(1) + '万/月';
  return Math.round(avg) + '/月';
}

function getTopItems(arr, limit) {
  const counts = {};
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function renderSalaryChart() {
  const ranges = [
    { label: '5K以下', min: 0, max: 5000 },
    { label: '5-10K', min: 5000, max: 10000 },
    { label: '10-15K', min: 10000, max: 15000 },
    { label: '15-20K', min: 15000, max: 20000 },
    { label: '20-30K', min: 20000, max: 30000 },
    { label: '30-50K', min: 30000, max: 50000 },
    { label: '50K以上', min: 50000, max: Infinity }
  ];

  const counts = ranges.map(r => ({
    label: r.label,
    count: allJobs.filter(j => {
      const s = parseSalaryRange(j.salary);
      return s.avg >= r.min && s.avg < r.max;
    }).length
  }));

  const maxCount = Math.max(...counts.map(c => c.count), 1);
  const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b'];

  document.getElementById('salaryBars').innerHTML = counts.map((c, i) => `
    <div class="chart-bar">
      <div class="label">${c.label}</div>
      <div class="bar">
        <div class="bar-fill" style="width:${(c.count / maxCount * 100)}%;background:${colors[i]}"></div>
        <span class="bar-text">${c.count}</span>
      </div>
    </div>
  `).join('');
}

function renderLocationChart(topLocations) {
  const maxCount = Math.max(...topLocations.map(([,c]) => c), 1);
  const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
  document.getElementById('locationBars').innerHTML = topLocations.map(([loc, count], i) => `
    <div class="chart-bar">
      <div class="label">${escapeHtml(loc)}</div>
      <div class="bar">
        <div class="bar-fill" style="width:${(count / maxCount * 100)}%;background:${colors[i % colors.length]}"></div>
        <span class="bar-text">${count}</span>
      </div>
    </div>
  `).join('');
}

function renderStatusPie(statusCounts) {
  const colors = Object.values(JOB_STATUS).map(s => STATUS_COLORS[s]);
  const labels = Object.values(JOB_STATUS).map(s => STATUS_LABELS[s]);
  const values = Object.values(JOB_STATUS).map(s => statusCounts[s] || 0);
  const total = values.reduce((a, b) => a + b, 0) || 1;

  let gradientParts = [];
  let accumulated = 0;
  values.forEach((v, i) => {
    const start = (accumulated / total) * 360;
    accumulated += v;
    const end = (accumulated / total) * 360;
    gradientParts.push(`${colors[i]} ${start}deg ${end}deg`);
  });

  const pieVisual = `<div class="pie-visual" style="background:conic-gradient(${gradientParts.join(',')})"></div>`;
  const legend = labels.map((l, i) => `
    <div class="pie-legend-item">
      <div class="pie-legend-color" style="background:${colors[i]}"></div>
      <span>${l}: ${values[i]} (${(values[i] / total * 100).toFixed(1)}%)</span>
    </div>
  `).join('');

  document.getElementById('statusPie').innerHTML = pieVisual + `<div class="pie-legend">${legend}</div>`;
}

function renderSourceChart(topSources) {
  const maxCount = Math.max(...topSources.map(([,c]) => c), 1);
  const colors = ['#2e7d32', '#e65100', '#1565c0', '#c62828', '#6a1b9a'];
  document.getElementById('sourceBars').innerHTML = topSources.map(([source, count], i) => `
    <div class="chart-bar">
      <div class="label">${escapeHtml(SOURCE_LABELS[source] || source)}</div>
      <div class="bar">
        <div class="bar-fill" style="width:${(count / maxCount * 100)}%;background:${colors[i % colors.length]}"></div>
        <span class="bar-text">${count}</span>
      </div>
    </div>
  `).join('');
}

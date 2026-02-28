document.addEventListener('DOMContentLoaded', function() {
  const tableBody = document.querySelector('#jobsTable tbody');
  const emptyState = document.getElementById('emptyState');
  const countSpan = document.getElementById('count');
  const selectAllCheckbox = document.getElementById('selectAll');
  
  // 初始化加载数据
  loadData();

  // 刷新按钮
  document.getElementById('refreshBtn').addEventListener('click', loadData);

  // 导出按钮
  document.getElementById('exportBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'export_csv' }, (response) => {
      if (response && response.success) {
        alert('导出已开始，请留意下载列表。');
      } else {
        alert('导出失败: ' + (response ? response.message : '未知错误'));
      }
    });
  });

  // 清空按钮
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      chrome.runtime.sendMessage({ action: 'clear_data' }, (response) => {
        if (response && response.success) {
          loadData();
        } else {
          alert('清空失败');
        }
      });
    }
  });

    // 同步到飞书
  document.getElementById('syncFeishuBtn').addEventListener('click', () => {
    // 获取选中的数据
    const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
    let jobsToSync = [];
    
    // 如果有选中，只同步选中的
    if (selectedCheckboxes.length > 0) {
      chrome.storage.local.get(['jobs'], (result) => {
        const allJobs = result.jobs || [];
        
        selectedCheckboxes.forEach(cb => {
            const tr = cb.closest('tr');
            const link = tr.querySelector('a');
            if (link) {
                const url = link.href;
                const job = allJobs.find(j => j.url === url);
                if (job) jobsToSync.push(job);
            }
        });
        
        if (jobsToSync.length > 0) {
            performSync(jobsToSync);
        } else {
             alert('未能匹配到选中的数据');
        }
      });
    } else {
      // 如果没选中，询问是否同步所有
      if (confirm('未选中任何职位，是否将所有已采集的数据同步到飞书？')) {
        chrome.storage.local.get(['jobs'], (result) => {
            const allJobs = result.jobs || [];
            if (allJobs.length > 0) {
                performSync(allJobs);
            } else {
                alert('暂无数据可同步');
            }
        });
      }
    }
  });

  function performSync(jobs) {
    const btn = document.getElementById('syncFeishuBtn');
    const originalText = btn.textContent;
    btn.textContent = '同步中...';
    btn.disabled = true;

    chrome.runtime.sendMessage({ action: 'sync_feishu', data: jobs }, (response) => {
        btn.textContent = originalText;
        btn.disabled = false;
        
        if (response && response.success) {
            alert(`同步成功！已同步 ${response.count} 条数据。`);
        } else {
            alert('同步失败: ' + (response ? response.message : '未知错误'));
        }
    });
  }

  // 全选/取消全选
  selectAllCheckbox.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
  });

  tableBody.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains('applied-select')) {
      const url = target.getAttribute('data-url');
      if (!url) return;
      const value = target.value;
      const isApplied = value === 'true';
      updateJobByUrl(url, { isApplied });
    }
  });

  tableBody.addEventListener('blur', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains('apply-result-input')) {
      const url = target.getAttribute('data-url');
      if (!url) return;
      const value = target.value || '';
      updateJobByUrl(url, { applyResult: value });
    }
  }, true);

  // 加载数据
  function loadData() {
    chrome.storage.local.get(['jobs'], (result) => {
      const jobs = result.jobs || [];
      renderTable(jobs);
    });
  }

  // 渲染表格
  function renderTable(jobs) {
    tableBody.innerHTML = '';
    countSpan.textContent = jobs.length;

    if (jobs.length === 0) {
      document.getElementById('jobsTable').style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    document.getElementById('jobsTable').style.display = 'table';
    emptyState.style.display = 'none';

    // 按时间倒序排列
    jobs.sort((a, b) => (b.collectedAt || 0) - (a.collectedAt || 0));

    jobs.forEach((job, index) => {
      const tr = document.createElement('tr');
      const isApplied = job.isApplied === true || job.isApplied === '是' || job.isApplied === '已投递';
      
      tr.innerHTML = `
        <td class="checkbox-col"><input type="checkbox" class="row-checkbox" data-index="${index}"></td>
        <td><a href="${job.url}" target="_blank">${escapeHtml(job.title)}</a></td>
        <td>${escapeHtml(job.company)}</td>
        <td>${escapeHtml(job.salary)}</td>
        <td>${escapeHtml(job.location)}</td>
        <td>${escapeHtml(job.experience)} / ${escapeHtml(job.education)}</td>
        <td>
          <select class="applied-select" data-url="${job.url}">
            <option value="false" ${isApplied ? '' : 'selected'}>未投递</option>
            <option value="true" ${isApplied ? 'selected' : ''}>已投递</option>
          </select>
        </td>
        <td>
          <input type="text" class="apply-result-input" data-url="${job.url}" value="${escapeHtml(job.applyResult || '')}" placeholder="例如：已面试/拒绝/待反馈" />
        </td>
        <td class="action-col">
          <button class="btn-danger btn-sm delete-btn" data-url="${job.url}">删除</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // 绑定删除按钮事件
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const urlToDelete = this.getAttribute('data-url');
        deleteJob(urlToDelete);
      });
    });
  }

  // 删除单条职位
  function deleteJob(url) {
    if (!confirm('确定删除这条记录吗？')) return;

    chrome.storage.local.get(['jobs'], (result) => {
      let jobs = result.jobs || [];
      const initialLength = jobs.length;
      jobs = jobs.filter(job => job.url !== url);
      
      if (jobs.length < initialLength) {
        chrome.storage.local.set({ jobs: jobs }, () => {
          loadData(); // 重新加载
        });
      }
    });
  }

  function updateJobByUrl(url, patch) {
    chrome.storage.local.get(['jobs'], (result) => {
      const jobs = result.jobs || [];
      let changed = false;

      const nextJobs = jobs.map(job => {
        if (!job || job.url !== url) return job;
        changed = true;
        return { ...job, ...patch };
      });

      if (!changed) return;
      chrome.storage.local.set({ jobs: nextJobs });
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});

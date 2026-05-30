import { syncToFeishu } from './feishu_sync.js';
import { generateJobId, JOB_STATUS, escapeCsv, getStorageUsage, safeUrl } from '../lib/utils.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'save_job':
      saveJobsData([request.data], sendResponse);
      return true;
    case 'save_jobs':
      saveJobsData(request.data, sendResponse);
      return true;
    case 'export_csv':
      exportToCsv(sendResponse);
      return true;
    case 'clear_data':
      clearData(sendResponse);
      return true;
    case 'sync_feishu':
      handleFeishuSync(request.data, sendResponse);
      return true;
    case 'get_storage_usage':
      getStorageUsage().then(usage => sendResponse({ success: true, data: usage }));
      return true;
    case 'update_job':
      updateJob(request.id, request.patch, sendResponse);
      return true;
    case 'batch_update_status':
      batchUpdateStatus(request.ids, request.status, sendResponse);
      return true;
    case 'add_tag':
      addTag(request.id, request.tag, sendResponse);
      return true;
    case 'remove_tag':
      removeTag(request.id, request.tag, sendResponse);
      return true;
    case 'toggle_star':
      toggleStar(request.id, sendResponse);
      return true;
    case 'delete_jobs':
      deleteJobs(request.ids, sendResponse);
      return true;
    case 'import_csv':
      importCsv(request.data, sendResponse);
      return true;
    default:
      break;
  }
});

function saveJobsData(newJobs, sendResponse) {
  if (!Array.isArray(newJobs)) newJobs = [newJobs];

  getStorageUsage().then(usage => {
    if (usage.isNearLimit) {
      sendResponse({ success: false, message: `存储空间已使用 ${usage.percentage}%，请先清理数据` });
      return;
    }

    chrome.storage.local.get(['jobs'], (result) => {
      const existingJobs = result.jobs || [];
      let addedCount = 0;
      const reallyNewJobs = [];

      newJobs.forEach(job => {
        if (!job) return;
        const jobId = generateJobId(job);
        if (!existingJobs.some(e => e.id === jobId || e.url === job.url)) {
          const enrichedJob = {
            ...job,
            id: jobId,
            status: job.status || JOB_STATUS.PENDING,
            tags: job.tags || [],
            starred: job.starred || false,
            source: job.source || detectSource(job.url),
            feishuSynced: false,
            notes: job.notes || '',
            collectedAt: job.collectedAt || Date.now()
          };
          existingJobs.push(enrichedJob);
          reallyNewJobs.push(enrichedJob);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        chrome.storage.local.set({ jobs: existingJobs }, () => {
          console.log(`成功保存 ${addedCount} 条职位`);
          if (reallyNewJobs.length > 0) {
            syncToFeishu(reallyNewJobs);
          }
          sendResponse({ success: true, count: addedCount, total: existingJobs.length });
        });
      } else {
        sendResponse({ success: true, count: 0, total: existingJobs.length, message: '职位已存在' });
      }
    });
  });
}

function detectSource(url) {
  if (!url) return 'unknown';
  if (url.includes('zhipin.com')) return 'zhipin';
  if (url.includes('liepin.com')) return 'liepin';
  if (url.includes('lagou.com')) return 'lagou';
  if (url.includes('zhaopin.com')) return 'zhaopin';
  return 'unknown';
}

function exportToCsv(sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const jobs = result.jobs || [];
    if (jobs.length === 0) {
      sendResponse({ success: false, message: '没有可导出的数据' });
      return;
    }

    const headers = [
      'ID', '职位名称', '公司名称', '薪资范围', '工作地点', '经验要求',
      '学历要求', '公司规模', '行业领域', '发布时间', '职位链接',
      '投递状态', '投递结果', '标签', '是否收藏', '来源', '备注', '职位描述'
    ];

    let csvContent = '\uFEFF' + headers.join(',') + '\n';

    jobs.forEach(job => {
      const row = [
        job.id || '',
        job.title,
        job.company,
        job.salary,
        job.location,
        job.experience,
        job.education,
        job.companySize,
        job.industry,
        job.publishTime,
        job.url,
        job.status || JOB_STATUS.PENDING,
        job.applyResult || '',
        (job.tags || []).join('|'),
        job.starred ? '是' : '否',
        job.source || '',
        job.notes || '',
        job.description || ''
      ].map(escapeCsv).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const reader = new FileReader();
    reader.onload = function() {
      const dataUrl = reader.result;
      chrome.downloads.download({
        url: dataUrl,
        filename: `jd_collect_${new Date().toISOString().slice(0,10)}.csv`,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, message: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
    };
    reader.readAsDataURL(blob);
  });
}

function clearData(sendResponse) {
  chrome.storage.local.set({ jobs: [] }, () => {
    sendResponse({ success: true });
  });
}

function handleFeishuSync(data, sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const allJobs = result.jobs || [];
    let jobsToSync;
    if (data && Array.isArray(data)) {
      jobsToSync = data;
    } else {
      jobsToSync = allJobs.filter(j => !j.feishuSynced);
    }

    if (jobsToSync.length === 0) {
      sendResponse({ success: false, message: '没有需要同步的数据' });
      return;
    }

    syncToFeishu(jobsToSync, (res) => {
      if (res.success) {
        const syncedIds = new Set(jobsToSync.map(j => j.id));
        const updatedJobs = allJobs.map(j =>
          syncedIds.has(j.id) ? { ...j, feishuSynced: true } : j
        );
        chrome.storage.local.set({ jobs: updatedJobs }, () => {
          sendResponse(res);
        });
      } else {
        sendResponse(res);
      }
    });
  });
}

function updateJob(id, patch, sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const jobs = result.jobs || [];
    let found = false;
    const nextJobs = jobs.map(job => {
      if (job.id === id) {
        found = true;
        return { ...job, ...patch };
      }
      return job;
    });
    if (!found) {
      sendResponse({ success: false, message: '未找到该职位' });
      return;
    }
    chrome.storage.local.set({ jobs: nextJobs }, () => {
      sendResponse({ success: true });
    });
  });
}

function batchUpdateStatus(ids, status, sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const idSet = new Set(ids);
    const nextJobs = (result.jobs || []).map(job =>
      idSet.has(job.id) ? { ...job, status } : job
    );
    chrome.storage.local.set({ jobs: nextJobs }, () => {
      sendResponse({ success: true, count: ids.length });
    });
  });
}

function addTag(id, tag, sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const jobs = result.jobs || [];
    const nextJobs = jobs.map(job => {
      if (job.id === id) {
        const tags = [...(job.tags || [])];
        if (!tags.includes(tag)) tags.push(tag);
        return { ...job, tags };
      }
      return job;
    });
    chrome.storage.local.set({ jobs: nextJobs }, () => {
      sendResponse({ success: true });
    });
  });
}

function removeTag(id, tag, sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const jobs = result.jobs || [];
    const nextJobs = jobs.map(job => {
      if (job.id === id) {
        return { ...job, tags: (job.tags || []).filter(t => t !== tag) };
      }
      return job;
    });
    chrome.storage.local.set({ jobs: nextJobs }, () => {
      sendResponse({ success: true });
    });
  });
}

function toggleStar(id, sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const jobs = result.jobs || [];
    const nextJobs = jobs.map(job => {
      if (job.id === id) return { ...job, starred: !job.starred };
      return job;
    });
    chrome.storage.local.set({ jobs: nextJobs }, () => {
      const job = nextJobs.find(j => j.id === id);
      sendResponse({ success: true, starred: job ? job.starred : false });
    });
  });
}

function deleteJobs(ids, sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const idSet = new Set(ids);
    const jobs = (result.jobs || []).filter(job => !idSet.has(job.id));
    chrome.storage.local.set({ jobs }, () => {
      sendResponse({ success: true, count: ids.length });
    });
  });
}

function importCsv(csvData, sendResponse) {
  try {
    const lines = csvData.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      sendResponse({ success: false, message: 'CSV 数据为空' });
      return;
    }

    const headers = parseCsvLine(lines[0]);
    const newJobs = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      if (values.length < 3) continue;
      const job = {};
      headers.forEach((h, idx) => { job[h] = values[idx] || ''; });

      const importedJob = {
        id: job['ID'] || generateJobId(job),
        title: job['职位名称'] || '',
        company: job['公司名称'] || '',
        salary: job['薪资范围'] || '',
        location: job['工作地点'] || '',
        experience: job['经验要求'] || '',
        education: job['学历要求'] || '',
        companySize: job['公司规模'] || '',
        industry: job['行业领域'] || '',
        publishTime: job['发布时间'] || '',
        url: safeUrl(job['职位链接']) || '',
        status: job['投递状态'] || JOB_STATUS.PENDING,
        applyResult: job['投递结果'] || '',
        tags: job['标签'] ? job['标签'].split('|').filter(Boolean) : [],
        starred: job['是否收藏'] === '是',
        source: job['来源'] || 'import',
        notes: job['备注'] || '',
        description: job['职位描述'] || '',
        feishuSynced: false,
        collectedAt: Date.now()
      };

      if (importedJob.title && importedJob.url) {
        newJobs.push(importedJob);
      }
    }

    if (newJobs.length === 0) {
      sendResponse({ success: false, message: '未解析到有效职位数据' });
      return;
    }

    chrome.storage.local.get(['jobs'], (result) => {
      const existingJobs = result.jobs || [];
      const existingIds = new Set(existingJobs.map(j => j.id));
      let addedCount = 0;

      newJobs.forEach(job => {
        if (!existingIds.has(job.id) && !existingJobs.some(e => e.url === job.url)) {
          existingJobs.push(job);
          addedCount++;
        }
      });

      chrome.storage.local.set({ jobs: existingJobs }, () => {
        sendResponse({ success: true, count: addedCount, total: existingJobs.length });
      });
    });
  } catch (e) {
    sendResponse({ success: false, message: '导入失败: ' + e.message });
  }
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

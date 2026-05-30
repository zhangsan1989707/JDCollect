import { syncToFeishu } from './feishu_sync.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save_job') {
    saveJobsData([request.data], sendResponse);
    return true;
  } else if (request.action === 'save_jobs') {
    saveJobsData(request.data, sendResponse);
    return true;
  } else if (request.action === 'export_csv') {
    exportToCsv(sendResponse);
    return true;
  } else if (request.action === 'clear_data') {
    chrome.storage.local.set({ jobs: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'sync_feishu') {
    chrome.storage.local.get(['jobs'], (result) => {
      const jobs = result.jobs || [];
      const jobsToSync = request.data ? request.data : jobs;
      syncToFeishu(jobsToSync, (res) => {
          sendResponse(res);
      });
    });
    return true;
  }
});

function saveJobsData(newJobs, sendResponse) {
  if (!Array.isArray(newJobs)) {
    newJobs = [newJobs];
  }

  chrome.storage.local.get(['jobs'], (result) => {
    const existingJobs = result.jobs || [];
    let addedCount = 0;
    const reallyNewJobs = [];

    newJobs.forEach(job => {
      if (job && job.url && !existingJobs.some(e => e.url === job.url)) {
        existingJobs.push(job);
        reallyNewJobs.push(job);
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
      console.log('所有职位已存在，无需保存');
      sendResponse({ success: true, count: 0, total: existingJobs.length, message: '职位已存在' });
    }
  });
}

function exportToCsv(sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const jobs = result.jobs || [];
    if (jobs.length === 0) {
      sendResponse({ success: false, message: '没有可导出的数据' });
      return;
    }

    const headers = [
      '职位名称', '公司名称', '薪资范围', '工作地点', '经验要求',
      '学历要求', '公司规模', '行业领域', '发布时间', '职位链接', '是否投递', '投递结果', '职位描述'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '';
      str = String(str).replace(/"/g, '""');
      if (str.search(/("|,|\n|\r)/g) >= 0) {
        str = `"${str}"`;
      }
      return str;
    };

    let csvContent = '\uFEFF' + headers.join(',') + '\n';

    jobs.forEach(job => {
      const isApplied = job.isApplied === true ? '是' : (job.isApplied === false ? '否' : '');
      const row = [
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
        isApplied,
        job.applyResult || '',
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

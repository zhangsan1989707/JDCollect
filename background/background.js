importScripts('feishu_sync.js');

// 监听来自 Popup 或 Content Script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'save_job') {
    // 兼容单条保存
    saveJobsData([request.data], sendResponse);
    return true; // 异步响应
  } else if (request.action === 'save_jobs') {
    // 批量保存
    saveJobsData(request.data, sendResponse);
    return true; // 异步响应
  } else if (request.action === 'export_csv') {
    exportToCsv(sendResponse);
    return true; // 异步响应
  } else if (request.action === 'clear_data') {
    chrome.storage.local.set({ jobs: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'sync_feishu') {
    // 手动触发同步
    chrome.storage.local.get(['jobs'], (result) => {
      const jobs = result.jobs || [];
      // 这里可以根据需要筛选，例如只同步未同步过的，或者同步所有
      // 目前简单处理：同步所有，但飞书 API 本身不判重，建议用户谨慎使用
      // 或者：前端传递选中的 jobs 进行同步
      
      const jobsToSync = request.data ? request.data : jobs;
      
      syncToFeishu(jobsToSync, (res) => {
          sendResponse(res);
      });
    });
    return true; // 异步
  }
});

// 批量保存职位数据
function saveJobsData(newJobs, sendResponse) {
  if (!Array.isArray(newJobs)) {
    newJobs = [newJobs];
  }

  chrome.storage.local.get(['jobs'], (result) => {
    const existingJobs = result.jobs || [];
    let addedCount = 0;
    
    // 找出真正新增的数据 (根据 URL 去重)
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
        
        // 尝试同步到飞书 (只同步新增的)
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

// 导出为 CSV
function exportToCsv(sendResponse) {
  chrome.storage.local.get(['jobs'], (result) => {
    const jobs = result.jobs || [];
    if (jobs.length === 0) {
      sendResponse({ success: false, message: '没有可导出的数据' });
      return;
    }

    // 构建 CSV 内容
    const headers = [
      '职位名称', '公司名称', '薪资范围', '工作地点', '经验要求', 
      '学历要求', '公司规模', '行业领域', '发布时间', '职位链接', '是否投递', '投递结果', '职位描述'
    ];
    
    // 处理 CSV 转义
    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '';
      str = String(str).replace(/"/g, '""'); // 双引号转义
      // 如果包含逗号、双引号或换行符，必须用双引号包裹
      if (str.search(/("|,|\n|\r)/g) >= 0) {
        str = `"${str}"`;
      }
      return str;
    };

    let csvContent = '\uFEFF' + headers.join(',') + '\n'; // 添加 BOM 防止乱码

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

    // 创建 Data URL 并下载
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

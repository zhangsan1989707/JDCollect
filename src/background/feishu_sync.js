import { STATUS_LABELS, JOB_STATUS } from '../lib/utils.js';
import { decrypt } from '../lib/crypto.js';

async function getTenantAccessToken(appId, appSecret) {
  try {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });
    const data = await response.json();
    if (data.code === 0) return data.tenant_access_token;
    console.error('获取飞书 Token 失败:', data);
    return null;
  } catch (e) {
    console.error('网络请求失败:', e);
    return null;
  }
}

async function getExistingRecordKeys(config, token) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records?page_size=500`;
  const existingUrls = new Set();
  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.code === 0 && data.data && data.data.items) {
      data.data.items.forEach(item => {
        const linkField = item.fields && item.fields['职位链接'];
        if (linkField) {
          const linkText = typeof linkField === 'object' ? (linkField.link || linkField.text || '') : String(linkField);
          if (linkText) existingUrls.add(linkText);
        }
      });
    }
  } catch (e) {
    console.error('查询飞书已有记录失败:', e);
  }
  return existingUrls;
}

async function syncToFeishu(jobs, callback) {
  if (!jobs || jobs.length === 0) {
    if (callback) callback({ success: false, message: '没有数据需要同步' });
    return;
  }

  chrome.storage.local.get(['feishuConfig'], async (result) => {
    const config = result.feishuConfig;
    if (!config || !config.enabled || !config.appId || !config.appSecret || !config.appToken || !config.tableId) {
      if (callback) callback({ success: false, message: '飞书配置未启用或不完整' });
      return;
    }

    const decryptedSecret = await decrypt(config.appSecret, config.appId);
    const token = await getTenantAccessToken(config.appId, decryptedSecret);
    if (!token) {
      if (callback) callback({ success: false, message: '获取飞书 Access Token 失败' });
      return;
    }

    const existingUrls = await getExistingRecordKeys(config, token);
    const newJobs = jobs.filter(job => !existingUrls.has(job.url));

    if (newJobs.length === 0) {
      if (callback) callback({ success: true, count: 0, message: '所有数据已存在于飞书' });
      return;
    }

    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/batch_create`;

    const records = newJobs.map(job => ({
      fields: {
        '职位名称': job.title || '',
        '公司名称': job.company || '',
        '薪资范围': job.salary || '',
        '工作地点': job.location || '',
        '经验要求': job.experience || '',
        '学历要求': job.education || '',
        '公司规模': job.companySize || '',
        '行业领域': job.industry || '',
        '发布时间': job.publishTime || '',
        '职位链接': job.url || '',
        '是否投递': STATUS_LABELS[job.status] || (job.status === JOB_STATUS.APPLIED ? '是' : '否'),
        '投递结果': job.applyResult || '',
        '职位描述': job.description ? job.description.substring(0, 3000) : ''
      }
    }));

    try {
      const batchSize = 50;
      let totalSynced = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify({ records: batch })
        });
        const data = await response.json();
        if (data.code === 0) {
          totalSynced += batch.length;
        } else {
          console.error('同步飞书批次失败:', data);
        }
      }

      console.log(`成功同步 ${totalSynced} 条数据到飞书`);
      if (callback) callback({ success: true, count: totalSynced });
    } catch (e) {
      console.error('同步飞书网络错误:', e);
      if (callback) callback({ success: false, message: '网络请求错误: ' + e.message });
    }
  });
}

export { syncToFeishu };

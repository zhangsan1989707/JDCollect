// 飞书同步相关逻辑

// 1. 获取 tenant_access_token (内部应用)
async function getTenantAccessToken(appId, appSecret) {
  try {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        "app_id": appId,
        "app_secret": appSecret
      })
    });
    const data = await response.json();
    if (data.code === 0) {
      return data.tenant_access_token;
    } else {
      console.error('获取飞书 Token 失败:', data);
      return null;
    }
  } catch (e) {
    console.error('网络请求失败:', e);
    return null;
  }
}

    // 2. 同步数据到飞书多维表格
async function syncToFeishu(jobs, callback) {
  if (!jobs || jobs.length === 0) {
    if (callback) callback({ success: false, message: '没有数据需要同步' });
    return;
  }

  chrome.storage.local.get(['feishuConfig'], async (result) => {
    const config = result.feishuConfig;
    if (!config || !config.enabled || !config.appId || !config.appSecret || !config.appToken || !config.tableId) {
      console.log('飞书配置未启用或不完整');
      if (callback) callback({ success: false, message: '飞书配置未启用或不完整' });
      return;
    }

    const token = await getTenantAccessToken(config.appId, config.appSecret);
    if (!token) {
        if (callback) callback({ success: false, message: '获取飞书 Access Token 失败，请检查 App ID 和 Secret' });
        return;
    }

    // 批量写入 (Feishu Base API 支持 batch_create)
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/batch_create`;

    const records = jobs.map(job => {
      // 确定“是否投递”的值
      let isAppliedVal = "否";
      if (job.isApplied === true || job.isApplied === 'true') {
        isAppliedVal = "是";
      }

      return {
        fields: {
          "职位名称": job.title,
          "公司名称": job.company,
          "薪资范围": job.salary,
          "工作地点": job.location,
          "经验要求": job.experience,
          "学历要求": job.education,
          "公司规模": job.companySize,
          "行业领域": job.industry,
          "发布时间": job.publishTime, // 文本类型直接传原始值
          "职位链接": job.url, // 文本类型直接传 URL 字符串
          "是否投递": isAppliedVal, // 文本类型直接传字符串
          "投递结果": job.applyResult || "",
          "职位描述": job.description ? job.description.substring(0, 3000) : '' 
        }
      };
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          records: records
        })
      });
      
      const data = await response.json();
      if (data.code === 0) {
        console.log(`成功同步 ${records.length} 条数据到飞书`);
        if (callback) callback({ success: true, count: records.length });
      } else {
        console.error('同步飞书失败:', data);
        if (callback) callback({ success: false, message: `同步失败: ${data.msg} (Code: ${data.code})` });
      }
    } catch (e) {
      console.error('同步飞书网络错误:', e);
      if (callback) callback({ success: false, message: '网络请求错误: ' + e.message });
    }
  });
}

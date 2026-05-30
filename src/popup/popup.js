document.addEventListener('DOMContentLoaded', function() {
  const collectCurrentBtn = document.getElementById('collectCurrentBtn');
  const viewDataBtn = document.getElementById('viewDataBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const statusDiv = document.getElementById('status');

  function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? 'red' : '#666';
  }

  collectCurrentBtn.addEventListener('click', async () => {
    updateStatus('正在尝试连接当前标签页...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        updateStatus('无法获取当前标签页', true);
        return;
      }

      if (!tab.url.includes('zhipin.com') && !tab.url.includes('liepin.com') && !tab.url.includes('lagou.com') && !tab.url.includes('zhaopin.com')) {
        updateStatus('当前页面不是支持的招聘网站', true);
        return;
      }

      function sendMessageToContentScript(retry = true) {
        chrome.tabs.sendMessage(tab.id, { action: 'collect_job' }, (response) => {
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message;
            if (retry && (err.includes('Receiving end does not exist') || err.includes('Could not establish connection'))) {
              updateStatus('正在尝试注入采集脚本...');
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content/content.js']
              }, () => {
                if (chrome.runtime.lastError) {
                  updateStatus('注入脚本失败: ' + chrome.runtime.lastError.message, true);
                } else {
                  setTimeout(() => sendMessageToContentScript(false), 500);
                }
              });
            } else {
              updateStatus('连接页面失败，请刷新页面重试: ' + err, true);
            }
          } else if (response && response.success) {
            updateStatus(`采集成功！已保存 ${response.count || 1} 条职位`);
          } else {
            updateStatus('采集失败：' + (response ? response.message : '未知错误'), true);
          }
        });
      }

      sendMessageToContentScript();
    } catch (error) {
      updateStatus('发生错误: ' + error.message, true);
    }
  });

  viewDataBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard/dashboard.html' });
  });

  exportCsvBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'export_csv' }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus('导出失败: ' + chrome.runtime.lastError.message, true);
      } else if (response && response.success) {
        updateStatus('导出成功！');
      } else {
        updateStatus('导出失败', true);
      }
    });
  });

  clearDataBtn.addEventListener('click', () => {
    if (confirm('确定要清空所有已采集的数据吗？此操作不可恢复。')) {
      chrome.runtime.sendMessage({ action: 'clear_data' }, (response) => {
         if (response && response.success) {
           updateStatus('数据已清空');
         } else {
           updateStatus('清空失败');
         }
      });
    }
  });

  const settingsToggle = document.getElementById('settingsToggle');
  const settingsContent = document.getElementById('settingsContent');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const feishuAppId = document.getElementById('feishuAppId');
  const feishuAppSecret = document.getElementById('feishuAppSecret');
  const feishuAppToken = document.getElementById('feishuAppToken');
  const feishuTableId = document.getElementById('feishuTableId');

  settingsToggle.addEventListener('click', () => {
    settingsContent.classList.toggle('open');
    settingsToggle.textContent = settingsContent.classList.contains('open') ?
      '⚙️ 收起配置' : '⚙️ 飞书同步配置 (点击展开)';
  });

  chrome.storage.local.get(['feishuConfig'], (result) => {
    if (result.feishuConfig) {
      feishuAppId.value = result.feishuConfig.appId || '';
      feishuAppSecret.value = result.feishuConfig.appSecret || '';
      feishuAppToken.value = result.feishuConfig.appToken || '';
      feishuTableId.value = result.feishuConfig.tableId || '';
    }
  });

  saveSettingsBtn.addEventListener('click', () => {
    const config = {
      appId: feishuAppId.value.trim(),
      appSecret: feishuAppSecret.value.trim(),
      appToken: feishuAppToken.value.trim(),
      tableId: feishuTableId.value.trim(),
      enabled: true
    };

    if (!config.appId || !config.appSecret || !config.appToken || !config.tableId) {
      updateStatus('请填写完整飞书配置', true);
      return;
    }

    chrome.storage.local.set({ feishuConfig: config }, () => {
      updateStatus('飞书配置已保存，采集时将自动同步');
      setTimeout(() => {
        settingsContent.classList.remove('open');
        settingsToggle.textContent = '⚙️ 飞书同步配置 (点击展开)';
      }, 1000);
    });
  });
});

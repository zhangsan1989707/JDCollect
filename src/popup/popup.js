import { encrypt, decrypt } from '../lib/crypto.js';

const SUPPORTED_DOMAINS = ['zhipin.com', 'liepin.com', 'lagou.com', 'zhaopin.com'];

document.addEventListener('DOMContentLoaded', function() {
  const collectCurrentBtn = document.getElementById('collectCurrentBtn');
  const autoCollectBtn = document.getElementById('autoCollectBtn');
  const viewDataBtn = document.getElementById('viewDataBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const statusDiv = document.getElementById('status');

  loadStorageUsage();

  function updateStatus(message, type = '') {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }

  function isSupportedSite(url) {
    return SUPPORTED_DOMAINS.some(d => url.includes(d));
  }

  collectCurrentBtn.addEventListener('click', async () => {
    updateStatus('正在尝试连接当前标签页...');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) { updateStatus('无法获取当前标签页', 'error'); return; }
      if (!isSupportedSite(tab.url)) { updateStatus('当前页面不是支持的招聘网站', 'error'); return; }

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
                  updateStatus('注入脚本失败: ' + chrome.runtime.lastError.message, 'error');
                } else {
                  setTimeout(() => sendMessageToContentScript(false), 500);
                }
              });
            } else {
              updateStatus('连接页面失败，请刷新页面重试', 'error');
            }
          } else if (response && response.success) {
            updateStatus(`采集成功！已保存 ${response.count || 1} 条职位`, 'success');
            loadStorageUsage();
          } else {
            updateStatus('采集失败：' + (response ? response.message : '未知错误'), 'error');
          }
        });
      }
      sendMessageToContentScript();
    } catch (error) {
      updateStatus('发生错误: ' + error.message, 'error');
    }
  });

  autoCollectBtn.addEventListener('click', async () => {
    if (autoCollectBtn.classList.contains('running')) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) chrome.tabs.sendMessage(tab.id, { action: 'stop_auto_collect' });
      } catch {}
      autoCollectBtn.classList.remove('running');
      autoCollectBtn.textContent = '⚡ 自动翻页采集';
      updateStatus('已停止自动采集', 'success');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) { updateStatus('无法获取当前标签页', 'error'); return; }
      if (!isSupportedSite(tab.url)) { updateStatus('当前页面不是支持的招聘网站', 'error'); return; }

      autoCollectBtn.classList.add('running');
      autoCollectBtn.textContent = '⏹️ 停止自动采集';
      updateStatus('自动采集中...');

      chrome.tabs.sendMessage(tab.id, { action: 'start_auto_collect' }, (response) => {
        autoCollectBtn.classList.remove('running');
        autoCollectBtn.textContent = '⚡ 自动翻页采集';
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
          }, () => {
            if (!chrome.runtime.lastError) {
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'start_auto_collect' }, (res) => {
                  if (res && res.success) {
                    updateStatus(`自动采集完成！共采集 ${res.count} 条，翻页 ${res.pages} 页`, 'success');
                  } else {
                    updateStatus('自动采集失败：' + (res ? res.message : '未知错误'), 'error');
                  }
                  loadStorageUsage();
                });
              }, 500);
            }
          });
        } else if (response && response.success) {
          updateStatus(`自动采集完成！共采集 ${response.count} 条，翻页 ${response.pages} 页`, 'success');
          loadStorageUsage();
        } else {
          updateStatus('自动采集失败：' + (response ? response.message : '未知错误'), 'error');
        }
      });
    } catch (error) {
      autoCollectBtn.classList.remove('running');
      autoCollectBtn.textContent = '⚡ 自动翻页采集';
      updateStatus('发生错误: ' + error.message, 'error');
    }
  });

  viewDataBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard/dashboard.html' });
  });

  exportCsvBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'export_csv' }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus('导出失败: ' + chrome.runtime.lastError.message, 'error');
      } else if (response && response.success) {
        updateStatus('导出成功！', 'success');
      } else {
        updateStatus('导出失败', 'error');
      }
    });
  });

  clearDataBtn.addEventListener('click', () => {
    if (confirm('确定要清空所有已采集的数据吗？此操作不可恢复。')) {
      chrome.runtime.sendMessage({ action: 'clear_data' }, (response) => {
        if (response && response.success) {
          updateStatus('数据已清空', 'success');
          loadStorageUsage();
        } else {
          updateStatus('清空失败', 'error');
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

  loadFeishuConfig();

  saveSettingsBtn.addEventListener('click', async () => {
    const appId = feishuAppId.value.trim();
    const appSecret = feishuAppSecret.value.trim();
    const appToken = feishuAppToken.value.trim();
    const tableId = feishuTableId.value.trim();

    if (!appId || !appSecret || !appToken || !tableId) {
      updateStatus('请填写完整飞书配置', 'error');
      return;
    }

    const encryptedSecret = await encrypt(appSecret, appId);
    const config = { appId, appSecret: encryptedSecret, appToken, tableId, enabled: true };

    chrome.storage.local.set({ feishuConfig: config }, () => {
      updateStatus('飞书配置已保存（密钥已加密），采集时将自动同步', 'success');
      setTimeout(() => {
        settingsContent.classList.remove('open');
        settingsToggle.textContent = '⚙️ 飞书同步配置 (点击展开)';
      }, 1000);
    });
  });

  async function loadFeishuConfig() {
    chrome.storage.local.get(['feishuConfig'], async (result) => {
      if (result.feishuConfig) {
        feishuAppId.value = result.feishuConfig.appId || '';
        if (result.feishuConfig.appSecret) {
          const decrypted = await decrypt(result.feishuConfig.appSecret, result.feishuConfig.appId);
          feishuAppSecret.value = decrypted || '';
        }
        feishuAppToken.value = result.feishuConfig.appToken || '';
        feishuTableId.value = result.feishuConfig.tableId || '';
      }
    });
  }

  function loadStorageUsage() {
    chrome.runtime.sendMessage({ action: 'get_storage_usage' }, (response) => {
      if (response && response.success && response.data) {
        const { percentage, used, total } = response.data;
        document.getElementById('storageText').textContent = `${(used / 1024).toFixed(1)}KB / ${(total / 1024 / 1024).toFixed(1)}MB (${percentage}%)`;
        document.getElementById('storageFill').style.width = `${Math.min(parseFloat(percentage), 100)}%`;
      }
    });
  }
});

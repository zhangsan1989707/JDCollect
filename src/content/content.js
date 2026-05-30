// SELECTORS 配置与 src/selectors/*.json 保持同步，修改时请同步更新对应 JSON 文件
const SELECTORS = {
  zhipin: {
    name: 'BOSS直聘',
    domain: 'zhipin.com',
    detailPage: {
      urlPattern: '/job_detail/',
      selectors: {
        title: ['.job-name .name h1', 'h1'],
        salary: ['.job-banner .salary', '.salary'],
        company: ['.sider-company .company-name', '.job-sec.company-info .name', '.business-info h4'],
        companyInfo: ['.sider-company p', '.job-sec.company-info .name + div'],
        location: ['.job-banner p', '.job-primary .info-primary p'],
        description: ['.job-sec-text', '.job-detail-section'],
        publishTime: ['.job-boss-info .boss-active-time']
      }
    },
    listPage: {
      urlPattern: '/web/geek/job',
      selectors: {
        jobCard: '.job-card-wrapper',
        title: '.job-name',
        salary: '.salary',
        company: '.company-name',
        location: '.job-area',
        tags: '.tag-list span',
        link: 'a.job-card-left',
        industry: '.company-tag-list'
      },
      pagination: {
        nextButton: '.options-pages .next',
        pageIndicator: '.options-pages .cur'
      }
    }
  },
  liepin: {
    name: '猎聘',
    domain: 'liepin.com',
    detailPage: {
      urlPattern: '/job/',
      detectSelector: '.job-title-box',
      selectors: {
        title: ['h1', '.job-title-box .name'],
        salary: ['.job-title-box .salary', '.salary'],
        company: ['.job-company-box .company-name', '.company-info-container h3', 'aside .company-name'],
        location: ['.job-dq'],
        experience: ['.job-qualifications span:nth-child(1)'],
        education: ['.job-qualifications span:nth-child(2)'],
        description: ['.job-intro-content']
      }
    },
    listPage: {
      urlPattern: '/zhaopin/',
      detectSelector: '.job-list-item,.job-list',
      selectors: {
        jobCard: '.job-list-item,.job-card-wrapper',
        title: '.job-title,.job-name',
        salary: '.job-salary,.salary',
        company: '.company-name,.job-company',
        location: '.job-area,.job-dq',
        link: 'a[href*="/job/"]',
        industry: '.company-tag-list'
      },
      pagination: {
        nextButton: '.pager .next,a.next',
        pageIndicator: '.pager .current,.pager .active'
      }
    }
  },
  lagou: {
    name: '拉勾',
    domain: 'lagou.com',
    detailPage: {
      urlPattern: '/job/',
      detectSelector: '.job-detail,.job-description',
      selectors: {
        title: ['.job-name span', '.job-name', 'h1'],
        salary: ['.job-salary', '.salary'],
        company: ['.company-name a', '.job-company .company-name', '.c-feature-name'],
        location: ['.job-location', '.job-address'],
        experience: ['.job-advantage span:nth-child(1)', '.job-request span:nth-child(2)'],
        education: ['.job-advantage span:nth-child(2)', '.job-request span:nth-child(3)'],
        description: ['.job-description', '.job-detail-section', '.job_bt']
      }
    },
    listPage: {
      urlPattern: '/zhaopin/',
      detectSelector: '.position-list,.list-content',
      selectors: {
        jobCard: '.position-list-item,.item__10RTO',
        title: '.position-name,.p-top a span',
        salary: '.salary,.p-bottom span',
        company: '.company-name a,.c-feature-name',
        location: '.position-location,.industry',
        link: 'a.position-name,a[href*="/job/"]',
        industry: '.industry'
      },
      pagination: {
        nextButton: '.pager_next,a.next',
        pageIndicator: '.pager_current,.active'
      }
    }
  },
  zhaopin: {
    name: '智联招聘',
    domain: 'zhaopin.com',
    detailPage: {
      urlPattern: '/jobs/',
      detectSelector: '.job-detail-box,.summary-plane__title',
      selectors: {
        title: ['.summary-plane__title', 'h1', '.job-name'],
        salary: ['.summary-plane__salary', '.salary'],
        company: ['.company-info__name a', '.company-name a'],
        location: ['.job-location', '.job-address'],
        experience: ['.summary-plane__info span:nth-child(2)', '.job-advantage span'],
        education: ['.summary-plane__info span:nth-child(3)', '.job-advantage span'],
        description: ['.job-description-section', '.describtion__detail-content']
      }
    },
    listPage: {
      urlPattern: '/sou/',
      detectSelector: '.joblist-box,.positionlist',
      selectors: {
        jobCard: '.joblist-box__item,.positionlist__item',
        title: '.jobinfo__top a,.job-name',
        salary: '.jobinfo__salary,.salary',
        company: '.companyinfo__top a,.company-name',
        location: '.jobinfo__other span:first-child,.job-area',
        link: 'a.jobinfo__top,a[href*="/jobs/"]',
        industry: '.companyinfo__tag'
      },
      pagination: {
        nextButton: '.soupager__next,a.next',
        pageIndicator: '.soupager__current,.active'
      }
    }
  }
};

function getText(selector, context = document) {
  const el = context.querySelector(selector);
  return el ? el.innerText.trim() : '';
}

function getTextFromList(selectors, context = document) {
  for (const sel of selectors) {
    const text = getText(sel, context);
    if (text) return text;
  }
  return '';
}

function detectPlatform(url) {
  for (const [key, config] of Object.entries(SELECTORS)) {
    if (url.includes(config.domain)) return key;
  }
  return null;
}

let autoCollectRunning = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collect_job') {
    collectJobData().then(result => {
      if (result && result.success) {
        const jobs = Array.isArray(result.data) ? result.data : [result.data];
        chrome.runtime.sendMessage({ action: 'save_jobs', data: jobs }, (response) => {
          if (response && response.success) {
            sendResponse({ success: true, count: response.count, total: response.total });
          } else {
            sendResponse({ success: false, message: response ? response.message : '保存失败' });
          }
        });
      } else {
        sendResponse({ success: false, message: result.message || '无法解析页面数据' });
      }
    }).catch(err => {
      sendResponse({ success: false, message: err.message });
    });
    return true;
  } else if (request.action === 'start_auto_collect') {
    startAutoCollect().then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ success: false, message: err.message });
    });
    return true;
  } else if (request.action === 'stop_auto_collect') {
    autoCollectRunning = false;
    sendResponse({ success: true, message: '已停止自动采集' });
    return true;
  }
});

async function collectJobData() {
  const url = window.location.href;
  const platform = detectPlatform(url);
  if (!platform) return { success: false, message: '不支持的网站' };

  const config = SELECTORS[platform];
  try {
    if (isDetailPage(url, config)) {
      return parseDetailPage(url, config);
    } else if (isListPage(url, config)) {
      return parseListPage(config);
    }
    return { success: false, message: '未识别的页面类型' };
  } catch (e) {
    return { success: false, message: '解析发生错误: ' + e.message };
  }
}

function isDetailPage(url, config) {
  const dp = config.detailPage;
  return url.includes(dp.urlPattern) || (dp.detectSelector && document.querySelector(dp.detectSelector));
}

function isListPage(url, config) {
  const lp = config.listPage;
  return url.includes(lp.urlPattern) || (lp.detectSelector && document.querySelector(lp.detectSelector));
}

function parseDetailPage(url, config) {
  const sel = config.detailPage.selectors;
  const title = Array.isArray(sel.title) ? getTextFromList(sel.title) : getText(sel.title);
  if (!title) return { success: false, message: '未找到职位名称' };

  const salary = Array.isArray(sel.salary) ? getTextFromList(sel.salary) : getText(sel.salary);

  const company = Array.isArray(sel.company)
    ? getTextFromList(sel.company)
    : (getText(sel.company) || (function() {
        const li = Array.from(document.querySelectorAll('li')).find(el => el.innerText.includes('公司名称'));
        return li ? li.innerText.replace('公司名称', '').trim() : '';
      })() || '未知公司');

  let companySize = '未知', industry = '未知', financing = '未知';
  if (sel.companyInfo) {
    const companyInfoText = Array.isArray(sel.companyInfo) ? getTextFromList(sel.companyInfo) : getText(sel.companyInfo);
    if (companyInfoText) {
      const parts = companyInfoText.split(/[\s|·]+/);
      companySize = parts.find(p => p.includes('人')) || '未知';
      financing = parts.find(p => ['天使轮','A轮','B轮','C轮','D轮','已上市','未融资'].some(r => p.includes(r))) || '未知';
      industry = parts.find(p => !p.includes('人') && !['天使轮','A轮','B轮','C轮','D轮','已上市','未融资'].some(r => p.includes(r))) || '未知';
    }
  }

  let location = '未知', experience = '经验不限', education = '学历不限';

  if (sel.location) {
    const locEl = Array.isArray(sel.location) ? document.querySelector(sel.location.find(s => document.querySelector(s))) : document.querySelector(sel.location);
    if (locEl) {
      const text = locEl.innerText;
      const parts = text.split(/[\s|·]+/);
      if (parts.length > 0) location = parts[0];
      const expPart = parts.find(p => p.includes('年') || p === '经验不限');
      if (expPart) experience = expPart;
      const eduPart = parts.find(p => ['本科', '硕士', '大专', '博士', '学历'].some(k => p.includes(k)));
      if (eduPart) education = eduPart;
    }
  }

  if (sel.experience) {
    const exp = Array.isArray(sel.experience) ? getTextFromList(sel.experience) : getText(sel.experience);
    if (exp) experience = exp;
  }
  if (sel.education) {
    const edu = Array.isArray(sel.education) ? getTextFromList(sel.education) : getText(sel.education);
    if (edu) education = edu;
  }

  const description = Array.isArray(sel.description) ? getTextFromList(sel.description) : getText(sel.description);

  let publishTime = '刚刚';
  if (sel.publishTime) {
    const pt = Array.isArray(sel.publishTime) ? getTextFromList(sel.publishTime) : getText(sel.publishTime);
    if (pt) publishTime = pt;
  } else {
    const activeEl = document.querySelector('.job-boss-info .boss-active-time') ||
                     Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.includes('活跃于'));
    if (activeEl) publishTime = activeEl.innerText;
  }

  return {
    success: true,
    data: {
      title, company, salary, location, experience, education,
      companySize,
      industry: industry + (financing !== '未知' ? ` (${financing})` : ''),
      publishTime, description,
      url: url,
      source: detectPlatform(url),
      collectedAt: Date.now()
    }
  };
}

function parseListPage(config) {
  const sel = config.listPage.selectors;
  const jobCards = document.querySelectorAll(sel.jobCard);
  if (jobCards.length === 0) return { success: false, message: '未找到职位列表' };

  const jobs = [];
  jobCards.forEach(card => {
    try {
      const title = getText(sel.title, card);
      const salary = getText(sel.salary, card);
      const company = getText(sel.company, card);
      const location = getText(sel.location, card);

      let experience = '经验不限', education = '学历不限';
      if (sel.tags) {
        const tags = Array.from(card.querySelectorAll(sel.tags)).map(s => s.innerText);
        experience = tags.find(t => t.includes('年')) || '经验不限';
        education = tags.find(t => ['本科', '硕士', '大专', '博士'].some(k => t.includes(k))) || '学历不限';
      }

      const linkEl = card.querySelector(sel.link);
      const link = linkEl ? linkEl.href : '';

      const industry = sel.industry ? getText(sel.industry, card) : '未知';

      if (title && link) {
        jobs.push({
          title, company, salary, location, experience, education,
          companySize: '未知', industry,
          publishTime: '列表页不显示',
          description: '请进入详情页查看',
          url: link,
          source: detectPlatform(window.location.href),
          collectedAt: Date.now()
        });
      }
    } catch (e) {
      console.warn('解析单个卡片失败', e);
    }
  });

  return jobs.length > 0 ? { success: true, data: jobs } : { success: false, message: '未解析到有效职位' };
}

async function startAutoCollect() {
  if (autoCollectRunning) return { success: false, message: '自动采集已在运行中' };

  const url = window.location.href;
  const platform = detectPlatform(url);
  if (!platform) return { success: false, message: '不支持的网站' };

  const config = SELECTORS[platform];
  if (!isListPage(url, config)) return { success: false, message: '自动采集仅支持列表页' };

  autoCollectRunning = true;
  let totalCollected = 0;
  let pageCount = 0;
  const maxPages = 20;

  while (autoCollectRunning && pageCount < maxPages) {
    const result = parseListPage(config);
    if (result.success && result.data) {
      const jobs = Array.isArray(result.data) ? result.data : [result.data];
      await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'save_jobs', data: jobs }, (response) => {
          if (response && response.success) totalCollected += response.count;
          resolve();
        });
      });
    }

    const nextBtn = document.querySelector(config.listPage.pagination?.nextButton);
    if (!nextBtn || nextBtn.disabled || nextBtn.classList.contains('disabled')) break;

    nextBtn.click();
    pageCount++;
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1500));
    await new Promise(r => {
      const check = setInterval(() => {
        if (document.readyState === 'complete') {
          clearInterval(check);
          r();
        }
      }, 200);
    });
  }

  autoCollectRunning = false;
  return { success: true, count: totalCollected, pages: pageCount };
}

const SELECTOR_CACHE_KEY = 'jdcollect_selector_cache';
const SELECTOR_CACHE_TTL = 1000 * 60 * 60;
const DEFAULT_SELECTOR_URL = 'https://cdn.jsdelivr.net/gh/zhangsan1989707/JDCollect@main/src/selectors/';

async function loadSelectors(domain) {
  const cache = await tryGetCache();
  if (cache) {
    return cache[domain] || null;
  }

  const remoteSelectors = await tryLoadRemote();
  if (remoteSelectors) {
    await saveCache(remoteSelectors);
    return remoteSelectors[domain] || null;
  }

  return loadBuiltinSelectors(domain);
}

async function tryGetCache() {
  try {
    const result = await new Promise(resolve => chrome.storage.local.get([SELECTOR_CACHE_KEY], resolve));
    const cache = result[SELECTOR_CACHE_KEY];
    if (!cache) return null;
    if (Date.now() - cache.timestamp > SELECTOR_CACHE_TTL) return null;
    return cache.data;
  } catch {
    return null;
  }
}

async function saveCache(data) {
  try {
    await new Promise(resolve => chrome.storage.local.set({
      [SELECTOR_CACHE_KEY]: { data, timestamp: Date.now() }
    }, resolve));
  } catch {}
}

async function tryLoadRemote() {
  try {
    const domains = ['zhipin.com', 'liepin.com', 'lagou.com', 'zhaopin.com'];
    const data = {};
    for (const domain of domains) {
      const resp = await fetch(DEFAULT_SELECTOR_URL + domain.replace('.', '_') + '.json');
      if (resp.ok) data[domain] = await resp.json();
    }
    return Object.keys(data).length > 0 ? data : null;
  } catch {
    return null;
  }
}

function loadBuiltinSelectors(domain) {
  const builtin = {
    'zhipin.com': {
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
    'liepin.com': {
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
    'lagou.com': {
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
    'zhaopin.com': {
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
  return builtin[domain] || null;
}

async function getAllSelectors() {
  const cache = await tryGetCache();
  if (cache) {
    const selectors = {};
    for (const domain in cache) {
      const config = cache[domain];
      if (config && config.domain) {
        const key = config.domain.replace('.com', '');
        selectors[key] = config;
      }
    }
    if (Object.keys(selectors).length > 0) {
      return selectors;
    }
  }

  const remoteSelectors = await tryLoadRemote();
  if (remoteSelectors) {
    await saveCache(remoteSelectors);
    const selectors = {};
    for (const domain in remoteSelectors) {
      const config = remoteSelectors[domain];
      if (config && config.domain) {
        const key = config.domain.replace('.com', '');
        selectors[key] = config;
      }
    }
    if (Object.keys(selectors).length > 0) {
      return selectors;
    }
  }

  const builtin = {
    zhipin: loadBuiltinSelectors('zhipin.com'),
    liepin: loadBuiltinSelectors('liepin.com'),
    lagou: loadBuiltinSelectors('lagou.com'),
    zhaopin: loadBuiltinSelectors('zhaopin.com')
  };
  return builtin;
}

export { loadSelectors, getAllSelectors };

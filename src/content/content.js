console.log('JD Collector Content Script Loaded');

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
      console.error('采集出错:', err);
      sendResponse({ success: false, message: err.message });
    });
    return true;
  }
});

async function collectJobData() {
  const url = window.location.href;
  let result = { success: false, data: null, message: '' };

  try {
    if (url.includes('zhipin.com')) {
      result = parseBossZhipin();
    } else if (url.includes('liepin.com')) {
      result = parseLiepin();
    } else {
      return { success: false, message: '不支持的网站' };
    }
  } catch (e) {
    console.error(e);
    return { success: false, message: '解析发生错误: ' + e.message };
  }

  return result;
}

function getText(selector, context = document) {
  const el = context.querySelector(selector);
  return el ? el.innerText.trim() : '';
}

function parseBossZhipin() {
  console.log('解析 BOSS直聘 页面...');
  const url = window.location.href;

  if (url.includes('/job_detail/')) {
    const title = getText('.job-name .name h1') || getText('h1');
    if (!title) return { success: false, message: '未找到职位名称' };

    const salary = getText('.job-banner .salary') || getText('.salary');

    const company = getText('.sider-company .company-name') ||
                    getText('.job-sec.company-info .name') ||
                    getText('.business-info h4') ||
                    (function(){
                       const li = Array.from(document.querySelectorAll('li')).find(el => el.innerText.includes('公司名称'));
                       return li ? li.innerText.replace('公司名称', '').trim() : '';
                    })() ||
                    '未知公司';

    let companySize = '未知';
    let industry = '未知';
    let financing = '未知';

    const companyInfoText = getText('.sider-company p') || getText('.job-sec.company-info .name + div');
    if (companyInfoText) {
        const parts = companyInfoText.split(/[\s|·]+/);
        companySize = parts.find(p => p.includes('人')) || '未知';
        financing = parts.find(p => ['天使轮','A轮','B轮','C轮','D轮','已上市','未融资'].some(r => p.includes(r))) || '未知';
        industry = parts.find(p => !p.includes('人') && !['天使轮','A轮','B轮','C轮','D轮','已上市','未融资'].some(r => p.includes(r))) || '未知';
    }

    let location = '未知';
    let experience = '经验不限';
    let education = '学历不限';

    const bannerP = document.querySelector('.job-banner p') || document.querySelector('.job-primary .info-primary p');
    if (bannerP) {
        const text = bannerP.innerText;
        const parts = text.split(/[\s|·]+/);

        if (parts.length > 0) location = parts[0];

        const expPart = parts.find(p => p.includes('年') || p === '经验不限');
        if (expPart) experience = expPart;

        const eduPart = parts.find(p => ['本科', '硕士', '大专', '博士', '学历'].some(k => p.includes(k)));
        if (eduPart) education = eduPart;
    }

    const description = getText('.job-sec-text') || getText('.job-detail-section');

    let publishTime = '刚刚';
    const activeEl = document.querySelector('.job-boss-info .boss-active-time') ||
                     Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.includes('活跃于'));
    if (activeEl) {
        publishTime = activeEl.innerText;
    }

    return {
      success: true,
      data: {
        title,
        company,
        salary,
        location,
        experience,
        education,
        companySize,
        industry: industry + (financing !== '未知' ? ` (${financing})` : ''),
        publishTime,
        description,
        url: url,
        collectedAt: Date.now()
      }
    };
  }
  else if (url.includes('/web/geek/job')) {
    const jobCards = document.querySelectorAll('.job-card-wrapper');
    if (jobCards.length === 0) return { success: false, message: '未找到职位列表' };

    const jobs = [];
    jobCards.forEach(card => {
      try {
        const title = getText('.job-name', card);
        const salary = getText('.salary', card);
        const company = getText('.company-name', card);
        const location = getText('.job-area', card);
        const tags = Array.from(card.querySelectorAll('.tag-list span')).map(s => s.innerText);
        const experience = tags.find(t => t.includes('年')) || '经验不限';
        const education = tags.find(t => ['本科', '硕士', '大专', '博士'].some(k => t.includes(k))) || '学历不限';
        const linkEl = card.querySelector('a.job-card-left');
        const link = linkEl ? linkEl.href : '';

        if (title && link) {
          jobs.push({
            title,
            company,
            salary,
            location,
            experience,
            education,
            companySize: '未知',
            industry: getText('.company-tag-list', card),
            publishTime: '列表页不显示',
            description: '请进入详情页查看',
            url: link,
            collectedAt: Date.now()
          });
        }
      } catch (e) {
        console.warn('解析单个卡片失败', e);
      }
    });

    return { success: true, data: jobs };
  }

  return { success: false, message: '未识别的页面类型' };
}

function parseLiepin() {
  console.log('解析 猎聘 页面...');
  const url = window.location.href;

  if (url.includes('/job/') || document.querySelector('.job-title-box')) {
    let title = getText('h1') || getText('.job-title-box .name');
    let salary = getText('.job-title-box .salary') || getText('.salary');
    let company = getText('.job-company-box .company-name') || getText('.company-info-container h3') || getText('aside .company-name');

    if (!title) {
       const h1 = document.querySelector('h1');
       if (h1) title = h1.innerText;
    }

    if (!salary) {
       const potentialSalary = Array.from(document.querySelectorAll('span, div, h3')).find(el =>
         /^\d+-\d+k/i.test(el.innerText.trim())
       );
       if (potentialSalary) salary = potentialSalary.innerText;
    }

    return {
      success: true,
      data: {
        title: title || document.title,
        company: company || '未知公司',
        salary: salary || '面议',
        location: getText('.job-dq') || '未知',
        experience: getText('.job-qualifications span:nth-child(1)') || '不限',
        education: getText('.job-qualifications span:nth-child(2)') || '不限',
        companySize: '未知',
        industry: '未知',
        publishTime: '刚刚',
        description: getText('.job-intro-content') || '暂无',
        url: url,
        collectedAt: Date.now()
      }
    };
  }
  else if (url.includes('/zhaopin/') || document.querySelectorAll('.job-list-item').length > 0) {
    const jobs = [];
    const jobLinks = Array.from(document.querySelectorAll('a')).filter(a =>
      a.innerText.includes('【') && a.innerText.includes('】') && /\d+k/i.test(a.innerText)
    );

    jobLinks.forEach(link => {
      try {
        const text = link.innerText;
        const titleMatch = text.match(/^(.*?)【/);
        const locationMatch = text.match(/【(.*?)】/);

        const parts = text.split(/\s+/).filter(p => p.trim());

        const salary = parts.find(p => /k$/i.test(p) || /万/.test(p)) || '面议';
        const location = locationMatch ? locationMatch[1].trim() : '未知';
        const title = titleMatch ? titleMatch[1].trim() : parts[0];

        jobs.push({
          title,
          company: '列表页未显示公司全称',
          salary,
          location,
          experience: parts.find(p => p.includes('年')) || '经验不限',
          education: parts.find(p => ['本科', '硕士', '大专'].some(k => p.includes(k))) || '学历不限',
          companySize: '',
          industry: '',
          publishTime: '',
          description: '请进入详情页查看',
          url: link.href,
          collectedAt: Date.now()
        });
      } catch (e) {
        console.warn('解析列表项失败', e);
      }
    });

    if (jobs.length > 0) {
      return { success: true, data: jobs };
    }

    return { success: false, message: '未找到符合特征的职位列表' };
  }

  return { success: false, message: '未识别的页面类型' };
}

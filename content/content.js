console.log('JD Collector Content Script Loaded');

// 监听来自 Popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collect_job') {
    collectJobData().then(result => {
      if (result && result.success) {
        // 发送数据给 Background 保存
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
    return true; // 异步响应
  }
});

// 核心采集逻辑
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

// 通用文本提取 Helper
function getText(selector, context = document) {
  const el = context.querySelector(selector);
  return el ? el.innerText.trim() : '';
}

// 解析 BOSS直聘
function parseBossZhipin() {
  console.log('解析 BOSS直聘 页面...');
  const url = window.location.href;
  
  // 详情页判断
  if (url.includes('/job_detail/')) {
    const title = getText('.job-name .name h1') || getText('h1');
    if (!title) return { success: false, message: '未找到职位名称' };

    const salary = getText('.job-banner .salary') || getText('.salary');
    
    // 公司名称：优先侧边栏，其次详情区
    const company = getText('.sider-company .company-name') || 
                    getText('.job-sec.company-info .name') || 
                    getText('.business-info h4') || 
                    // 兜底：尝试查找包含"公司名称"的列表项
                    (function(){
                       const li = Array.from(document.querySelectorAll('li')).find(el => el.innerText.includes('公司名称'));
                       return li ? li.innerText.replace('公司名称', '').trim() : '';
                    })() || 
                    '未知公司';

    // 公司信息（行业、规模、融资）
    let companySize = '未知';
    let industry = '未知';
    let financing = '未知'; // 融资阶段

    // 尝试从侧边栏或公司信息区获取
    const companyInfoText = getText('.sider-company p') || getText('.job-sec.company-info .name + div');
    if (companyInfoText) {
        // 常见格式：互联网 | B轮 | 100-499人
        const parts = companyInfoText.split(/[\s|·]+/);
        companySize = parts.find(p => p.includes('人')) || '未知';
        financing = parts.find(p => ['天使轮','A轮','B轮','C轮','D轮','已上市','未融资'].some(r => p.includes(r))) || '未知';
        industry = parts.find(p => !p.includes('人') && !['天使轮','A轮','B轮','C轮','D轮','已上市','未融资'].some(r => p.includes(r))) || '未知';
    }

    // 地点、经验、学历
    // 结构通常在 .job-banner 的 p 标签中
    let location = '未知';
    let experience = '经验不限';
    let education = '学历不限';

    const bannerP = document.querySelector('.job-banner p') || document.querySelector('.job-primary .info-primary p');
    if (bannerP) {
        // 尝试获取纯文本节点，避免 hidden 元素干扰
        // 如果 HTML 结构比较清晰，可以直接用 innerText
        const text = bannerP.innerText; 
        const parts = text.split(/[\s|·]+/); // 兼容多种分隔符
        
        // 通常第一个是地点
        if (parts.length > 0) location = parts[0];
        
        // 查找包含“年”的作为经验
        const expPart = parts.find(p => p.includes('年') || p === '经验不限');
        if (expPart) experience = expPart;
        
        // 查找学历关键词
        const eduPart = parts.find(p => ['本科', '硕士', '大专', '博士', '学历'].some(k => p.includes(k)));
        if (eduPart) education = eduPart;
    }

    const description = getText('.job-sec-text') || getText('.job-detail-section');
    
    // 发布时间
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
  // 列表页判断 (通常 URL 包含 /web/geek/job)
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
            industry: getText('.company-tag-list', card), // 行业通常在这里
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

// 解析 猎聘
function parseLiepin() {
  console.log('解析 猎聘 页面...');
  const url = window.location.href;

  // 详情页判断 (通常包含 /job/)
  if (url.includes('/job/') || document.querySelector('.job-title-box')) {
    // 优先尝试新的选择器结构
    let title = getText('h1') || getText('.job-title-box .name');
    let salary = getText('.job-title-box .salary') || getText('.salary');
    let company = getText('.job-company-box .company-name') || getText('.company-info-container h3') || getText('aside .company-name');
    
    // 如果上述选择器失效，尝试根据文本内容定位
    if (!title) {
       // 容错：查找最大的标题
       const h1 = document.querySelector('h1');
       if (h1) title = h1.innerText;
    }

    if (!salary) {
       // 容错：查找包含 'k' 或 '万' 的独立文本块
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
        location: getText('.job-dq') || '未知', // job-dq 是猎聘常见的地点类名
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
  // 列表页判断 (通常包含 /zhaopin/)
  else if (url.includes('/zhaopin/') || document.querySelectorAll('.job-list-item').length > 0) {
    // 尝试解析列表
    // 猎聘的新版列表页结构比较复杂，可能是 react 渲染的
    // 根据之前的 snapshot，列表项可能是链接，且文本包含所有信息
    // 格式: "职位名称 【 地点 】 薪资 经验 学历"
    
    const jobs = [];
    // 查找所有可能的职位链接容器
    const jobLinks = Array.from(document.querySelectorAll('a')).filter(a => 
      a.innerText.includes('【') && a.innerText.includes('】') && /\d+k/i.test(a.innerText)
    );

    jobLinks.forEach(link => {
      try {
        const text = link.innerText; // "前端（中银香港驻场） 【 深圳-罗湖区 】 急聘 15-22k 6年以上 统招本科"
        // 简单的正则解析
        const titleMatch = text.match(/^(.*?)【/);
        const locationMatch = text.match(/【(.*?)】/);
        const salaryMatch = text.match(/】\s*(.*?)\s+(\d+.*?)k/i) || text.match(/(\d+-\d+k)/i); // 粗略匹配
        
        // 更稳健的解析：利用空格分割
        const parts = text.split(/\s+/).filter(p => p.trim());
        // 假设 parts[0] 是标题的一部分， parts 中包含 k 结尾的是薪资
        
        const salary = parts.find(p => /k$/i.test(p) || /万/.test(p)) || '面议';
        const location = locationMatch ? locationMatch[1].trim() : '未知';
        const title = titleMatch ? titleMatch[1].trim() : parts[0];
        
        jobs.push({
          title,
          company: '列表页未显示公司全称', // 猎聘列表页有时不直接显示公司全称，或者在另一个元素里
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

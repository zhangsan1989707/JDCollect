# JD Collector - 职位采集助手

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**JD Collector** 是一款基于 Chrome Extension Manifest V3 开发的浏览器插件，旨在帮助求职者或招聘人员半自动地从主流招聘网站（BOSS直聘、猎聘）采集职位信息。支持一键采集、数据预览、CSV 批量导出以及飞书多维表格（Feishu Bitable）自动同步功能。

## ✨ 功能特性

*   **多平台支持**：支持采集 **BOSS直聘** 和 **猎聘** 的职位详情页及部分列表页数据。
*   **智能解析**：自动提取职位名称、薪资范围、公司名称、工作地点、经验要求、学历要求、公司规模、行业领域、发布时间、职位描述等关键信息。
*   **数据管理**：内置 Dashboard（仪表盘），可查看所有已采集的职位列表，支持按需删除。
*   **CSV 导出**：一键将本地采集的所有职位数据导出为 CSV 文件，方便在 Excel 中二次处理。
*   **飞书同步**：支持配置飞书自建应用，将采集的数据实时/批量同步到飞书多维表格，实现云端协作。
*   **自动重连**：内置页面连接保活机制，确保在页面刷新或长连接断开时能自动注入脚本并重试。

## 🛠️ 技术栈

*   **Core**: HTML5, CSS3, JavaScript (ES6+)
*   **Framework**: Chrome Extension Manifest V3
*   **APIs**:
    *   `chrome.scripting`: 动态注入采集脚本
    *   `chrome.storage`: 本地数据持久化存储
    *   `chrome.downloads`: 导出数据文件
    *   `fetch`: 对接飞书 Open API
*   **Target**: Google Chrome, Edge 等 Chromium 内核浏览器

## 🚀 安装步骤

1.  **下载源码**：
    ```bash
    git clone https://github.com/zhangsan1989707/JDCollect.git
    ```
2.  **打开扩展程序管理页**：
    *   在 Chrome 浏览器地址栏输入 `chrome://extensions/` 并回车。
    *   开启右上角的 **"开发者模式" (Developer mode)** 开关。
3.  **加载插件**：
    *   点击左上角的 **"加载已解压的扩展程序" (Load unpacked)** 按钮。
    *   选择本项目源码所在的文件夹（包含 `manifest.json` 的目录）。
4.  **完成**：
    *   JD Collector 图标将出现在浏览器工具栏中。

## 📖 使用说明

### 1. 采集职位
1.  打开 [BOSS直聘](https://www.zhipin.com/) 或 [猎聘](https://www.liepin.com/) 的职位详情页。
2.  点击浏览器工具栏上的插件图标，打开弹窗。
3.  点击 **"采集当前页职位"** 按钮。
4.  插件提示 "采集成功" 后，数据即被保存到本地。

### 2. 查看与导出
1.  在插件弹窗中点击 **"查看已采集数据"**，将打开 Dashboard 页面。
2.  在 Dashboard 中可以浏览所有已保存的职位。
3.  点击 **"导出 CSV"** 按钮，将生成 `.csv` 文件下载到本地。
4.  点击 **"同步到飞书"** 按钮（需先配置），可将选中或所有数据推送到飞书。

### 3. 配置飞书同步
为了使用飞书同步功能，您需要先在飞书开放平台创建一个自建应用。

1.  **创建应用**：登录 [飞书开放平台](https://open.feishu.cn/)，创建企业自建应用。
2.  **获取凭证**：在应用详情页获取 `App ID` 和 `App Secret`。
3.  **开启权限**：在"权限管理"中开启 `bitable:app:read` (查看多维表格) 和 `bitable:record:create` (新增记录) 权限，并发布应用版本。
4.  **准备表格**：
    *   新建一个多维表格，获取 URL 中的 `app_token` (Base ID) 和 `table_id`。
    *   确保表格包含以下**文本类型**字段：`职位名称`, `公司名称`, `薪资范围`, `工作地点`, `经验要求`, `学历要求`, `公司规模`, `行业领域`, `发布时间`, `职位链接`, `是否投递`, `投递结果`, `职位描述`。
    *   **添加协作者**：将您的应用添加为多维表格的协作者。
5.  **插件配置**：
    *   点击插件弹窗下方的 **"⚙️ 飞书同步配置"**。
    *   填入 `App ID`, `App Secret`, `App Token`, `Table ID` 并保存。

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进本项目！

1.  Fork 本仓库
2.  创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3.  提交您的改动 (`git commit -m 'Add some AmazingFeature'`)
4.  推送到分支 (`git push origin feature/AmazingFeature`)
5.  提交 Pull Request

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

## 📮 联系作者

*   **GitHub**: [zhangsan1989707](https://github.com/zhangsan1989707)
*   **Email**: zhangsan1989707@users.noreply.github.com

---
*注：本项目仅供学习交流使用，请勿用于任何商业用途或违反相关网站服务条款的行为。*

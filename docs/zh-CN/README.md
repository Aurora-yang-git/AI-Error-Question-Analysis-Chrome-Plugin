**语言**: [English](../../README.md) | [简体中文](README.md)

---

# Question Analyzer

专为 AP 课程学生打造的 Chrome 浏览器扩展，通过 Chrome 内置的 Gemini Nano AI 自动分析 College Board AP Classroom 上的选择题，识别学生的思维误区（misconception），并提供苏格拉底式的引导提示，帮助学生自主纠正错误。

---

## ✨ 核心功能

### 🎯 智能分析
- **学科识别**：自动识别 13 个 AP 科目，AI 使用对应学科的术语和思维框架
- **Misconception 识别**：基于 College Board 官方解释（A-D 选项），深度分析学生的思维误区
- **苏格拉底式引导**：不直接给答案，而是通过提问引导学生自主思考
- **LaTeX 渲染**：完美显示数学公式和物理符号

### 📚 错题本
- **智能去重**：相同题目自动合并，统计错误次数
- **学科分类**：按 AP 科目筛选错题
- **一键导出**：导出为 JSON/CSV 格式
- **本地存储**：数据保存在浏览器本地，隐私安全

### 🌐 社区功能（可选）
- **反馈系统**：👍 👎 反馈分析质量
- **社区推荐**：查看其他学生认可度高的分析（helpful ratio > 60%）

### ⚡ 自动化
- **自动扫描**：访问题目页面即自动分析（可通过 popup 关闭）
- **结果缓存**：相同题目不重复分析（1 小时有效期）
- **浮动面板**：不干扰网页内容的悬浮分析面板

---

## 🎓 支持的 AP 科目

本扩展支持以下 13 个 AP 科目的自动识别：

| AP Subject ID | 科目名称 | 图标 |
|---------------|---------|------|
| 7 | AP Chemistry | 🧪 |
| 8 | AP Computer Science A | 💻 |
| 11 | AP Microeconomics | 💹 |
| 13 | AP English Literature and Composition | 📖 |
| 26 | AP Calculus BC | ∑ |
| 29 | AP Physics C: Mechanics | 🧲 |
| 30 | AP Psychology | 🧠 |
| 33 | AP Statistics | ∑ |
| 78 | AP Physics C: Electricity and Magnetism | 🧲 |
| 93 | AP Physics 2 | 🧲 |
| 94 | AP Seminar | 📖 |
| 103 | AP Computer Science Principles | 💻 |
| 117 | AP Precalculus | ∑ |

*科目识别基于 AP Classroom URL（如 `apclassroom.collegeboard.org/93/...` 对应 AP Physics 2）*

---

## 📥 安装

### 前置要求
- **Chrome 浏览器版本**：138 或更高
- **启用 Gemini Nano**：
  1. 访问 `chrome://flags`
  2. 搜索 "Prompt API for Gemini Nano"
  3. 设为 "Enabled"
  4. 重启浏览器

### 安装步骤
1. 下载或克隆本仓库
2. 打开 `chrome://extensions/`
3. 右上角启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `dist/` 文件夹
6. 扩展安装完成！

### 可选：Supabase 配置

扩展程序无需任何配置即可完美运行。但如果您想启用云同步功能（推荐分析、用户反馈统计），可以配置 Supabase：

1. 查看 [SETUP_SUPABASE.md](../../SETUP_SUPABASE.md) 获取详细说明
2. 复制 `supabase-config.example.js` 为 `supabase-config.js` 并填入您的凭据
3. 运行 `npm run build` 重新构建扩展

**注意**：即使不配置 Supabase，扩展程序也会以本地模式运行，所有核心功能均可使用。

---

## 🚀 使用指南

### 自动分析模式（推荐）
1. 访问 AP Classroom 题目页面（如 `apclassroom.collegeboard.org/93/...`）
2. 扩展自动检测学科、提取题目、调用 AI 分析
3. 浮动面板显示分析结果：
   - 学科图标（如 🧲 AP Physics 2）
   - Misconception 诊断
   - 反馈按钮（👍 👎）
   - 保存按钮（☆ Save）

### 手动分析模式
1. 点击扩展图标打开 popup
2. 关闭"自动扫描"开关
3. 访问题目页面后，点击"Analyze Current Question"按钮

### 查看错题本
1. 点击扩展图标打开 popup
2. 点击"View Misconceptions"
3. 在新标签页中查看所有保存的错题
4. 可按学科筛选、导出或删除

---

## 🎨 界面预览

### 浮动分析面板
```
┌──────────────────────────────────────┐
│ 🧲 AP Physics 2             − ↻ ×    │
├──────────────────────────────────────┤
│ 💡 Misconception Identified          │
│                                      │
│ If the magnet were removed, the     │
│ paper clip would no longer attract  │
│ others, so the clip is only         │
│ temporarily magnetized rather than  │
│ a permanent magnet.                 │
│                                      │
│ 👍 👎 ☆ Save                         │
└──────────────────────────────────────┘
```

---

## 🔒 隐私与安全

- ✅ **本地 AI**：使用 Chrome 内置的 Gemini Nano，所有分析在设备本地完成
- ✅ **无网络请求**：核心功能不依赖外部服务器
- ✅ **数据本地化**：错题本存储在浏览器本地（`chrome.storage.local`）
- ✅ **匿名反馈**：Supabase 仅存储 URL 哈希（SHA-256），不存原始 URL

---

## 🛠️ 开发

### 构建
```bash
# 安装依赖
npm install

# 构建扩展（输出到 dist/）
npm run build
```

### 调试 AI
1. 打开 `chrome://extensions/`
2. 找到 "Question Analyzer" → 点击"后台页面"
3. 在 Console 中查看 `[AI Prompt]` 折叠日志
4. 验证学科识别、A-D 解释提取是否正确

---

## 📖 文档

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - 系统架构（AI 处理链路详细）
- **[TECHNICAL_DOCS.md](TECHNICAL_DOCS.md)** - 技术文档（提示词工程详细）
- **[CODE_STRUCTURE.md](CODE_STRUCTURE.md)** - 代码结构（AI 相关文件标注）

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

Apache 2.0

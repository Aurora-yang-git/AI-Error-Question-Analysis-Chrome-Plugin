**语言**: [English](../../CODE_STRUCTURE.md) | [简体中文](CODE_STRUCTURE.md)

---

# 代码结构概览

## 完整项目文件树

```
Question Analyzer/
├── 📁 核心扩展文件
│   ├── manifest.json              # 扩展配置（权限、版本、background）
│   ├── background.js              # ⭐ 后台服务（学科识别、Offscreen 管理）
│   ├── package.json               # 依赖库版本
│   └── supabase-config.js         # Supabase 配置（URL、匿名密钥）
│
├── 📁 内容脚本（注入网页）
│   ├── content/
│   │   ├── analyzer-ui.js         # 浮动面板 UI（解析、渲染、交互）
│   │   └── analyzer-ui.css        # 面板样式
│   └── scripts/
│       └── extract-content.js     # ⭐ 内容提取（Defuddle、答案检测、A-D 解释）
│
├── 📁 AI 处理核心
│   └── offscreen/
│       ├── offscreen.html         # Offscreen Document HTML（空壳）
│       └── offscreen.js           # ⭐⭐⭐ AI 引擎（LanguageModel API、提示词注入）
│
├── 📁 弹窗控制
│   └── popup/
│       ├── popup.html             # 弹窗 UI
│       ├── popup.js               # 自动扫描开关、手动分析
│       └── popup.css              # 弹窗样式
│
├── 📁 错题本页面
│   └── misconceptions/
│       ├── misconceptions.html    # 错题本 HTML
│       ├── misconceptions.js      # 去重展示、导出、删除
│       └── misconceptions.css     # 错题本样式
│
├── 📁 共享工具库
│   └── utils/
│       ├── markdown-renderer.js   # ⭐ Markdown + LaTeX 渲染（Marked + KaTeX）
│       ├── hash.js                # FNV-1a 哈希、fingerprint 生成
│       └── supabase-service.js    # 云端服务（反馈、推荐）
│
├── 📁 资源文件
│   └── images/                    # 扩展图标（16/32/48/128px）
│
├── 📁 构建配置
│   ├── rollup.config.mjs          # Rollup 打包配置
│   └── dist/                      # 构建输出目录（加载到 Chrome）
│
└── 📁 文档
    ├── README.md                  # 用户指南（英文）
    ├── ARCHITECTURE.md            # 系统架构（英文，AI 详细）
    ├── TECHNICAL_DOCS.md          # 技术文档（英文，提示词工程详细）
    ├── CODE_STRUCTURE.md          # 代码结构（英文，AI 文件标注）
    └── docs/zh-CN/                # 中文文档目录
```

---

## ⭐ AI 相关文件（重点标注）

### offscreen/offscreen.js（AI 核心引擎）
**最重要的文件**，负责所有 AI 推理逻辑：
- LanguageModel API 集成
- Session 单例管理（create + 错误恢复）
- **提示词动态注入**：
  - `${subject}` - 学科名称
  - `${expA/B/C/D}` - College Board A-D 解释
  - `${userAnswer}`, `${correctAnswer}` - 学生/正确答案
- 完整提示词模板（THINKING + IMPORTANT + HINT）
- Debug 模式日志输出

**关键代码**：
```javascript
async function analyzeQuestion(content, context) {
  const { subject, rationales, userAnswer, correctAnswer } = context;
  
  // 提取 A-D 解释
  const expA = rationales?.[0]?.rationale || 'None';
  const expB = rationales?.[1]?.rationale || 'None';
  const expC = rationales?.[2]?.rationale || 'None';
  const expD = rationales?.[3]?.rationale || 'None';
  
  // 构建提示词
  const prompt = `You are an expert AI tutor in ${subject}...`;
  
  // 推理
  const result = await session.prompt(prompt);
  return { success: true, result };
}
```

---

### background.js（学科识别 + Offscreen 管理）
**第二重要的文件**，协调整个分析流程：
- **学科识别函数**：`detectSubjectFromUrl(url)` - 13 个 AP 科目映射
- **Offscreen 生命周期**：`ensureOffscreenDocument()` - 单例创建、健康检查
- 分析触发、缓存管理、消息路由

**关键代码**：
```javascript
function detectSubjectFromUrl(url) {
  const match = url && url.match(/apclassroom\.collegeboard\.org\/(\d+)/);
  const id = match ? match[1] : null;
  const map = {
    '7': 'AP Chemistry',
    '93': 'AP Physics 2',
    // ... 共 13 个科目
  };
  return id && map[id] ? map[id] : 'Unknown';
}
```

---

### scripts/extract-content.js（A-D 解释提取）
**第三重要的文件**，为 AI 提供原材料：
- **答案检测**：`detectUserAnswer(document)` - 学生选择、正确答案
- **A-D 官方解释**：`extractRationales(document)` - DOM 查找、按索引映射
- **可见题目优先**：`findVisibleQuestionRoot(document)` - 多题页面处理
- Defuddle 内容提取、Turndown HTML → Markdown、LaTeX 保留

---

## 其他文件职责（简述）

### 核心扩展文件
- **`manifest.json`**: Manifest V3 配置
- **`package.json`**: npm 依赖管理
- **`supabase-config.js`**: Supabase 配置

### 内容脚本（UI）
- **`content/analyzer-ui.js`**: 浮动面板、解析 AI 输出、反馈/保存
- **`content/analyzer-ui.css`**: 面板样式

### 弹窗与错题本
- **`popup/popup.js`**: 自动扫描开关、手动分析按钮
- **`misconceptions/misconceptions.js`**: 去重展示、导出、删除

### 共享工具库
- **`utils/markdown-renderer.js`**: Markdown + LaTeX 渲染
- **`utils/hash.js`**: FNV-1a 哈希、fingerprint 生成
- **`utils/supabase-service.js`**: 云端反馈、社区推荐

---

## 依赖库

| 库 | 版本 | 用途 | AI 相关 |
|----|------|------|---------|
| defuddle | 0.6.6 | 网页内容智能提取 | ✅ 为 AI 提供题目内容 |
| turndown | 7.2.0 | HTML → Markdown | ✅ 转换为 AI 可读格式 |
| marked | 14.1.2 | Markdown → HTML | 渲染 AI 输出 |
| katex | 0.16.9 | LaTeX 渲染 | 渲染数学公式 |
| dompurify | 3.2.4 | XSS 防护 | - |
| @supabase/supabase-js | 2.39.3 | 云端服务 | - |

---

## 构建流程

### Rollup 打包配置
- 静态资源复制（manifest、images、CSS）
- JS 文件打包（ES Modules → IIFE）
- 输出到 `dist/` 目录

### 构建命令
```bash
npm run build
```

### 输入 → 输出映射
| 源文件 | 输出文件 | AI 相关 |
|--------|---------|---------|
| `background.js` | `dist/background.js` | ✅ 学科识别 |
| `offscreen/offscreen.js` | `dist/offscreen/offscreen.js` | ⭐⭐⭐ AI 核心 |
| `scripts/extract-content.js` | `dist/scripts/extract-content.js` | ✅ A-D 提取 |
| `content/analyzer-ui.js` | `dist/content/analyzer-ui.js` | 渲染 AI 输出 |

---

## 快速参考：AI 链路追踪

想了解 AI 如何工作？按此顺序阅读代码：

1. **`background.js:604-630`** → `detectSubjectFromUrl()` 学科识别
2. **`background.js:380-558`** → `triggerAnalysis()` 触发分析
3. **`scripts/extract-content.js:434-524`** → `extractRationales()` 提取 A-D 解释
4. **`offscreen/offscreen.js:30-111`** → `analyzeQuestion()` AI 推理核心
5. **`content/analyzer-ui.js:243-276`** → `parseAnalysis()` 解析输出
6. **`content/analyzer-ui.js:193-241`** → `showAnalysis()` 渲染结果

---

*完整代码结构请参考英文版 [CODE_STRUCTURE.md](../../CODE_STRUCTURE.md)*


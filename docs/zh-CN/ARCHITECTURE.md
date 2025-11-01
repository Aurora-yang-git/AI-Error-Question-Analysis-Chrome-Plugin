**语言**: [English](../../ARCHITECTURE.md) | [简体中文](ARCHITECTURE.md)

---

# Question Analyzer - 系统架构

## 系统概览

```
┌────────────────────────────────────────────────────────────────────────┐
│                           Chrome 浏览器                                │
├────────────────────────────────────────────────────────────────────────┤
│  AP Classroom 网页          │  Chrome 扩展                             │
│  ┌──────────────────────┐   │  ┌──────────────────────────────────────┐ │
│  │ • College Board 题目 │   │  │ Background Script (Service Worker)  │ │
│  │ • LaTeX 数学公式     │   │  │ ┌──────────────────────────────────┐ │ │
│  │ • 四选项选择题       │   │  │ │ • Tab 事件监听                   │ │ │
│  │ • A-D 官方解释       │   │  │ │ • 学科识别 (URL → Subject)       │ │ │
│  └──────────────────────┘   │  │ │ • 内容提取协调                   │ │ │
│                              │  │ │ • Offscreen 生命周期管理         │ │ │
│  ┌──────────────────────┐   │  │ │ • 缓存管理 (1h TTL)              │ │ │
│  │ 浮动分析面板 (注入)  │   │  │ │ • 消息路由中枢                   │ │ │
│  │ ┌──────────────────┐ │   │  │ └──────────────────────────────────┘ │ │
│  │ │ 🧲 AP Physics 2 │ │   │  │                                      │ │
│  │ │ 💡 Misconception │ │   │  │ ┌──────────────────────────────────┐ │ │
│  │ │ 👍 👎 ☆ Save     │ │   │  │ │ Content Script (analyzer-ui.js)  │ │ │
│  │ │ LaTeX 渲染支持   │ │   │  │ │ ┌──────────────────────────────┐ │ │ │
│  │ └──────────────────┘ │   │  │ │ │ • 浮动面板管理               │ │ │ │
│  └──────────────────────┘   │  │ │ │ • Markdown + LaTeX 渲染     │ │ │ │
│                              │  │ │ │ • 反馈按钮处理               │ │ │ │
│                              │  │ │ │ • 错题保存逻辑               │ │ │ │
│                              │  │ │ └──────────────────────────────┘ │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  │                                      │ │
│                              │  │ ┌──────────────────────────────────┐ │ │
│                              │  │ │ ⭐ Offscreen Document (AI 核心)  │ │ │
│                              │  │ │ ┌──────────────────────────────┐ │ │ │
│                              │  │ │ │ • LanguageModel API         │ │ │ │
│                              │  │ │ │ • Session 单例管理          │ │ │ │
│                              │  │ │ │ • 提示词注入 (${subject})   │ │ │ │
│                              │  │ │ │ • Gemini Nano 推理          │ │ │ │
│                              │  │ │ │ • 错误恢复 (session reset)  │ │ │ │
│                              │  │ │ └──────────────────────────────┘ │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  │                                      │ │
│                              │  │ ┌──────────────────────────────────┐ │ │
│                              │  │ │ Popup (弹窗控制)                 │ │ │
│                              │  │ │ • 自动扫描开关                   │ │ │
│                              │  │ │ • 手动分析触发                   │ │ │
│                              │  │ │ • 错题本入口                     │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  │                                      │ │
│                              │  │ ┌──────────────────────────────────┐ │ │
│                              │  │ │ Misconceptions Page (错题本)     │ │ │
│                              │  │ │ • 去重展示 (fingerprint)         │ │ │
│                              │  │ │ • 学科过滤                       │ │ │
│                              │  │ │ • 导出功能                       │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  │                                      │ │
│                              │  │ ┌──────────────────────────────────┐ │ │
│                              │  │ │ Supabase Cloud (可选)            │ │ │
│                              │  │ │ • 社区推荐分析                   │ │ │
│                              │  │ │ • 反馈统计                       │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  └──────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

## 🎯 AI 处理核心架构（详细）

### Offscreen Document AI 引擎

#### 架构设计原理
```
┌─────────────────────────────────────────────────────┐
│  Background.js (Service Worker)                     │
│  - 无 DOM 环境，无法直接使用 LanguageModel API      │
│  - 负责协调和消息传递                               │
└────────────┬────────────────────────────────────────┘
             │ chrome.runtime.sendMessage()
             ↓
┌─────────────────────────────────────────────────────┐
│  Offscreen Document (offscreen.html + .js)          │
│  - 提供 DOM 上下文                                  │
│  - 托管 LanguageModel API                           │
│  - 单例 Session 管理                                │
└────────────┬────────────────────────────────────────┘
             │ LanguageModel.create() / session.prompt()
             ↓
┌─────────────────────────────────────────────────────┐
│  Gemini Nano (Chrome 内置 AI)                       │
│  - 本地推理，无网络请求                             │
│  - 接收提示词，返回文本                             │
└─────────────────────────────────────────────────────┘
```

#### 完整消息流程
```javascript
// 1. Background 触发分析
async function triggerAnalysis(tabId, content, url, context) {
  const subject = detectSubjectFromUrl(url); // ← 学科识别
  
  await ensureOffscreenDocument(); // ← 确保 offscreen 存在
  
  // 2. 发送分析请求
  const response = await chrome.runtime.sendMessage({
    action: 'analyzeQuestion',
    content: content,
    userAnswer: context.userAnswer,
    correctAnswer: context.correctAnswer,
    rationales: context.rationales,  // ← A-D 官方解释
    subject: subject,                // ← 注入学科
    url: url,
    debug: true
  });
  
  // 3. 处理返回结果
  if (response.success) {
    await chrome.tabs.sendMessage(tabId, {
      action: 'showAnalysis',
      result: response.result,
      subject: subject
    });
  }
}

// Offscreen 处理
async function analyzeQuestion(content, context) {
  const { subject, rationales, userAnswer, correctAnswer } = context;
  
  // 提取 A-D 解释
  const expA = rationales?.[0]?.rationale || 'None';
  const expB = rationales?.[1]?.rationale || 'None';
  const expC = rationales?.[2]?.rationale || 'None';
  const expD = rationales?.[3]?.rationale || 'None';
  
  // 构建提示词（含学科和A-D解释）
  const prompt = `You are an expert AI tutor analyzing a student's answer 
to identify and clarify misconceptions in the subject of ${subject}.

Question content: ${content}
Correct Answer: ${correctAnswer}
Student Answer: ${userAnswer}

College Board Explanation (for reference only):
A: ${expA}
B: ${expB}
C: ${expC}
D: ${expD}

THINKING: ...
IMPORTANT: ...
HINT: ...`;
  
  // AI 推理
  const result = await session.prompt(prompt);
  return { success: true, result };
}
```

#### Session 生命周期管理
```javascript
let session = null; // 全局单例

// 创建 Session
if (!session) {
  session = await LanguageModel.create({
    temperature: 0.7,   // 创造性 vs 一致性
    topK: 3,            // 候选词限制
    outputLanguage: 'en'
  });
}

// 错误恢复
catch (error) {
  if (session) {
    session.destroy();  // 销毁损坏的 session
    session = null;     // 下次重新创建
  }
  throw error;
}
```

**关键设计点**：
- ✅ **延迟创建**：首次分析时才创建，节省资源
- ✅ **Session 复用**：多次分析共享 session，提升性能
- ✅ **自动恢复**：错误时销毁，下次自动重建
- ✅ **单例模式**：整个扩展生命周期仅一个 session

---

### 提示词动态注入流程

#### 学科识别 → 提示词注入
```
1. 用户访问 AP Classroom 题目
   URL: https://apclassroom.collegeboard.org/93/assessments/...
              ↓
2. Background 监听 tab.onUpdated
   detectSubjectFromUrl(url) 
   → 正则匹配: /apclassroom\.collegeboard\.org\/(\d+)/
   → 提取 ID: 93
              ↓
3. 查询映射表
   { '93': 'AP Physics 2', '26': 'AP Calculus BC', ... }
   → subject = 'AP Physics 2'
              ↓
4. 发送到 Offscreen
   { action: 'analyzeQuestion', subject: 'AP Physics 2', ... }
              ↓
5. 模板字符串替换
   `You are an expert AI tutor in ${subject}` 
   → "You are an expert AI tutor in AP Physics 2"
              ↓
6. Gemini Nano 接收完整提示词
   → 使用物理学术语和思维框架进行分析
```

#### A-D 官方解释提取流程
```
1. Content Extraction Script 执行
   scripts/extract-content.js
              ↓
2. 查找 DOM 结构
   visibleRoot.querySelectorAll('.LearnosityDistractor')
              ↓
3. 提取每个选项的解释
   Option A: distractor[0].querySelector('.content').textContent
   Option B: distractor[1].querySelector('.content').textContent
   ...
              ↓
4. 构建 rationales 数组
   [
     { answer: 'A', rationale: '...' },
     { answer: 'B', rationale: '...' },
     { answer: 'C', rationale: '...' },
     { answer: 'D', rationale: '...' }
   ]
              ↓
5. 传递到 Offscreen
   { rationales: [...] }
              ↓
6. 映射到 A-D 变量
   expA = rationales[0].rationale
   expB = rationales[1].rationale
   ...
              ↓
7. 注入提示词
   College Board Explanation:
   A: ${expA}
   B: ${expB}
   C: ${expC}
   D: ${expD}
```

---

### 结构化输出处理链路

#### AI 输出 → 前端渲染
```
1. Gemini Nano 返回文本
   "**Misconception**: If the magnet were removed, the paper clip 
    would no longer attract others, so the clip is only temporarily 
    magnetized rather than a permanent magnet."
              ↓
2. Offscreen 返回给 Background
   { success: true, result: "**Misconception**: ..." }
              ↓
3. Background 缓存 + 发送给 Content Script
   chrome.storage.local.set({ [`analysis_${url}`]: { content: result } })
   chrome.tabs.sendMessage(tabId, { action: 'showAnalysis', result })
              ↓
4. Content Script 解析 Markdown
   parseAnalysis(markdown)
   → 正则提取: /\*\*Misconception\*\*:\s*([^\n]+)/
   → misconception = "If the magnet were removed..."
              ↓
5. 构建 HTML
   <div class="qa-misconception-box">
     <div class="qa-misconception-label">💡 Misconception Identified</div>
     <div class="qa-misconception-text">${misconception}</div>
   </div>
              ↓
6. 渲染 LaTeX
   renderLatexInElement(resultDiv)
   → KaTeX 渲染所有 $...$ 和 $$...$$ 公式
              ↓
7. 用户看到高亮的 Misconception 卡片
```

---

## 其他组件架构（简述）

### 1. Background Script (`background.js`)
**核心职责**：
- Tab 事件监听（onActivated, onUpdated）
- **学科识别**：`detectSubjectFromUrl(url)` → 13 个 AP 科目映射
- 内容提取协调：注入 `extract-content.js`
- **Offscreen 生命周期管理**：`ensureOffscreenDocument()`
- 缓存管理：1 小时 TTL
- 消息路由：Background ↔ Offscreen ↔ Content Script

### 2. Content Script (`content/analyzer-ui.js`)
**核心职责**：
- 浮动面板管理（初始化、显示、隐藏）
- Markdown + LaTeX 渲染
- 解析 AI 输出（提取 `**Misconception**`）
- 反馈按钮：👍 👎 → 发送到 Supabase
- 保存错题：☆ Save → 本地 storage

### 3. Content Extraction (`scripts/extract-content.js`)
**核心职责**：
- **Defuddle** 智能提取网页主体内容
- **Turndown** HTML → Markdown 转换
- **LaTeX 保留**：识别 `<img alt="...">` 和 `.math` 元素
- **答案检测**：`aria-selected="true"` / `.--chosen`
- **A-D 解释提取**：`.LearnosityDistractor .content`
- **可见题目优先**：`offsetParent !== null`

### 4. 其他组件
- **Popup**：自动扫描开关、手动分析触发、错题本入口
- **Misconceptions Page**：去重展示、学科过滤、导出功能
- **Shared Utilities**：Markdown 渲染、哈希算法、云端服务

---

## 完整数据流（含 AI 推理细节）

```
1. 用户访问 AP Classroom 题目页面
   → detectSubjectFromUrl(url) → subject = 'AP Physics 2'
              ↓
2. 注入 Content Extraction Script
   → 提取内容、答案、A-D 解释
              ↓
3. Background 检查缓存
   → 缓存命中：直接显示 | 缓存未命中：触发新分析
              ↓
4. 确保 Offscreen Document 存在
   → 单例创建，延迟初始化
              ↓
5. 发送分析请求到 Offscreen
   → subject、rationales、userAnswer、correctAnswer
              ↓
6. Offscreen 创建/复用 LanguageModel Session
   → temperature: 0.7, topK: 3
              ↓
7. 构建完整提示词
   → 动态注入 ${subject}、${expA/B/C/D}
   → THINKING + IMPORTANT + HINT 三段式
              ↓
8. Gemini Nano 本地推理
   → 返回 "**Misconception**: ..."
              ↓
9. Background 缓存结果（1 小时 TTL）
              ↓
10. 发送到 Content Script
   → 解析 Markdown、构建 HTML、渲染 LaTeX
              ↓
11. 用户看到分析结果
   → 学科图标、Misconception 卡片、反馈/保存按钮
```

---

## 存储架构

### chrome.storage.local（持久化）
- **AI 分析缓存**：1 小时 TTL
- **错题本**：去重存储（fingerprint + analysisHash）
- **用户设置**：autoScanEnabled

### chrome.storage.session（临时）
- 页面内容、URL、标题
- 用户答案、正确答案、rationales
- 学科信息

---

## 消息流

### Background ↔ Offscreen（AI 推理链路）
- Background → Offscreen：发送分析请求（subject、rationales、answers）
- Offscreen → Background：返回分析结果（result、debug info）

### Background ↔ Content Script
- Background → Content：显示加载/分析/错误状态
- Content → Background：内容脚本就绪、重新分析、保存错题、提交反馈

---

## 安全与隐私

- ✅ **本地 AI**：Gemini Nano 离线推理，无网络请求
- ✅ **URL 哈希**：Supabase 仅存储 SHA-256(url)
- ✅ **匿名用户**：随机生成 user_id
- ✅ **DOMPurify**：过滤所有 HTML，防止 XSS
- ✅ **Session 错误恢复**：自动销毁并重建

---

## 性能优化

- **缓存策略**：1 小时 TTL，Session 复用
- **内存管理**：Offscreen 单例，Tab 清理
- **渲染优化**：LaTeX 批量渲染，Markdown 预处理

---

*完整技术细节请参考英文版 [ARCHITECTURE.md](../../ARCHITECTURE.md)*


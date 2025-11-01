**语言**: [English](../../TECHNICAL_DOCS.md) | [简体中文](TECHNICAL_DOCS.md)

---

# 技术文档

## 系统概述

Question Analyzer 是一个 Chrome 浏览器扩展，专为 AP 课程学生设计。它能自动分析 College Board AP Classroom 上的选择题，通过 Chrome 内置的 Gemini Nano AI 模型识别学生的思维误区（misconception），并提供苏格拉底式的引导提示，帮助学生自主纠正错误。

**核心价值**：
- ✅ 本地 AI 处理，隐私安全
- ✅ 针对 13 个 AP 科目定制化分析
- ✅ 基于 College Board 官方解释的深度推理
- ✅ 引导式教学，而非直接给答案

---

## 🎯 AI 分析核心技术（详细）

### 1. Offscreen Document 架构

#### 为什么需要 Offscreen Document？
Chrome 的 `LanguageModel` API 需要 DOM 上下文才能运行，但 Service Worker（background.js）没有 DOM。因此必须创建一个隐藏的 offscreen document 来承载 AI 模型。

#### 生命周期管理
```javascript
// background.js
async function ensureOffscreenDocument() {
  // 检查是否已存在
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (existingContexts.length > 0) {
    return; // 已存在，直接复用
  }
  
  // 创建新的 offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['DOM_SCRAPING'],
    justification: 'Need DOM context for LanguageModel API'
  });
  
  // 等待初始化完成
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 验证就绪状态
  const pingResponse = await chrome.runtime.sendMessage({ action: 'ping' });
  console.log('Offscreen ready:', pingResponse.ready);
}
```

**关键点**：
- 单例模式：整个扩展生命周期内只创建一次
- 延迟初始化：首次需要 AI 分析时才创建
- 健康检查：通过 ping/pong 机制验证就绪

---

### 2. LanguageModel API 集成

#### Session 创建与配置
```javascript
// offscreen/offscreen.js
let session = null; // 全局单例 session

async function analyzeQuestion(content, context) {
  // 检查 API 可用性
  if (!('LanguageModel' in self)) {
    throw new Error('LanguageModel API not available. Enable Gemini Nano in chrome://flags');
  }

  // 创建或复用 session
  if (!session) {
    const params = {
      temperature: 0.7,    // 控制输出随机性（0.0-1.0）
      topK: 3,             // 采样时考虑前 K 个候选词
      outputLanguage: 'en' // 输出语言
    };
    session = await LanguageModel.create(params);
  }
  
  // 使用 session 进行推理
  const result = await session.prompt(prompt);
  return result;
}
```

**参数详解**：
- `temperature: 0.7` - 平衡创造性与一致性（教育场景推荐 0.6-0.8）
- `topK: 3` - 限制候选词数量，提高输出质量
- `outputLanguage: 'en'` - 强制英文输出（与 AP 考试语言一致）

#### Session 生命周期管理
- **创建时机**：首次调用 `analyzeQuestion` 时
- **复用策略**：多次分析共享同一 session，提升性能
- **销毁时机**：发生错误时销毁并置空，下次重新创建
- **错误恢复**：
```javascript
catch (error) {
  if (session) {
    session.destroy();
    session = null; // 确保下次重新创建
  }
  throw error;
}
```

---

### 3. 提示词工程（Prompt Engineering）

#### 完整提示词模板
```javascript
const prompt = `You are an expert AI tutor analyzing a student's answer to identify and clarify misconceptions in the subject of ${subject}.

Question content:
${content}

Correct Answer: ${correctAnswer}
Student Answer: ${studentAnswer}

College Board Explanation (for reference only):
A: ${expA}
B: ${expB}
C: ${expC}
D: ${expD}

THINKING:
1. Determine which concept or law the question is testing.
2. Analyze how each choice reflects a different misconception or partial understanding.
3. Compare the student's answer to the correct one and identify what reasoning gap leads to the mismatch.
4. Focus on conceptual or causal reasoning (not memorization or formula recall).
5. Consider what physical evidence, logical condition, or observable outcome could distinguish the correct reasoning from the mistaken one.

IMPORTANT:
1. Always identify the student's selected answer (highlighted or checked).
2. The student's answer may be correct or incorrect.
3. If the content is not a question, respond with:
   > This is not a question.
4. If the student's answer is correct, respond with:
   > Nice work! No misconception to review.
5. Base your analysis on conceptual reasoning, not test-taking strategy.
6. Use contrastive phrasing to clarify "why not" for the wrong option (e.g., "If __ were true, then __ would not happen.").
7. Keep the explanation concise, diagnostic, and student-facing.

HINT:
1. Use information from the THINKING or IMPORTANT sections to guide the student toward re-evaluating their reasoning.
2. Avoid giving away the correct answer — focus on prompting deeper thought.
3. Examples:
   - "Try applying the principle from THINKING #1 — which law best explains this outcome?"
   - "Look again at IMPORTANT #6 — what evidence would prove or disprove that assumption?"
   - "If you tested this in a lab, what observation (from THINKING #5) would tell you which answer is right?"
   - "Which variable or condition in the scenario actually changes the result?"

If the student is incorrect, output your analysis in EXACTLY this format (no extra commentary):
**Misconception**: [ONE clear, specific sentence explaining what the student falsely believes AND how to correctly tell or test the difference — focus on conceptual understanding, not procedural error.]
`;
```

#### 提示词结构解析

**1. 角色定位**
- 明确 AI 的角色是"导师"而非"答题机器"
- `${subject}` 动态注入科目名称（如 AP Physics 2），让 AI 使用该学科的术语和思维框架

**2. 输入字段**
| 字段 | 来源 | 用途 |
|------|------|------|
| `${content}` | Defuddle 提取的题目 Markdown | 完整题目内容（含 LaTeX） |
| `${correctAnswer}` | DOM 解析（`.icon.--correct`） | 正确答案字母 |
| `${studentAnswer}` | DOM 解析（`aria-selected="true"`） | 学生选择的答案 |
| `${expA/B/C/D}` | 从 `.LearnosityDistractor` 提取 | College Board 官方对每个选项的解释 |
| `${subject}` | URL 解析（`/(\d+)/` → 映射表） | AP 科目名称 |

**3. THINKING 框架**
引导 AI 进行五步推理：
1. 识别考点（概念/定律）
2. 分析每个选项反映的错误理解
3. 对比学生答案与正确答案的差异
4. 聚焦概念理解而非公式记忆
5. 寻找可观察/可测试的区分点

**4. IMPORTANT 规则**
7 条硬性约束：
- 前置检查：非题目 → "This is not a question."
- 答案正确 → "Nice work! No misconception to review."
- 输出格式：仅输出 `**Misconception**: ...` 一行
- 语言风格：对比式表述（"If X, then Y would NOT happen"）
- 禁止：不能暴露正确答案字母

**5. HINT 策略**
苏格拉底式引导：
- 引用 THINKING/IMPORTANT 的编号
- 提出反思性问题而非答案
- 示例："如果你在实验室测试，会观察到什么？"

---

### 4. 学科变量注入机制

**URL → Subject ID 映射**
```javascript
function detectSubjectFromUrl(url) {
  const match = url && url.match(/apclassroom\.collegeboard\.org\/(\d+)/);
  const id = match ? match[1] : null;
  
  const map = {
    '7': 'AP Chemistry',
    '8': 'AP Computer Science A',
    '11': 'AP Microeconomics',
    '13': 'AP English Literature and Composition',
    '26': 'AP Calculus BC',
    '29': 'AP Physics C: Mechanics',
    '30': 'AP Psychology',
    '33': 'AP Statistics',
    '78': 'AP Physics C: Electricity and Magnetism',
    '93': 'AP Physics 2',
    '94': 'AP Seminar',
    '103': 'AP Computer Science Principles',
    '117': 'AP Precalculus'
  };
  
  return id && map[id] ? map[id] : 'Unknown';
}
```

**注入时机**：
1. Background 检测 URL → `detectSubjectFromUrl(tab.url)`
2. 存入 session storage
3. 发送到 offscreen
4. 插入提示词 → 模板字符串替换 `${subject}`

---

### 5. College Board A-D 解释提取

**DOM 结构识别** → **映射到变量** → **注入提示词**

```javascript
// 提取流程
function extractRationales(document) {
  const visibleRoot = findVisibleQuestionRoot(document);
  const allOptions = visibleRoot.querySelectorAll('.mcq-option');
  
  allOptions.forEach((option, index) => {
    const distractor = option.closest('.LearnosityDistractor');
    const contentEl = distractor?.querySelector('.content');
    if (contentEl) {
      const letter = ['A', 'B', 'C', 'D', 'E'][index];
      rationales.push({ answer: letter, rationale: contentEl.textContent.trim() });
    }
  });
}

// 映射到 A-D 变量
const expA = rationales?.[0]?.rationale || 'None';
const expB = rationales?.[1]?.rationale || 'None';
const expC = rationales?.[2]?.rationale || 'None';
const expD = rationales?.[3]?.rationale || 'None';
```

---

### 6. 结构化输出解析

AI 返回三种可能的输出：

1. **非题目**：`This is not a question.`
2. **答案正确**：`Nice work! No misconception to review.`
3. **答案错误**：`**Misconception**: [诊断性语句]`

前端解析：
- 正则提取：`/\*\*Misconception\*\*:\s*([^\n]+)/`
- 高亮渲染 Misconception 卡片
- LaTeX 公式渲染

---

### 7. Debug 模式

启用后在 Console 输出：
- 完整提示词文本
- Subject、userAnswer、correctAnswer
- A-D 官方解释（expA/B/C/D）
- AI 返回结果

**用途**：
- 验证学科检测是否正确
- 检查 A-D 解释是否完整提取
- 复现 AI 推理过程
- 调试提示词效果

---

## 其他核心功能（简述）

### 学科检测系统
- 正则匹配 URL 中的数字 ID
- 13 个 AP 科目映射表
- 默认值：'Unknown'

### 云端反馈系统
- Supabase (PostgreSQL)
- 提交 helpful/not helpful 反馈
- 社区推荐分析（helpful ratio > 60%）
- URL SHA-256 哈希（隐私保护）

### 错题本去重算法
```javascript
function buildFingerprint({ url, title, subject, studentAnswer, correctAnswer }) {
  const base = `${url}|${title}|${subject}|${studentAnswer}|${correctAnswer}`;
  return hashString(base); // FNV-1a hash
}
```
- 优先 fingerprint，回退到 analysisHash
- 相同 fingerprint 的错题累加 count

### LaTeX 渲染管线
1. **提取**：Turndown 识别 `<img alt="LaTeX">` 和 `.math` 元素
2. **转换**：`$LaTeX$` 或 `$$LaTeX$$` 包裹
3. **渲染**：KaTeX.renderToString() → HTML
4. **安全**：DOMPurify.sanitize() 过滤 XSS

---

## 依赖库

| 库 | 版本 | 用途 |
|----|------|------|
| defuddle | 0.6.6 | 网页内容智能提取 |
| turndown | 7.2.0 | HTML → Markdown |
| marked | 14.1.2 | Markdown → HTML |
| katex | 0.16.9 | LaTeX 渲染 |
| dompurify | 3.2.4 | XSS 防护 |
| @supabase/supabase-js | 2.39.3 | 云端服务 |

---

## Chrome 版本要求

- **最低版本**：Chrome 138+
- **必需功能**：
  - Manifest V3
  - Offscreen Documents API
  - LanguageModel API (Gemini Nano)
- **启用方式**：
  1. 访问 `chrome://flags`
  2. 搜索 "Prompt API for Gemini Nano"
  3. 设为 "Enabled"
  4. 重启浏览器

---

## 构建与部署

```bash
# 安装依赖
npm install

# 构建到 dist/
npm run build

# 加载扩展
# 1. 打开 chrome://extensions/
# 2. 启用"开发者模式"
# 3. 点击"加载已解压的扩展程序"
# 4. 选择 dist/ 文件夹
```

---

*完整技术细节请参考英文版 [TECHNICAL_DOCS.md](../../TECHNICAL_DOCS.md)*


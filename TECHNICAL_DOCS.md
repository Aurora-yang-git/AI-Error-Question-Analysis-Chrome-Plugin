**Languages**: [English](TECHNICAL_DOCS.md) | [简体中文](docs/zh-CN/TECHNICAL_DOCS.md)

---

# Technical Documentation

## System Overview

Question Analyzer is a Chrome extension designed for AP course students. It automatically analyzes multiple-choice questions on College Board AP Classroom, using Chrome's built-in Gemini Nano AI model to identify student misconceptions and provide Socratic guidance to help students self-correct.

**Core Value**:
- ✅ Local AI processing, privacy-safe
- ✅ Customized analysis for 13 AP subjects
- ✅ Deep reasoning based on College Board official explanations
- ✅ Guided teaching, not direct answers

---

## 🎯 AI Analysis Core Technology (Detailed)

### 1. Offscreen Document Architecture

#### Why Offscreen Document is Needed?
Chrome's `LanguageModel` API requires a DOM context to run, but Service Workers (background.js) don't have DOM. Therefore, a hidden offscreen document must be created to host the AI model.

#### Lifecycle Management
```javascript
// background.js
async function ensureOffscreenDocument() {
  // Check if already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (existingContexts.length > 0) {
    return; // Already exists, reuse directly
  }
  
  // Create new offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['DOM_SCRAPING'],
    justification: 'Need DOM context for LanguageModel API'
  });
  
  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verify ready state
  const pingResponse = await chrome.runtime.sendMessage({ action: 'ping' });
  console.log('Offscreen ready:', pingResponse.ready);
}
```

**Key Points**:
- Singleton pattern: Created only once per extension lifecycle
- Lazy initialization: Created only when AI analysis is first needed
- Health check: Verified ready state via ping/pong mechanism

---

### 2. LanguageModel API Integration

#### Session Creation and Configuration
```javascript
// offscreen/offscreen.js
let session = null; // Global singleton session

async function analyzeQuestion(content, context) {
  // Check API availability
  if (!('LanguageModel' in self)) {
    throw new Error('LanguageModel API not available. Enable Gemini Nano in chrome://flags');
  }

  // Create or reuse session
  if (!session) {
    const params = {
      temperature: 0.7,    // Control output randomness (0.0-1.0)
      topK: 3,             // Consider top K candidate words when sampling
      outputLanguage: 'en' // Output language
    };
    session = await LanguageModel.create(params);
  }
  
  // Use session for inference
  const result = await session.prompt(prompt);
  return result;
}
```

**Parameter Details**:
- `temperature: 0.7` - Balances creativity vs consistency (0.6-0.8 recommended for educational scenarios)
- `topK: 3` - Limits candidate words count, improves output quality
- `outputLanguage: 'en'` - Force English output (consistent with AP exam language)

#### Session Lifecycle Management
- **Creation Timing**: On first `analyzeQuestion` call
- **Reuse Strategy**: Multiple analyses share the same session, improves performance
- **Destruction Timing**: Destroyed and nullified on error, recreated next time
- **Error Recovery**:
```javascript
catch (error) {
  if (session) {
    session.destroy();
    session = null; // Ensure recreation next time
  }
  throw error;
}
```

---

### 3. Prompt Engineering

#### Complete Prompt Template
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

#### Prompt Structure Breakdown

**1. Role Positioning**
```
You are an expert AI tutor analyzing a student's answer to identify and clarify misconceptions in the subject of ${subject}.
```
- Clearly defines AI's role as "tutor" not "answer machine"
- `${subject}` dynamically injects subject name (e.g., AP Physics 2), enabling AI to use subject-specific terminology and frameworks

**2. Input Fields**
| Field | Source | Purpose |
|-------|--------|---------|
| `${content}` | Markdown extracted by Defuddle | Complete question content (with LaTeX) |
| `${correctAnswer}` | DOM parsing (`.icon.--correct`) | Correct answer letter |
| `${studentAnswer}` | DOM parsing (`aria-selected="true"`) | Student's selected answer |
| `${expA/B/C/D}` | Extracted from `.LearnosityDistractor` | College Board official explanation for each option |
| `${subject}` | URL parsing (`/(\d+)/` → mapping table) | AP subject name |

**3. THINKING Framework**
Guides AI through 5-step reasoning:
1. Identify the tested concept/law
2. Analyze misconceptions reflected by each choice
3. Compare student's answer with correct answer
4. Focus on conceptual understanding, not formula memorization
5. Find observable/testable distinguishing points

**4. IMPORTANT Rules**
7 hard constraints:
- Preflight check: Not a question → "This is not a question."
- Correct answer → "Nice work! No misconception to review."
- Output format: Only output `**Misconception**: ...` line
- Language style: Contrastive phrasing ("If X, then Y would NOT happen")
- Forbidden: Cannot reveal the correct answer letter

**5. HINT Strategy**
Socratic guidance:
- Reference THINKING/IMPORTANT section numbers
- Pose reflective questions, not answers
- Example: "If you tested this in a lab, what would you observe?"

#### Subject Variable Injection Mechanism

**URL → Subject ID Mapping**
```javascript
// background.js
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

**Injection Timing**:
1. Background detects URL → `detectSubjectFromUrl(tab.url)`
2. Store in session storage → `chrome.storage.session.set({ subject })`
3. Send to offscreen → `{ action: 'analyzeQuestion', subject, ... }`
4. Insert into prompt → Template string substitution `${subject}`

---

### 4. College Board Explanations Extraction Flow

#### DOM Structure Recognition
```javascript
// scripts/extract-content.js
function extractRationales(document) {
  const rationales = [];
  
  // 1. Find visible question container
  const visibleRoot = findVisibleQuestionRoot(document);
  
  // 2. Find all options
  const allOptions = visibleRoot.querySelectorAll('.mcq-option, .lrn-mcq-option');
  
  // 3. Extract explanation for each option
  allOptions.forEach((option, index) => {
    const distractor = option.closest('.LearnosityDistractor');
    const contentEl = distractor?.querySelector('.content');
    const text = contentEl?.textContent.trim();
    
    if (text) {
      const letter = ['A', 'B', 'C', 'D', 'E'][index];
      rationales.push({ answer: letter, rationale: text });
    }
  });
  
  return rationales;
}
```

#### Mapping to A-D Variables
```javascript
// offscreen/offscreen.js
const expA = rationales && rationales[0] ? rationales[0].rationale : 'None';
const expB = rationales && rationales[1] ? rationales[1].rationale : 'None';
const expC = rationales && rationales[2] ? rationales[2].rationale : 'None';
const expD = rationales && rationales[3] ? rationales[3].rationale : 'None';
```

**Key Points**:
- Map by index order (rationales[0] → A, rationales[1] → B, ...)
- Fill 'None' when missing (some questions lack official explanations)
- Preserve original text, no secondary processing

---

### 5. Structured Output Parsing

#### Output Format Specification
AI returns three possible outputs:

**Case 1: Not a Question**
```
This is not a question.
```

**Case 2: Correct Answer**
```
Nice work! No misconception to review.
```

**Case 3: Incorrect Answer**
```
**Misconception**: If the magnet were removed, the paper clip would no longer attract others, so the clip is only temporarily magnetized rather than a permanent magnet.
```

#### Frontend Parsing Logic
```javascript
// content/analyzer-ui.js
parseAnalysis(markdown) {
  const analysis = {
    studentAnswer: null,
    correctAnswer: null,
    misconception: null,
    knowledgePoints: [],
    fullText: markdown
  };
  
  // Extract Misconception
  const misconceptionMatch = markdown.match(/\*\*Misconception\*\*:\s*([^\n]+)/);
  if (misconceptionMatch) {
    analysis.misconception = misconceptionMatch[1].trim();
  }
  
  return analysis;
}
```

#### UI Rendering Strategy
```javascript
showAnalysis(markdown) {
  // Handle special cases
  if (markdown.trim() === 'This is not a question.') {
    this.renderStatusAlert('neutral', 'No question detected', 
      'Try selecting the full question on the page and click re-analyze.');
    return;
  }
  
  if (markdown.trim().startsWith('Nice work!')) {
    this.renderStatusAlert('success', 'Analysis complete', 
      'Your answer is correct. You can try another question.');
    return;
  }
  
  // Standard output: Highlight Misconception
  const analysisData = this.parseAnalysis(markdown);
  const html = `
    <div class="qa-misconception-box">
      <div class="qa-misconception-label">💡 Misconception Identified</div>
      <div class="qa-misconception-text">${analysisData.misconception}</div>
    </div>
  `;
  resultDiv.innerHTML = html;
  renderLatexInElement(resultDiv); // Render LaTeX
}
```

---

### 6. Debug Mode & Logging System

#### Enable Debug Mode
```javascript
// background.js
const response = await chrome.runtime.sendMessage({
  action: 'analyzeQuestion',
  content: content,
  debug: true  // Enable debug
});

if (response.debug) {
  console.groupCollapsed('[AI Prompt]', url);
  console.log('Subject:', subject);
  console.log('Student Answer:', userAnswer, 'Correct Answer:', correctAnswer);
  console.log('A–D Explanations:', {
    A: response.debug.fields.expA,
    B: response.debug.fields.expB,
    C: response.debug.fields.expC,
    D: response.debug.fields.expD
  });
  console.log('--- FULL PROMPT BEGIN ---');
  console.log(response.debug.prompt);
  console.log('--- FULL PROMPT END ---');
  console.groupEnd();
}
```

#### Debug Information Structure
```javascript
{
  debug: {
    prompt: "Complete prompt text...",
    fields: {
      subject: "AP Physics 2",
      url: "https://apclassroom.collegeboard.org/93/...",
      studentAnswer: "B",
      correctAnswer: "A",
      expA: "The magnet induces...",
      expB: "The paper clip becomes...",
      expC: "...",
      expD: "..."
    }
  }
}
```

**Use Cases**:
- Verify subject detection correctness
- Check if A-D explanations are fully extracted
- Reproduce AI reasoning process
- Debug prompt effectiveness

---

### 7. Error Handling & Fallback Strategies

#### API Unavailable
```javascript
if (!('LanguageModel' in self)) {
  throw new Error('LanguageModel API not available. Enable Gemini Nano in chrome://flags');
}
```
→ Frontend displays: Guide user to enable Gemini Nano

#### Session Creation Failure
```javascript
catch (error) {
  session.destroy();
  session = null;
  throw error;
}
```
→ Auto-retry creation next time

#### Prompt Too Long
- Currently no length limit check
- Recommendation: Truncate question content to 4000 tokens (not implemented)

#### Abnormal Output Format
```javascript
// Frontend fallback
try {
  const analysisData = this.parseAnalysis(markdown);
  const html = this.buildAnalysisHTML(analysisData, markdown);
} catch (e) {
  // Fallback: Display raw Markdown
  result.textContent = markdown;
}
```

---

## Other Core Features (Brief)

### Subject Detection System
- **Detection Method**: Regex match number ID in URL (`/apclassroom\.collegeboard\.org\/(\d+)/`)
- **Supported Subjects**: 13 AP subjects (see mapping table)
- **Default Value**: Returns 'Unknown' when not recognized

### Cloud Feedback System
- **Tech Stack**: Supabase (PostgreSQL)
- **Features**:
  - Submit helpful/not helpful feedback
  - Community-recommended analyses (helpful ratio > 60% and total >= 3)
  - Deduplicate by URL hash
- **Privacy**: URLs are SHA-256 hashed, originals not stored

### Misconception Deduplication Algorithm
```javascript
// utils/hash.js
function buildFingerprint({ url, title, subject, studentAnswer, correctAnswer }) {
  const base = `${url}|${title}|${subject}|${studentAnswer}|${correctAnswer}`;
  return hashString(base); // FNV-1a hash
}
```
- **Dedup Strategy**: Fingerprint first, fallback to analysisHash
- **Merge Logic**: Same fingerprint misconceptions accumulate count

### LaTeX Rendering Pipeline
1. **Extract**: Turndown identifies `<img alt="LaTeX">` and `.math` elements
2. **Convert**: Wrap in `$LaTeX$` or `$$LaTeX$$`
3. **Render**: KaTeX.renderToString() → HTML
4. **Secure**: DOMPurify.sanitize() filters XSS

---

## Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| defuddle | 0.6.6 | Intelligent webpage content extraction |
| turndown | 7.2.0 | HTML → Markdown |
| marked | 14.1.2 | Markdown → HTML |
| katex | 0.16.9 | LaTeX rendering |
| dompurify | 3.2.4 | XSS protection |
| @supabase/supabase-js | 2.39.3 | Cloud service |

---

## Chrome Version Requirements

- **Minimum Version**: Chrome 138+
- **Required Features**:
  - Manifest V3
  - Offscreen Documents API
  - LanguageModel API (Gemini Nano)
- **How to Enable**:
  1. Visit `chrome://flags`
  2. Search "Prompt API for Gemini Nano"
  3. Set to "Enabled"
  4. Restart browser

---

## Build & Deployment

```bash
# Install dependencies
npm install

# Build to dist/
npm run build

# Load extension
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select dist/ folder
```

**Languages**: [English](ARCHITECTURE.md) | [简体中文](docs/zh-CN/ARCHITECTURE.md)

---

# Question Analyzer - System Architecture

## System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                           Chrome Browser                               │
├────────────────────────────────────────────────────────────────────────┤
│  AP Classroom Webpage       │  Chrome Extension                        │
│  ┌──────────────────────┐   │  ┌──────────────────────────────────────┐ │
│  │ • College Board Q's  │   │  │ Background Script (Service Worker)  │ │
│  │ • LaTeX Math         │   │  │ ┌──────────────────────────────────┐ │ │
│  │ • Multiple Choice    │   │  │ │ • Tab Event Listening            │ │ │
│  │ • A-D Explanations   │   │  │ │ • Subject Detection (URL→Subj)   │ │ │
│  └──────────────────────┘   │  │ │ • Content Extraction Coord       │ │ │
│                              │  │ │ • Offscreen Lifecycle Mgmt       │ │ │
│  ┌──────────────────────┐   │  │ │ • Cache Management (1h TTL)      │ │ │
│  │ Floating Panel       │   │  │ │ • Message Routing Hub            │ │ │
│  │ (Injected)           │   │  │ └──────────────────────────────────┘ │ │
│  │ ┌──────────────────┐ │   │  │                                      │ │
│  │ │ 🧲 AP Physics 2 │ │   │  │ ┌──────────────────────────────────┐ │ │
│  │ │ 💡 Misconception │ │   │  │ │ Content Script (analyzer-ui.js)  │ │ │
│  │ │ 👍 👎 ☆ Save     │ │   │  │ │ ┌──────────────────────────────┐ │ │ │
│  │ │ LaTeX Rendering  │ │   │  │ │ │ • Panel Management           │ │ │ │
│  │ └──────────────────┘ │   │  │ │ │ • Markdown + LaTeX Rendering │ │ │ │
│  └──────────────────────┘   │  │ │ │ • Feedback Button Handling   │ │ │ │
│                              │  │ │ │ • Misconception Saving       │ │ │ │
│                              │  │ │ └──────────────────────────────┘ │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  │                                      │ │
│                              │  │ ┌──────────────────────────────────┐ │ │
│                              │  │ │ ⭐ Offscreen Document (AI Core)  │ │ │
│                              │  │ │ ┌──────────────────────────────┐ │ │ │
│                              │  │ │ │ • LanguageModel API         │ │ │ │
│                              │  │ │ │ • Singleton Session Mgmt    │ │ │ │
│                              │  │ │ │ • Prompt Injection          │ │ │ │
│                              │  │ │ │ • Gemini Nano Inference     │ │ │ │
│                              │  │ │ │ • Error Recovery            │ │ │ │
│                              │  │ │ └──────────────────────────────┘ │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  │                                      │ │
│                              │  │ ┌──────────────────────────────────┐ │ │
│                              │  │ │ Popup (Control Panel)            │ │ │
│                              │  │ │ • Auto-Scan Toggle               │ │ │
│                              │  │ │ • Manual Analysis Trigger        │ │ │
│                              │  │ │ • Misconceptions Entry           │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  │                                      │ │
│                              │  │ ┌──────────────────────────────────┐ │ │
│                              │  │ │ Misconceptions Page (Bank)       │ │ │
│                              │  │ │ • Dedup Display (fingerprint)    │ │ │
│                              │  │ │ • Subject Filtering              │ │ │
│                              │  │ │ • Export Function                │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  │                                      │ │
│                              │  │ ┌──────────────────────────────────┐ │ │
│                              │  │ │ Supabase Cloud (Optional)        │ │ │
│                              │  │ │ • Community Recommendations      │ │ │
│                              │  │ │ • Feedback Stats                 │ │ │
│                              │  │ └──────────────────────────────────┘ │ │
│                              │  └──────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

## 🎯 AI Processing Core Architecture (Detailed)

### Offscreen Document AI Engine

#### Architecture Design Principles
```
┌─────────────────────────────────────────────────────┐
│  Background.js (Service Worker)                     │
│  - No DOM environment, can't use LanguageModel API  │
│  - Responsible for coordination & messaging         │
└────────────┬────────────────────────────────────────┘
             │ chrome.runtime.sendMessage()
             ↓
┌─────────────────────────────────────────────────────┐
│  Offscreen Document (offscreen.html + .js)          │
│  - Provides DOM context                             │
│  - Hosts LanguageModel API                          │
│  - Singleton Session management                     │
└────────────┬────────────────────────────────────────┘
             │ LanguageModel.create() / session.prompt()
             ↓
┌─────────────────────────────────────────────────────┐
│  Gemini Nano (Chrome Built-in AI)                   │
│  - Local inference, no network requests             │
│  - Receives prompts, returns text                   │
└─────────────────────────────────────────────────────┘
```

#### Complete Message Flow
```javascript
// 1. Background triggers analysis
async function triggerAnalysis(tabId, content, url, context) {
  const subject = detectSubjectFromUrl(url); // ← Subject detection
  
  await ensureOffscreenDocument(); // ← Ensure offscreen exists
  
  // 2. Send analysis request
  const response = await chrome.runtime.sendMessage({
    action: 'analyzeQuestion',
    content: content,
    userAnswer: context.userAnswer,
    correctAnswer: context.correctAnswer,
    rationales: context.rationales,  // ← A-D official explanations
    subject: subject,                // ← Inject subject
    url: url,
    debug: true
  });
  
  // 3. Handle response
  if (response.success) {
    await chrome.tabs.sendMessage(tabId, {
      action: 'showAnalysis',
      result: response.result,
      subject: subject
    });
  }
}

// Offscreen processing
async function analyzeQuestion(content, context) {
  const { subject, rationales, userAnswer, correctAnswer } = context;
  
  // Extract A-D explanations
  const expA = rationales?.[0]?.rationale || 'None';
  const expB = rationales?.[1]?.rationale || 'None';
  const expC = rationales?.[2]?.rationale || 'None';
  const expD = rationales?.[3]?.rationale || 'None';
  
  // Build prompt (with subject and A-D explanations)
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
  
  // AI inference
  const result = await session.prompt(prompt);
  return { success: true, result };
}
```

#### Session Lifecycle Management
```javascript
let session = null; // Global singleton

// Create Session
if (!session) {
  session = await LanguageModel.create({
    temperature: 0.7,   // Creativity vs consistency
    topK: 3,            // Candidate word limit
    outputLanguage: 'en'
  });
}

// Error recovery
catch (error) {
  if (session) {
    session.destroy();  // Destroy corrupted session
    session = null;     // Recreate next time
  }
  throw error;
}
```

**Key Design Points**:
- ✅ **Lazy Initialization**: Created only on first analysis, saves resources
- ✅ **Session Reuse**: Multiple analyses share one session, improves performance
- ✅ **Auto Recovery**: Destroyed on error, auto-recreated next time
- ✅ **Singleton Pattern**: Only one session for entire extension lifecycle

---

### Prompt Dynamic Injection Flow

#### Subject Detection → Prompt Injection
```
1. User visits AP Classroom question
   URL: https://apclassroom.collegeboard.org/93/assessments/...
              ↓
2. Background listens to tab.onUpdated
   detectSubjectFromUrl(url) 
   → Regex match: /apclassroom\.collegeboard\.org\/(\d+)/
   → Extract ID: 93
              ↓
3. Query mapping table
   { '93': 'AP Physics 2', '26': 'AP Calculus BC', ... }
   → subject = 'AP Physics 2'
              ↓
4. Send to Offscreen
   { action: 'analyzeQuestion', subject: 'AP Physics 2', ... }
              ↓
5. Template string substitution
   `You are an expert AI tutor in ${subject}` 
   → "You are an expert AI tutor in AP Physics 2"
              ↓
6. Gemini Nano receives complete prompt
   → Uses subject-specific terminology and frameworks for analysis
```

#### A-D Official Explanations Extraction Flow
```
1. Content Extraction Script executes
   scripts/extract-content.js
              ↓
2. Find DOM structure
   visibleRoot.querySelectorAll('.LearnosityDistractor')
              ↓
3. Extract each option's explanation
   Option A: distractor[0].querySelector('.content').textContent
   Option B: distractor[1].querySelector('.content').textContent
   ...
              ↓
4. Build rationales array
   [
     { answer: 'A', rationale: '...' },
     { answer: 'B', rationale: '...' },
     { answer: 'C', rationale: '...' },
     { answer: 'D', rationale: '...' }
   ]
              ↓
5. Pass to Offscreen
   { rationales: [...] }
              ↓
6. Map to A-D variables
   expA = rationales[0].rationale
   expB = rationales[1].rationale
   ...
              ↓
7. Inject into prompt
   College Board Explanation:
   A: ${expA}
   B: ${expB}
   C: ${expC}
   D: ${expD}
```

---

### Structured Output Processing Pipeline

#### AI Output → Frontend Rendering
```
1. Gemini Nano returns text
   "**Misconception**: If the magnet were removed, the paper clip 
    would no longer attract others, so the clip is only temporarily 
    magnetized rather than a permanent magnet."
              ↓
2. Offscreen returns to Background
   { success: true, result: "**Misconception**: ..." }
              ↓
3. Background caches + sends to Content Script
   chrome.storage.local.set({ [`analysis_${url}`]: { content: result } })
   chrome.tabs.sendMessage(tabId, { action: 'showAnalysis', result })
              ↓
4. Content Script parses Markdown
   parseAnalysis(markdown)
   → Regex extract: /\*\*Misconception\*\*:\s*([^\n]+)/
   → misconception = "If the magnet were removed..."
              ↓
5. Build HTML
   <div class="qa-misconception-box">
     <div class="qa-misconception-label">💡 Misconception Identified</div>
     <div class="qa-misconception-text">${misconception}</div>
   </div>
              ↓
6. Render LaTeX
   renderLatexInElement(resultDiv)
   → KaTeX renders all $...$ and $$...$$ formulas
              ↓
7. User sees highlighted Misconception card
```

---

## Other Component Architecture (Brief)

### 1. Background Script (`background.js`)
**Core Responsibilities**:
- Tab event listening (onActivated, onUpdated)
- **Subject Detection**: `detectSubjectFromUrl(url)` → 13 AP subjects mapping
- Content extraction coordination: inject `extract-content.js`
- **Offscreen Lifecycle Management**: `ensureOffscreenDocument()`
- Cache management: 1-hour TTL
- Message routing: Background ↔ Offscreen ↔ Content Script

**Key Functions**:
```javascript
extractPageContent(tabId)          // Extract webpage content
triggerAnalysis(tabId, content)    // Trigger AI analysis
detectSubjectFromUrl(url)          // Subject detection
ensureOffscreenDocument()          // Offscreen management
```

### 2. Content Script (`content/analyzer-ui.js`)
**Core Responsibilities**:
- Floating panel management (init, show, hide)
- Markdown + LaTeX rendering (calls `utils/markdown-renderer.js`)
- Parse AI output (extract `**Misconception**`)
- Feedback buttons: 👍 👎 → Submit to Supabase
- Save misconceptions: ☆ Save → Local storage

**Key Methods**:
```javascript
class AnalyzerUI {
  showAnalysis(markdown)        // Display analysis results
  parseAnalysis(markdown)       // Parse structured output
  handleFeedback(isHelpful)     // Submit feedback
  handleSave()                  // Save to misconception bank
  updateHeaderSubject(subject)  // Update title icon
}
```

### 3. Content Extraction (`scripts/extract-content.js`)
**Core Responsibilities**:
- **Defuddle** intelligent webpage content extraction
- **Turndown** HTML → Markdown conversion
- **LaTeX Preservation**: Identify `<img alt="...">` and `.math` elements
- **Answer Detection**: `aria-selected="true"` / `.--chosen`
- **A-D Explanations Extraction**: `.LearnosityDistractor .content`
- **Visible Question Priority**: `offsetParent !== null`

**Key Functions**:
```javascript
parse(document)                     // Main entry
detectUserAnswer(document)          // Detect student selection
extractRationales(document)         // Extract A-D explanations
findVisibleQuestionRoot(document)   // Find visible question
convertHtmlToMarkdown(html)         // HTML → Markdown
```

### 4. Popup (`popup/popup.js`)
**Core Responsibilities**:
- Auto-scan toggle
- Manual analysis trigger
- Misconceptions bank entry

### 5. Misconceptions Page (`misconceptions/misconceptions.js`)
**Core Responsibilities**:
- Misconception list display (reverse chronological)
- **Deduplication Logic**: `buildFingerprint({ url, title, subject, studentAnswer, correctAnswer })`
- Subject filtering
- Export function (JSON/CSV)
- Delete operations

### 6. Shared Utilities

#### `utils/markdown-renderer.js`
- Marked.js configuration (custom LaTeX renderer)
- KaTeX integration (`renderToString()`)
- DOMPurify security filtering

#### `utils/hash.js`
- FNV-1a 32-bit hash algorithm
- `buildFingerprint()` misconception deduplication
- `hashString()` general hashing

#### `utils/supabase-service.js`
- Supabase client initialization
- `submitFeedback(url, isHelpful)` submit feedback
- `getRecommendedAnalysis(url)` get community recommendations
- URL SHA-256 hashing (privacy protection)

## Complete Data Flow (with AI Inference Details)

```
1. User visits AP Classroom question page
   https://apclassroom.collegeboard.org/93/assessments/...
              ↓
2. Background listens to tab.onUpdated (status === 'complete')
   detectSubjectFromUrl(url) → subject = 'AP Physics 2'
              ↓
3. Inject Content Extraction Script
   chrome.scripting.executeScript({ files: ['scripts/extract-content.js'] })
              ↓
4. Extract content, answers, A-D explanations
   {
     content: "Markdown question content...",
     userAnswer: "B",
     correctAnswer: "A",
     rationales: [
       { answer: 'A', rationale: 'The magnet induces...' },
       { answer: 'B', rationale: '...' },
       ...
     ]
   }
              ↓
5. Background checks cache
   const key = `analysis_${url}`;
   const cached = await chrome.storage.local.get(key);
              ↓
6a. 【Cache Hit】Send directly to Content Script
   chrome.tabs.sendMessage(tabId, { action: 'showAnalysis', result })
   → Jump to step 13
              ↓
6b. 【Cache Miss】Trigger new analysis
              ↓
7. Ensure Offscreen Document exists
   ensureOffscreenDocument()
   → Singleton creation, lazy initialization
              ↓
8. Send analysis request to Offscreen
   chrome.runtime.sendMessage({
     action: 'analyzeQuestion',
     content: content,
     subject: 'AP Physics 2',        ← Subject injection
     userAnswer: 'B',
     correctAnswer: 'A',
     rationales: [...],              ← A-D explanations
     debug: true
   })
              ↓
9. Offscreen creates/reuses LanguageModel Session
   if (!session) {
     session = await LanguageModel.create({ temperature: 0.7, topK: 3 })
   }
              ↓
10. Build complete prompt
   const prompt = `You are an expert AI tutor in ${subject}. ← Dynamic injection
   
   Question content: ${content}
   Correct Answer: ${correctAnswer}
   Student Answer: ${userAnswer}
   
   College Board Explanation:
   A: ${rationales[0].rationale}     ← A-D official explanations injection
   B: ${rationales[1].rationale}
   C: ${rationales[2].rationale}
   D: ${rationales[3].rationale}
   
   THINKING: ...
   IMPORTANT: ...
   HINT: ...`;
              ↓
11. Gemini Nano local inference
   const result = await session.prompt(prompt);
   → Returns: "**Misconception**: If the magnet were removed..."
              ↓
12. Background caches result (1-hour TTL)
   chrome.storage.local.set({
     [`analysis_${url}`]: {
       status: 'completed',
       content: result,
       timestamp: Date.now(),
       subject: 'AP Physics 2'
     }
   })
              ↓
13. Send to Content Script
   chrome.tabs.sendMessage(tabId, {
     action: 'showAnalysis',
     result: result,
     subject: 'AP Physics 2'
   })
              ↓
14. Content Script parses Markdown
   parseAnalysis(markdown)
   → Extract: misconception = "If the magnet were removed..."
              ↓
15. Build highlighted HTML + Render LaTeX
   <div class="qa-misconception-box">
     <div class="qa-misconception-label">💡 Misconception Identified</div>
     <div class="qa-misconception-text">${misconception}</div>
   </div>
   renderLatexInElement(resultDiv) → KaTeX renders all $...$ formulas
              ↓
16. User sees analysis result
   - Subject icon: 🧲 AP Physics 2
   - Misconception card
   - Feedback buttons: 👍 👎
   - Save button: ☆ Save
              ↓
17a. User clicks 👍/👎
   → submitFeedback(url, isHelpful) → Supabase
              ↓
17b. User clicks ☆ Save
   → Save to local chrome.storage.local
   → buildFingerprint({ url, subject, studentAnswer, correctAnswer })
   → Misconception bank deduplication merge
```

## API Integration

### Chrome Extension APIs
```javascript
chrome.scripting.executeScript()      // Inject extraction script
chrome.scripting.insertCSS()          // Inject styles
chrome.tabs.onActivated/onUpdated     // Tab events
chrome.storage.local                  // Persistent cache (analysis, misconceptions)
chrome.storage.session                // Temporary data (page content)
chrome.runtime.sendMessage()          // Inter-component communication
chrome.offscreen.createDocument()     // AI processing container
```

### Web APIs (AI Core)
```javascript
LanguageModel.create(params)          // Create Gemini Nano session
session.prompt(promptText)            // Initiate inference
DOMPurify.sanitize(html)              // XSS protection
marked.parse(markdown)                // Markdown → HTML
katex.renderToString(latex)           // LaTeX → HTML
```

## Storage Architecture

### chrome.storage.local (Persistent)
```javascript
{
  // AI analysis cache (1-hour TTL)
  "analysis_<url_hash>": {
    status: "completed" | "analyzing" | "error",
    content: "**Misconception**: ...",
    timestamp: 1234567890,
    subject: "AP Physics 2"
  },
  
  // Misconception bank (deduplicated storage)
  "misconceptions": [
    {
      id: "misc_123456_abc",
      timestamp: 1234567890,
      url: "https://...",
      subject: "AP Physics 2",
      studentAnswer: "B",
      correctAnswer: "A",
      misconception: "...",
      fingerprint: "a1b2c3d4",    // Dedup key
      analysisHash: "e5f6g7h8",   // Content hash
      count: 3                     // Repetition count
    }
  ],
  
  // User settings
  "autoScanEnabled": true
}
```

### chrome.storage.session (Temporary)
```javascript
{
  pageContent: "Markdown question content",
  pageUrl: "https://...",
  pageTitle: "Question 1",
  userAnswer: "B",
  correctAnswer: "A",
  rationales: [...],
  subject: "AP Physics 2"
}
```

## Message Flow

### Background ↔ Offscreen (AI Inference Pipeline)
```javascript
// Background → Offscreen
{
  action: 'analyzeQuestion',
  content: "Markdown question...",
  subject: "AP Physics 2",       // ← Subject injection
  userAnswer: "B",
  correctAnswer: "A",
  rationales: [                  // ← A-D official explanations
    { answer: 'A', rationale: '...' },
    { answer: 'B', rationale: '...' },
    ...
  ],
  debug: true
}

// Offscreen → Background
{
  success: true,
  result: "**Misconception**: ...",
  debug: {                       // Debug mode
    prompt: "Complete prompt...",
    fields: { subject, expA, expB, ... }
  }
}
```

### Background ↔ Content Script
```javascript
// Background → Content
{ action: 'showLoading', subject: 'AP Physics 2' }
{ action: 'showAnalysis', result: '...', subject: '...' }
{ action: 'showError', error: 'LanguageModel API not available' }
{ action: 'hidePanel' }

// Content → Background
{ action: 'contentScriptReady' }
{ action: 'reanalyzeTab' }
{ action: 'saveMisconception', url, studentAnswer, ... }
{ action: 'submitCloudFeedback', url, isHelpful }
```

## Security & Privacy

### Content Security
- ✅ DOMPurify filters all HTML
- ✅ KaTeX safely renders LaTeX (no JS execution)
- ✅ CSP policy (Manifest V3)

### Privacy Protection
- ✅ **Local AI**: Gemini Nano offline inference, no network requests
- ✅ **URL Hashing**: Supabase only stores SHA-256(url), not original URLs
- ✅ **Anonymous Users**: Randomly generated `user_id`, no login required
- ✅ **Local First**: Misconception bank stored in `chrome.storage.local`

### Error Handling
- Session corruption → Auto-destroy and rebuild
- API unavailable → Prompt to enable Gemini Nano
- LaTeX errors → Fallback to raw formula display
- Network failures → Supabase requests fail silently (doesn't affect core functionality)

## Performance Optimizations

### Caching Strategy
- **Analysis Results**: 1-hour TTL, same URL won't be re-analyzed
- **Session Reuse**: Multiple analyses share one LanguageModel session
- **Content Extraction**: Defuddle executes only once after page load completes

### Memory Management
- Offscreen Document singleton (one per extension lifecycle)
- Clean up `analyzingTabs` Set on tab close
- Old cache auto-expires (based on timestamp)

### Rendering Optimization
- LaTeX batch rendering (`renderLatexInElement` processes all at once)
- Markdown preprocessing (filter `[asy]` blocks in advance)
- Shared `markdown-renderer.js` (avoid repeated Marked/KaTeX configuration)

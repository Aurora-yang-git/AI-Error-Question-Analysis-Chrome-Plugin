**Languages**: [English](CODE_STRUCTURE.md) | [简体中文](docs/zh-CN/CODE_STRUCTURE.md)

---

# Code Structure Overview

## Complete Project File Tree

```
Question Analyzer/
├── 📁 Core Extension Files
│   ├── manifest.json              # Extension config (permissions, version, background)
│   ├── background.js              # ⭐ Background service (subject detection, offscreen mgmt)
│   ├── package.json               # Dependency versions
│   └── supabase-config.js         # Supabase config (URL, anon key)
│
├── 📁 Content Scripts (Injected into webpages)
│   ├── content/
│   │   ├── analyzer-ui.js         # Floating panel UI (parse, render, interact)
│   │   └── analyzer-ui.css        # Panel styling
│   └── scripts/
│       └── extract-content.js     # ⭐ Content extraction (Defuddle, answer detection, A-D)
│
├── 📁 AI Processing Core
│   └── offscreen/
│       ├── offscreen.html         # Offscreen Document HTML (shell)
│       └── offscreen.js           # ⭐⭐⭐ AI Engine (LanguageModel API, prompt injection)
│
├── 📁 Popup Control
│   └── popup/
│       ├── popup.html             # Popup UI
│       ├── popup.js               # Auto-scan toggle, manual analysis
│       └── popup.css              # Popup styling
│
├── 📁 Misconceptions Page
│   └── misconceptions/
│       ├── misconceptions.html    # Misconceptions HTML
│       ├── misconceptions.js      # Dedup display, export, delete
│       └── misconceptions.css     # Misconceptions styling
│
├── 📁 Shared Utilities
│   └── utils/
│       ├── markdown-renderer.js   # ⭐ Markdown + LaTeX rendering (Marked + KaTeX)
│       ├── hash.js                # FNV-1a hash, fingerprint generation
│       └── supabase-service.js    # Cloud service (feedback, recommendations)
│
├── 📁 Assets
│   └── images/                    # Extension icons (16/32/48/128px)
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
│
├── 📁 Build Configuration
│   ├── rollup.config.mjs          # Rollup bundling config
│   ├── package-lock.json          # Dependency lock
│   └── dist/                      # Build output directory (load into Chrome)
│       ├── background.js
│       ├── content/
│       ├── offscreen/
│       ├── popup/
│       ├── misconceptions/
│       ├── utils/
│       └── ...
│
└── 📁 Documentation
    ├── README.md                  # User guide
    ├── ARCHITECTURE.md            # System architecture (AI detailed)
    ├── TECHNICAL_DOCS.md          # Technical docs (prompt engineering detailed)
    └── CODE_STRUCTURE.md          # This file
```

## ⭐ AI-Related Files (Highlighted)

### offscreen/offscreen.js (AI Core Engine)
**Most Important File**, responsible for all AI inference logic:
- LanguageModel API integration
- Session singleton management (create + error recovery)
- **Prompt Dynamic Injection**:
  - `${subject}` - Subject name
  - `${expA/B/C/D}` - College Board A-D explanations
  - `${userAnswer}`, `${correctAnswer}` - Student/correct answers
- Complete prompt template (THINKING + IMPORTANT + HINT)
- Debug mode logging output

**Key Code**:
```javascript
async function analyzeQuestion(content, context) {
  const { subject, rationales, userAnswer, correctAnswer } = context;
  
  // Extract A-D explanations
  const expA = rationales?.[0]?.rationale || 'None';
  const expB = rationales?.[1]?.rationale || 'None';
  const expC = rationales?.[2]?.rationale || 'None';
  const expD = rationales?.[3]?.rationale || 'None';
  
  // Build prompt
  const prompt = `You are an expert AI tutor in ${subject}...`;
  
  // Inference
  const result = await session.prompt(prompt);
  return { success: true, result };
}
```

---

### background.js (Subject Detection + Offscreen Management)
**Second Most Important File**, coordinates the entire analysis flow:
- **Subject Detection Function**: `detectSubjectFromUrl(url)`
  - Regex extraction: `/apclassroom\.collegeboard\.org\/(\d+)/`
  - Mapping table: 13 AP subjects
- **Offscreen Lifecycle**: `ensureOffscreenDocument()`
  - Singleton creation
  - Health check (ping/pong)
- Analysis trigger: `triggerAnalysis(tabId, content, url, context)`
- Cache management: 1-hour TTL
- Message routing: Background ↔ Offscreen ↔ Content

**Key Code**:
```javascript
function detectSubjectFromUrl(url) {
  const match = url && url.match(/apclassroom\.collegeboard\.org\/(\d+)/);
  const id = match ? match[1] : null;
  const map = {
    '7': 'AP Chemistry',
    '8': 'AP Computer Science A',
    '93': 'AP Physics 2',
    // ... total 13 subjects
  };
  return id && map[id] ? map[id] : 'Unknown';
}
```

---

### scripts/extract-content.js (A-D Explanations Extraction)
**Third Most Important File**, provides raw materials for AI:
- **Answer Detection**: `detectUserAnswer(document)`
  - Student selection: `aria-selected="true"` / `.--chosen`
  - Correct answer: `.icon.--correct` / `.lrn_valid`
- **A-D Official Explanations**: `extractRationales(document)`
  - DOM search: `.LearnosityDistractor .content`
  - Map by index to A/B/C/D
- **Visible Question Priority**: `findVisibleQuestionRoot(document)`
  - Solves multi-question page issue
- Defuddle content extraction
- Turndown HTML → Markdown
- LaTeX preservation handling

**Key Code**:
```javascript
function extractRationales(document) {
  const rationales = [];
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
  
  return rationales;
}
```

---

## Other File Responsibilities (Brief)

### Core Extension Files
- **`manifest.json`**: Manifest V3 config, permissions declaration, background entry
- **`package.json`**: npm dependencies (defuddle, turndown, marked, katex, supabase-js)
- **`supabase-config.js`**: Supabase URL and anonymous key

### Content Scripts (UI)
- **`content/analyzer-ui.js`**: Floating panel, parse AI output, LaTeX rendering, feedback/save
- **`content/analyzer-ui.css`**: Panel styling (float, minimize, animations)

### Popup & Misconceptions
- **`popup/popup.js`**: Auto-scan toggle, manual analysis button, misconceptions entry
- **`misconceptions/misconceptions.js`**: Dedup display, export JSON/CSV, delete

### Shared Utilities
- **`utils/markdown-renderer.js`**: Marked.js + KaTeX config, custom LaTeX renderer
- **`utils/hash.js`**: FNV-1a hash, `buildFingerprint()` misconception deduplication
- **`utils/supabase-service.js`**: Cloud feedback, community recommendations, URL hashing

## Dependencies

### Core Libraries
| Library | Version | Purpose | AI-Related |
|---------|---------|---------|------------|
| defuddle | 0.6.6 | Intelligent webpage content extraction | ✅ Provides question content for AI |
| turndown | 7.2.0 | HTML → Markdown | ✅ Converts to AI-readable format |
| turndown-plugin-gfm | 1.0.2 | GitHub Flavored Markdown | - |
| marked | 14.1.2 | Markdown → HTML | Renders AI output |
| katex | 0.16.9 | LaTeX rendering | Renders math formulas |
| dompurify | 3.2.4 | XSS protection | - |
| @supabase/supabase-js | 2.39.3 | Cloud service | - |

### Build Tools
```json
{
  "rollup": "4.22.4",
  "@rollup/plugin-node-resolve": "15.2.3",
  "@rollup/plugin-commonjs": "26.0.1",
  "rollup-plugin-copy": "3.5.0"
}
```

---

## Build Process

### Rollup Bundling Configuration (rollup.config.mjs)
```javascript
export default [
  // 1. Static asset copying
  {
    input: 'scripts/extract-content.js',
    plugins: [
      copy({
        targets: [
          { src: 'manifest.json', dest: 'dist' },
          { src: 'images', dest: 'dist' },
          { src: 'supabase-config.js', dest: 'dist' },
          { src: 'content/analyzer-ui.css', dest: 'dist/content' },
          { src: 'node_modules/katex/dist/katex.min.css', dest: 'dist/node_modules/katex/dist' },
          ...
        ]
      })
    ]
  },
  
  // 2. Bundle JS files (ES Modules → IIFE)
  { input: 'background.js', output: { file: 'dist/background.js', format: 'iife' } },
  { input: 'offscreen/offscreen.js', output: { dir: 'dist/offscreen', format: 'iife' } },
  { input: 'content/analyzer-ui.js', output: { dir: 'dist/content', format: 'iife' } },
  { input: 'popup/popup.js', output: { dir: 'dist/popup', format: 'iife' } },
  { input: 'misconceptions/misconceptions.js', output: { dir: 'dist/misconceptions', format: 'iife' } },
  { input: 'scripts/extract-content.js', output: { dir: 'dist/scripts', format: 'es' } }
]
```

### Input → Output Mapping
| Source File | Output File | Format | AI-Related |
|-------------|-------------|--------|------------|
| `background.js` | `dist/background.js` | IIFE | ✅ Subject detection |
| `offscreen/offscreen.js` | `dist/offscreen/offscreen.js` | IIFE | ⭐⭐⭐ AI Core |
| `scripts/extract-content.js` | `dist/scripts/extract-content.js` | ES | ✅ A-D extraction |
| `content/analyzer-ui.js` | `dist/content/analyzer-ui.js` | IIFE | Renders AI output |
| `popup/popup.js` | `dist/popup/popup.js` | IIFE | - |
| `misconceptions/misconceptions.js` | `dist/misconceptions/misconceptions.js` | IIFE | - |

### Build Command
```bash
npm run build
```

Build output directory structure:
```
dist/
├── manifest.json
├── background.js            # ← Subject detection, Offscreen mgmt
├── supabase-config.js
├── offscreen/
│   ├── offscreen.html
│   └── offscreen.js         # ← ⭐⭐⭐ AI Engine
├── content/
│   ├── analyzer-ui.js
│   └── analyzer-ui.css
├── scripts/
│   └── extract-content.js   # ← A-D explanations extraction
├── popup/
├── misconceptions/
├── utils/
│   ├── markdown-renderer.js
│   ├── hash.js
│   └── supabase-service.js
├── images/
└── node_modules/katex/dist/katex.min.css
```

---

## Code Quality Features

### Error Handling
- **LanguageModel API Unavailable**: Prompt user to enable Gemini Nano
- **Session Creation Failure**: Auto-destroy and rebuild
- **LaTeX Rendering Errors**: Fallback to raw formula display
- **Supabase Failures**: Fail silently, doesn't affect core functionality

### Performance Optimizations
- ✅ **1-hour Cache**: Same URL won't be re-analyzed
- ✅ **Session Reuse**: Multiple analyses share one LanguageModel session
- ✅ **Offscreen Singleton**: Created only once per extension lifecycle
- ✅ **LaTeX Batch Rendering**: `renderLatexInElement` processes all at once

### Security Measures
- ✅ **DOMPurify Filtering**: Prevents XSS attacks
- ✅ **Local AI**: Gemini Nano offline inference
- ✅ **URL Hashing**: Supabase only stores SHA-256(url)
- ✅ **CSP Policy**: Manifest V3 content security policy

### Maintainability
- ✅ **Modular Design**: AI logic isolated in offscreen
- ✅ **Shared Utilities**: `utils/` directory centralizes utility functions
- ✅ **Separation of Concerns**: UI, extraction, AI inference each has its role
- ✅ **Detailed Documentation**: ARCHITECTURE.md (AI detailed) + TECHNICAL_DOCS.md (prompt detailed)

---

## Development Workflow

1. **Development**: Edit source files (`offscreen/`, `background.js`, ...)
2. **Build**: `npm run build` → Generate `dist/` directory
3. **Testing**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dist/` folder
4. **Debug AI**:
   - Open `chrome://extensions/` → Background page → Console
   - View `[AI Prompt]` collapsed logs
   - Verify `subject`, `expA/B/C/D` injection
5. **Deployment**: Package `dist/` folder for Chrome Web Store submission

---

## Quick Reference: AI Code Trace

Want to understand how AI works? Read code in this order:

1. **`background.js:604-630`** → `detectSubjectFromUrl()` Subject detection
2. **`background.js:380-558`** → `triggerAnalysis()` Trigger analysis
3. **`scripts/extract-content.js:434-524`** → `extractRationales()` Extract A-D explanations
4. **`offscreen/offscreen.js:30-111`** → `analyzeQuestion()` AI inference core
5. **`content/analyzer-ui.js:243-276`** → `parseAnalysis()` Parse output
6. **`content/analyzer-ui.js:193-241`** → `showAnalysis()` Render results

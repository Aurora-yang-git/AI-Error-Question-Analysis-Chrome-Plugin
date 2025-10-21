# Question Analyzer - Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                           │
├─────────────────────────────────────────────────────────────────┤
│  Webpage (Math Problems)  │  Chrome Extension                  │
│  ┌─────────────────────┐  │  ┌─────────────────────────────────┐ │
│  │ • Math Questions    │  │  │ Background Script               │ │
│  │ • LaTeX Formulas    │  │  │ ┌─────────────────────────────┐ │ │
│  │ • Multiple Choice   │  │  │ │ • Tab Event Handling        │ │ │
│  └─────────────────────┘  │  │ │ • Content Extraction        │ │ │
│                           │  │ │ • UI Injection              │ │ │
│  ┌─────────────────────┐  │  │ │ • Cache Management          │ │ │
│  │ Floating Analysis   │  │  │ │ • Message Orchestration     │ │ │
│  │ Panel (Injected)    │  │  │ └─────────────────────────────┘ │ │
│  │ ┌─────────────────┐ │  │  │                                 │ │
│  │ │ • AI Analysis   │ │  │  │ ┌─────────────────────────────┐ │ │
│  │ │ • LaTeX Render  │ │  │  │ │ Content Script              │ │ │
│  │ │ • Interactive   │ │  │  │ │ ┌─────────────────────────┐ │ │ │
│  │ │   Controls      │ │  │  │ │ │ • UI Management         │ │ │ │
│  │ └─────────────────┘ │  │  │ │ │ • Message Handling      │ │ │ │
│  └─────────────────────┘  │  │ │ │ • Markdown Rendering    │ │ │ │
│                           │  │ │ │ • LaTeX Processing      │ │ │ │
│                           │  │ │ └─────────────────────────┘ │ │ │
│                           │  │ └─────────────────────────────┘ │ │
│                           │  │                                 │ │
│                           │  │ ┌─────────────────────────────┐ │ │
│                           │  │ │ Offscreen Document          │ │ │
│                           │  │ │ ┌─────────────────────────┐ │ │ │
│                           │  │ │ │ • LanguageModel API     │ │ │ │
│                           │  │ │ │ • AI Prompt Processing  │ │ │ │
│                           │  │ │ │ • Response Generation   │ │ │ │
│                           │  │ │ └─────────────────────────┘ │ │ │
│                           │  │ └─────────────────────────────┘ │ │
│                           │  │                                 │ │
│                           │  │ ┌─────────────────────────────┐ │ │
│                           │  │ │ Side Panel                  │ │ │
│                           │  │ │ ┌─────────────────────────┐ │ │ │
│                           │  │ │ │ • Additional Tools      │ │ │ │
│                           │  │ │ │ • Extended Analysis     │ │ │ │
│                           │  │ │ │ • Settings & Controls   │ │ │ │
│                           │  │ │ └─────────────────────────┘ │ │ │
│                           │  │ └─────────────────────────────┘ │ │
│                           │  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Background Script (`background.js`)
**Role**: Central orchestrator and coordinator

**Responsibilities**:
- Tab event monitoring (`chrome.tabs.onActivated`, `chrome.tabs.onUpdated`)
- Content extraction coordination
- UI injection management
- Cache management (`chrome.storage.local`)
- Message routing between components
- Offscreen document lifecycle management

**Key Functions**:
```javascript
// Core workflow functions
extractPageContent(tabId)     // Extract and process webpage content
triggerAnalysis(tabId, content, url)  // Coordinate AI analysis
createOffscreenDocument()     // Manage offscreen document

// Event handlers
chrome.tabs.onActivated       // Handle tab switches
chrome.tabs.onUpdated         // Handle page loads
chrome.runtime.onMessage      // Handle inter-component communication
```

### 2. Content Script (`content/analyzer-ui.js`)
**Role**: User interface and webpage integration

**Responsibilities**:
- Floating panel creation and management
- Real-time UI updates
- Markdown and LaTeX rendering
- User interaction handling
- Message communication with background

**Key Classes**:
```javascript
class AnalyzerUI {
  initPanel()           // Create floating analysis panel
  showAnalysis()        // Display AI analysis results
  showLoading()         // Show loading state
  showError()           // Display error messages
  setupMessageListener() // Handle background messages
}
```

### 3. Offscreen Document (`offscreen/offscreen.js`)
**Role**: AI processing and analysis

**Responsibilities**:
- LanguageModel API integration
- Question analysis prompt processing
- AI response generation
- Error handling and recovery

**Key Functions**:
```javascript
analyzeQuestion(content)  // Main AI analysis function
// Uses Chrome's LanguageModel API for on-device processing
```

### 4. Content Extraction (`scripts/extract-content.js`)
**Role**: Webpage content processing

**Responsibilities**:
- Intelligent content parsing using Defuddle
- HTML to Markdown conversion
- LaTeX formula preservation
- Content cleaning and formatting

**Key Functions**:
```javascript
parse(document)                    // Main extraction function
convertHtmlToMarkdown(htmlContent) // HTML to Markdown conversion
// Uses Defuddle + Turndown for robust content extraction
```

### 5. Shared Utilities (`utils/markdown-renderer.js`)
**Role**: Consistent rendering across components

**Responsibilities**:
- Markdown parsing with LaTeX support
- Mathematical formula rendering
- HTML sanitization
- Cross-component consistency

**Key Functions**:
```javascript
renderMarkdownWithLatex(markdown)  // Main rendering function
renderLatexInElement(element)      // LaTeX rendering helper
// Uses Marked.js + KaTeX + DOMPurify
```

### 6. Side Panel (`sidepanel/index.js`)
**Role**: Extended analysis tools

**Responsibilities**:
- Additional analysis features
- Extended user controls
- Settings management
- Enhanced visualization

## Data Flow Architecture

```
1. User visits webpage with math problems
   ↓
2. Background Script detects tab event
   ↓
3. Content Extraction Script processes webpage
   ↓
4. Background Script checks cache (chrome.storage.local)
   ↓
5a. If cached: Send results to Content Script
   ↓
5b. If not cached: Send to Offscreen Document
   ↓
6. Offscreen Document processes with LanguageModel API
   ↓
7. Background Script receives AI response
   ↓
8. Background Script stores results in cache
   ↓
9. Background Script sends results to Content Script
   ↓
10. Content Script renders analysis in floating panel
    ↓
11. User sees formatted analysis with LaTeX rendering
```

## API Integration

### Chrome Extension APIs
```javascript
chrome.scripting.executeScript()  // Inject content extraction
chrome.scripting.insertCSS()      // Inject UI styles
chrome.tabs.onActivated()         // Tab event handling
chrome.tabs.onUpdated()           // Page load events
chrome.storage.local              // Persistent cache
chrome.storage.session            // Temporary data
chrome.runtime.sendMessage()      // Inter-component communication
chrome.offscreen.createDocument() // AI processing
chrome.sidePanel.setPanelBehavior() // Side panel management
```

### Web APIs
```javascript
LanguageModel.create()            // Chrome's on-device AI
LanguageModel.prompt()            // AI analysis processing
DOMPurify.sanitize()              // HTML sanitization
marked.parse()                    // Markdown processing
katex.renderToString()            // LaTeX rendering
```

## Storage Architecture

### Local Storage (Persistent)
```javascript
chrome.storage.local = {
  "analysis_<url>": {
    status: "completed" | "analyzing" | "error",
    content: "markdown analysis result",
    timestamp: 1234567890,
    url: "https://example.com"
  }
}
```

### Session Storage (Temporary)
```javascript
chrome.storage.session = {
  pageContent: "extracted markdown",
  pageUrl: "https://example.com",
  pageTitle: "Page Title"
}
```

## Message Flow

### Background ↔ Content Script
```javascript
// Background → Content
{ action: 'showLoading' }
{ action: 'showAnalysis', result: 'markdown content' }
{ action: 'showError', error: 'error message' }

// Content → Background
{ action: 'contentScriptReady' }
{ action: 'reanalyzeTab' }
```

### Background ↔ Offscreen
```javascript
// Background → Offscreen
{ action: 'analyzeQuestion', content: 'markdown content' }

// Offscreen → Background
{ success: true, result: 'analysis result' }
{ success: false, error: 'error message' }
```

## Security Architecture

### Content Sanitization
- All HTML content sanitized with DOMPurify
- No external script execution
- Safe LaTeX rendering with KaTeX

### Data Privacy
- Local processing only (no external API calls)
- On-device AI using Chrome's LanguageModel API
- User data stays on device
- No data transmission to external servers

### Error Handling
- Graceful degradation on AI failures
- Fallback rendering for LaTeX errors
- Robust message passing with timeouts
- Comprehensive error logging

## Performance Optimizations

### Caching Strategy
- Analysis results cached for 1 hour
- Prevents redundant AI processing
- Improves user experience on tab switches

### Memory Management
- Offscreen document lifecycle management
- Content script cleanup on tab removal
- Storage cleanup for old results

### Rendering Optimization
- Shared rendering utilities
- Efficient LaTeX processing
- Minimal DOM manipulation
- Lazy loading of heavy components

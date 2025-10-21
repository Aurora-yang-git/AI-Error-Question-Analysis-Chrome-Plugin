# Code Structure Overview

## Project Organization

```
错题插件/
├── 📁 Core Extension Files
│   ├── manifest.json              # Extension configuration
│   ├── background.js              # Background service worker
│   └── package.json               # Dependencies and scripts
│
├── 📁 Content Scripts
│   ├── content/
│   │   ├── analyzer-ui.js         # Main UI content script
│   │   └── analyzer-ui.css        # UI styling
│   └── scripts/
│       └── extract-content.js     # Content extraction logic
│
├── 📁 AI Processing
│   └── offscreen/
│       ├── offscreen.html         # Offscreen document HTML
│       └── offscreen.js           # AI model integration
│
├── 📁 Side Panel
│   └── sidepanel/
│       ├── index.html             # Side panel HTML
│       ├── index.js               # Side panel logic
│       └── index.css              # Side panel styling
│
├── 📁 Shared Utilities
│   └── utils/
│       └── markdown-renderer.js   # Markdown & LaTeX rendering
│
├── 📁 Assets
│   └── images/                    # Extension icons
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
│
├── 📁 Build Configuration
│   ├── rollup.config.mjs          # Build configuration
│   └── dist/                      # Built files (generated)
│
└── 📁 Documentation
    ├── README.md                  # User guide
    ├── TECHNICAL_DOCS.md          # Technical documentation
    └── ARCHITECTURE.md            # System architecture
```

## File Responsibilities

### Core Extension Files
- **`manifest.json`**: Defines extension permissions, content scripts, and metadata
- **`background.js`**: Central orchestrator handling tab events, content extraction, and AI coordination
- **`package.json`**: Manages dependencies and build scripts

### Content Scripts
- **`content/analyzer-ui.js`**: Main UI component that creates floating analysis panel
- **`content/analyzer-ui.css`**: Styling for the floating analysis panel
- **`scripts/extract-content.js`**: Extracts and processes webpage content using Defuddle

### AI Processing
- **`offscreen/offscreen.js`**: Handles AI model interactions using Chrome's LanguageModel API
- **`offscreen/offscreen.html`**: Required HTML file for offscreen document

### Side Panel
- **`sidepanel/index.js`**: Extended analysis tools and controls
- **`sidepanel/index.html`**: Side panel interface
- **`sidepanel/index.css`**: Side panel styling

### Shared Utilities
- **`utils/markdown-renderer.js`**: Centralized Markdown and LaTeX rendering logic

## Key Dependencies

### Core Libraries
```json
{
  "defuddle": "^0.6.6",           // Content extraction
  "turndown": "^7.2.0",           // HTML to Markdown
  "turndown-plugin-gfm": "^1.0.2", // GitHub Flavored Markdown
  "marked": "14.1.2",             // Markdown parsing
  "katex": "^0.16.9",             // LaTeX rendering
  "dompurify": "3.2.4"            // HTML sanitization
}
```

### Build Tools
```json
{
  "rollup": "4.22.4",                    // Module bundler
  "@rollup/plugin-node-resolve": "15.2.3", // Node module resolution
  "@rollup/plugin-commonjs": "26.0.1",   // CommonJS support
  "rollup-plugin-copy": "3.5.0"          // File copying
}
```

## Build Process

### Input Files
- `sidepanel/index.js` → `dist/sidepanel/index.js`
- `content/analyzer-ui.js` → `dist/content/analyzer-ui.js`
- `scripts/extract-content.js` → `dist/scripts/extract-content.js`
- `offscreen/offscreen.js` → `dist/offscreen/offscreen.js`

### Static Assets
- `manifest.json` → `dist/manifest.json`
- `background.js` → `dist/background.js`
- `images/` → `dist/images/`
- `content/analyzer-ui.css` → `dist/content/analyzer-ui.css`
- `sidepanel/index.html` → `dist/sidepanel/index.html`
- `sidepanel/index.css` → `dist/sidepanel/index.css`
- `offscreen/offscreen.html` → `dist/offscreen/offscreen.html`
- `utils/markdown-renderer.js` → `dist/utils/markdown-renderer.js`
- `node_modules/katex/dist/katex.min.css` → `dist/node_modules/katex/dist/katex.min.css`

## Code Quality Features

### Error Handling
- Comprehensive try-catch blocks
- Graceful degradation on failures
- Detailed error logging
- User-friendly error messages

### Performance Optimizations
- Smart caching with 1-hour expiration
- Lazy loading of heavy components
- Efficient DOM manipulation
- Memory cleanup on tab removal

### Security Measures
- HTML sanitization with DOMPurify
- No external API calls
- Local processing only
- Safe LaTeX rendering

### Maintainability
- Modular architecture
- Shared utilities for consistency
- Clear separation of concerns
- Comprehensive documentation

## Development Workflow

1. **Development**: Edit source files in respective directories
2. **Build**: Run `npm run build` to generate `dist/` folder
3. **Testing**: Load `dist/` folder as unpacked extension in Chrome
4. **Debugging**: Use Chrome DevTools for background script and content script debugging
5. **Deployment**: Package `dist/` folder for Chrome Web Store submission

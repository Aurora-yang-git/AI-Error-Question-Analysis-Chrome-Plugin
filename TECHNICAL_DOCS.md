# Technical Documentation

## Problem Statement

Students and learners often encounter complex mathematical problems on educational websites but lack immediate access to detailed explanations and step-by-step solutions. Traditional approaches require manual copying of problems to external AI tools, which is time-consuming and disrupts the learning flow. Additionally, mathematical formulas and LaTeX expressions need proper rendering to be truly helpful for understanding.

## Solution Overview

The Question Analyzer Chrome extension addresses this problem by automatically analyzing mathematical questions directly on webpages and providing instant, detailed explanations. The extension uses Chrome's on-device AI capabilities to process content locally, ensuring privacy while delivering educational value.

## Key Features

### 1. Automatic Question Analysis
- **Real-time Processing**: Automatically detects and analyzes mathematical questions as users browse educational websites
- **Intelligent Content Extraction**: Uses advanced parsing to extract clean, structured content from complex webpages
- **AI-Powered Explanations**: Provides detailed analysis including correct answers, common mistakes, and key concepts

### 2. Mathematical Formula Rendering
- **LaTeX Support**: Properly renders mathematical expressions using KaTeX
- **Inline and Display Math**: Supports both inline formulas ($...$) and display equations ($$...$$)
- **Cross-Platform Compatibility**: Ensures formulas display correctly across different websites

### 3. Persistent Analysis Results
- **Smart Caching**: Stores analysis results locally to avoid redundant processing
- **Tab Persistence**: Analysis results remain visible when switching between tabs
- **Efficient Resource Usage**: Only re-analyzes when content changes or cache expires

### 4. User-Friendly Interface
- **Floating Panel**: Non-intrusive analysis display that doesn't interfere with webpage content
- **Interactive Controls**: Minimize, reload, and close functionality for better user experience
- **Responsive Design**: Adapts to different screen sizes and website layouts

## Chrome Extension APIs Used

### Core Extension APIs
- **`chrome.scripting`**: Injects content extraction and UI scripts into webpages
- **`chrome.tabs`**: Monitors tab events and manages tab-specific state
- **`chrome.storage`**: Persists analysis results and user data locally
- **`chrome.runtime`**: Handles message passing between extension components
- **`chrome.offscreen`**: Manages offscreen document for AI processing
- **`chrome.sidePanel`**: Provides additional analysis tools in Chrome's side panel

### Web APIs
- **`LanguageModel`**: Chrome's on-device AI API for question analysis
- **`DOMPurify`**: Sanitizes HTML content for security
- **`marked`**: Converts Markdown to HTML with custom LaTeX support
- **`KaTeX`**: Renders mathematical formulas and expressions

## Technical Architecture

### Background Script (`background.js`)
Orchestrates the entire analysis workflow by:
- Extracting webpage content using `chrome.scripting.executeScript`
- Injecting the analyzer UI and CSS into pages
- Managing cache with `chrome.storage.local` for persistence
- Coordinating with offscreen document for AI processing
- Handling tab events and ensuring seamless user experience

### Content Script (`content/analyzer-ui.js`)
Provides the user interface by:
- Creating and managing the floating analysis panel
- Handling messages from the background script
- Rendering Markdown content with LaTeX support
- Managing panel state (minimize, close, reload functionality)

### Offscreen Document (`offscreen/offscreen.js`)
Handles AI model interactions by:
- Integrating with Chrome's `LanguageModel` API
- Processing analysis prompts and generating responses
- Managing AI session lifecycle and error handling

### Content Extraction (`scripts/extract-content.js`)
Extracts clean content from webpages by:
- Using Defuddle library for intelligent content parsing
- Converting HTML to Markdown using Turndown
- Preserving LaTeX formulas and mathematical expressions
- Cleaning and formatting content for optimal AI processing

### Shared Utilities (`utils/markdown-renderer.js`)
Ensures consistent rendering by:
- Configuring Marked.js for LaTeX support
- Integrating KaTeX for mathematical formula rendering
- Applying DOMPurify sanitization for security
- Providing cross-component rendering consistency

## Data Flow

1. **Page Load**: Background script detects tab activation/update
2. **Content Extraction**: Executes extraction script to get clean content
3. **UI Injection**: Injects analyzer UI and CSS into the page
4. **Cache Check**: Checks for existing analysis results
5. **AI Processing**: If no cache, sends content to offscreen document
6. **Result Display**: Shows analysis results in floating panel
7. **Persistence**: Stores results in `chrome.storage.local`

## Dependencies

### Core Libraries
- **Defuddle**: Content extraction and cleaning
- **Turndown**: HTML to Markdown conversion
- **Marked**: Markdown parsing and rendering
- **KaTeX**: Mathematical formula rendering
- **DOMPurify**: HTML sanitization

## Security & Privacy

- **Local Processing**: All AI analysis happens on-device using Chrome's LanguageModel API
- **No External Calls**: No data is sent to external servers
- **Content Sanitization**: All HTML content is sanitized with DOMPurify
- **Data Persistence**: Analysis results are stored locally using Chrome's storage APIs

## Build Process

The extension uses Rollup for bundling:

```bash
npm run build
```

Built files are output to the `dist` folder for Chrome extension installation.

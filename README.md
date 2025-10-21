# Question Analyzer

A Chrome extension that automatically analyzes mathematical questions on webpages and provides detailed explanations using AI.

## Features

- **Automatic Analysis**: Analyzes questions as soon as you visit a webpage
- **Persistent Results**: Analysis results are cached and persist across tab switches
- **Mathematical Rendering**: Properly renders LaTeX formulas and mathematical expressions
- **Floating Panel**: Displays analysis results in a convenient floating panel on the page
- **Side Panel**: Additional analysis tools available in the Chrome side panel

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `dist` folder
5. The extension will be installed and ready to use

## Usage

1. **Automatic Analysis**: Simply visit any webpage with mathematical questions
2. **View Results**: Analysis results appear in a floating panel in the bottom-right corner
3. **Switch Tabs**: Results persist when you switch between tabs
4. **Side Panel**: Click the extension icon to open additional tools

## Requirements

- Chrome 138 or higher
- Gemini Nano enabled in `chrome://flags`

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# The built extension will be in the `dist` folder
```

## Privacy

This extension processes webpage content locally using Chrome's on-device AI capabilities. No data is sent to external servers.
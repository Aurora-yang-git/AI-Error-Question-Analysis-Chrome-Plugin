/* global chrome */

// Prevent double injection
if (window.qaAnalyzerLoaded) {
  console.log('[QA Analyzer] Already loaded, skipping...');
  // Exit early to prevent double injection
  throw new Error('QA Analyzer already loaded');
}

// Mark as loaded
window.qaAnalyzerLoaded = true;

import { renderMarkdownWithLatex, renderLatexInElement } from '../utils/markdown-renderer.js';

const PANEL_ID = 'qa-analyzer-panel';
const CONTAINER_ID = 'qa-analyzer-container';

// Immediate execution log
console.log('[QA Analyzer] ===== SCRIPT EXECUTING =====');
console.log('[QA Analyzer] Location:', window.location.href);
console.log('[QA Analyzer] Chrome runtime:', !!chrome.runtime);
console.log('QA Analyzer: Content script loaded');

class AnalyzerUI {
  constructor() {
    this.panel = null;
    this.isMinimized = false;
    this.currentUrl = window.location.href;
    this.initPanel();
    this.setupMessageListener();
    this.checkStoredAnalysis();
    this.notifyBackgroundReady();
  }
  
  notifyBackgroundReady() {
    // Notify background that content script is ready
    console.log('QA Analyzer: Notifying background that content script is ready');
    chrome.runtime.sendMessage({ action: 'contentScriptReady' }).catch(err => {
      console.log('QA Analyzer: Could not notify background:', err.message);
    });
  }

  initPanel() {
    // Check if panel already exists
    const existingContainer = document.getElementById(CONTAINER_ID);
    if (existingContainer) {
      console.log('QA Analyzer: Panel already exists');
      this.panel = existingContainer.querySelector(`#${PANEL_ID}`);
      console.log('QA Analyzer: Found existing panel:', !!this.panel);
      if (this.panel) {
        this.setupEventListeners();
      } else {
        console.error('QA Analyzer: Container exists but panel not found!');
      }
      return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    
    // Create panel
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="qa-header">
        <span class="qa-title">🔍 Question Analysis</span>
        <div class="qa-buttons">
          <button class="qa-btn qa-minimize" title="Minimize">−</button>
          <button class="qa-btn qa-reload" title="Re-analyze">↻</button>
          <button class="qa-btn qa-close" title="Close">×</button>
        </div>
      </div>
      <div class="qa-content">
        <div class="qa-loading" style="display: none;">
          <div class="qa-spinner"></div>
          <p>Analyzing question...</p>
        </div>
        <div class="qa-result" style="display: none;"></div>
        <div class="qa-error" style="display: none;"></div>
      </div>
    `;

    container.appendChild(panel);
    document.body.appendChild(container);
    
    this.panel = panel;
    this.setupEventListeners();
    
    console.log('QA Analyzer: Panel initialized');
  }

  setupEventListeners() {
    const minimizeBtn = this.panel.querySelector('.qa-minimize');
    const reloadBtn = this.panel.querySelector('.qa-reload');
    const closeBtn = this.panel.querySelector('.qa-close');

    minimizeBtn.addEventListener('click', () => this.toggleMinimize());
    reloadBtn.addEventListener('click', () => this.reanalyze());
    closeBtn.addEventListener('click', () => this.close());
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('QA Analyzer: Received message:', request.action);
      console.log('QA Analyzer: Message data:', request);
      
      if (request.action === 'showLoading') {
        console.log('QA Analyzer: Showing loading state');
        this.showLoading();
        sendResponse({ success: true });
      } else if (request.action === 'showAnalysis') {
        console.log('QA Analyzer: Showing analysis, length:', request.result ? request.result.length : 0);
        this.showAnalysis(request.result);
        sendResponse({ success: true });
      } else if (request.action === 'showError') {
        console.log('QA Analyzer: Showing error:', request.error);
        this.showError(request.error);
        sendResponse({ success: true });
      }
      
      return true;
    });
  }

  async checkStoredAnalysis() {
    // Check if there's a stored analysis for this URL
    const key = `analysis_${this.currentUrl}`;
    try {
      const result = await chrome.storage.local.get(key);
      if (result[key]) {
        const data = result[key];
        console.log('QA Analyzer: Found stored analysis, status:', data.status);
        
        // Check if it's recent (within 1 hour)
        const age = Date.now() - data.timestamp;
        if (age < 60 * 60 * 1000) {
          if (data.status === 'completed') {
            this.showAnalysis(data.content);
          } else if (data.status === 'analyzing') {
            this.showLoading();
            // Check again in a few seconds
            setTimeout(() => this.checkStoredAnalysis(), 3000);
          } else if (data.status === 'error') {
            this.showError(data.error);
          }
        } else {
          console.log('QA Analyzer: Stored analysis is too old, ignoring');
        }
      } else {
        console.log('QA Analyzer: No stored analysis found for this URL');
      }
    } catch (error) {
      console.error('QA Analyzer: Error checking stored analysis:', error);
    }
  }

  showLoading() {
    if (!this.panel) {
      console.error('QA Analyzer: Panel not initialized');
      return;
    }
    
    const loading = this.panel.querySelector('.qa-loading');
    const result = this.panel.querySelector('.qa-result');
    const error = this.panel.querySelector('.qa-error');
    
    loading.style.display = 'block';
    result.style.display = 'none';
    error.style.display = 'none';
    
    this.show();
  }

  showAnalysis(markdown) {
    console.log('QA Analyzer: Showing analysis, length:', markdown.length);
    
    if (!this.panel) {
      console.error('QA Analyzer: Panel not initialized');
      return;
    }
    
    const loading = this.panel.querySelector('.qa-loading');
    const result = this.panel.querySelector('.qa-result');
    const error = this.panel.querySelector('.qa-error');
    
    loading.style.display = 'none';
    error.style.display = 'none';
    
    // Use shared renderer for consistent LaTeX rendering
    try {
      const html = renderMarkdownWithLatex(markdown);
      result.innerHTML = html;
      result.style.display = 'block';
      
      // Additional LaTeX rendering for any missed formulas
      renderLatexInElement(result);
    } catch (e) {
      console.error('QA Analyzer: Error rendering markdown:', e);
      result.textContent = markdown;
      result.style.display = 'block';
    }
    
    this.show();
  }

  showError(message) {
    if (!this.panel) {
      console.error('QA Analyzer: Panel not initialized');
      return;
    }
    
    const loading = this.panel.querySelector('.qa-loading');
    const result = this.panel.querySelector('.qa-result');
    const error = this.panel.querySelector('.qa-error');
    
    loading.style.display = 'none';
    result.style.display = 'none';
    
    error.textContent = message;
    error.style.display = 'block';
    
    this.show();
  }

  show() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
      container.style.display = 'block';
    }
  }

  hide() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
      container.style.display = 'none';
    }
  }

  close() {
    this.hide();
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    const content = this.panel.querySelector('.qa-content');
    const minimizeBtn = this.panel.querySelector('.qa-minimize');
    
    if (this.isMinimized) {
      content.style.display = 'none';
      minimizeBtn.textContent = '+';
    } else {
      content.style.display = 'block';
      minimizeBtn.textContent = '−';
    }
  }

  reanalyze() {
    console.log('QA Analyzer: Re-analyze requested');
    this.showLoading();
    chrome.runtime.sendMessage({ action: 'reanalyzeTab' });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const ui = new AnalyzerUI();
    ui.notifyBackgroundReady();
  });
} else {
  const ui = new AnalyzerUI();
  ui.notifyBackgroundReady();
}


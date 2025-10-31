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
    this.isSaved = false;
    this.initPanel();
    this.setupMessageListener();
    this.checkStoredAnalysis();
    this.notifyBackgroundReady();
    this.checkRecommendedAnalysis();
  }
  
  getCurrentUrl() {
    return window.location.href;
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
      <div class="qa-toast" style="display:none"></div>
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
        if (request.subject) this.updateHeaderSubject(request.subject);
        this.showLoading();
        sendResponse({ success: true });
      } else if (request.action === 'showAnalysis') {
        console.log('QA Analyzer: Showing analysis, length:', request.result ? request.result.length : 0);
        if (request.subject) this.updateHeaderSubject(request.subject);
        this.showAnalysis(request.result);
        sendResponse({ success: true });
      } else if (request.action === 'showError') {
        console.log('QA Analyzer: Showing error:', request.error);
        this.showError(request.error);
        sendResponse({ success: true });
      } else if (request.action === 'hidePanel') {
        console.log('QA Analyzer: Hiding panel');
        this.hide();
        sendResponse({ success: true });
      }
      
      return true;
    });
  }

  async checkStoredAnalysis() {
    // Check if there's a stored analysis for this URL
    const key = `analysis_${this.getCurrentUrl()}`;
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
    const reloadBtn = this.panel.querySelector('.qa-reload');
    
    loading.style.display = 'block';
    result.style.display = 'none';
    error.style.display = 'none';
    if (reloadBtn) {
      reloadBtn.disabled = true;
      reloadBtn.textContent = '⏳';
      reloadBtn.title = 'Analyzing…';
    }
    
    this.show();
  }

  showAnalysis(markdown, fromCommunity = false) {
    console.log('QA Analyzer: Showing analysis, length:', markdown.length);
    
    if (!this.panel) {
      console.error('QA Analyzer: Panel not initialized');
      return;
    }
    
    const loading = this.panel.querySelector('.qa-loading');
    const result = this.panel.querySelector('.qa-result');
    const error = this.panel.querySelector('.qa-error');
    const reloadBtn = this.panel.querySelector('.qa-reload');
    
    loading.style.display = 'none';
    error.style.display = 'none';
    if (reloadBtn) {
      reloadBtn.disabled = false;
      reloadBtn.textContent = '↻';
      reloadBtn.title = 'Re-analyze';
    }
    
    // Parse and display analysis with misconception focus
    try {
      const analysisData = this.parseAnalysis(markdown);
      const html = this.buildAnalysisHTML(analysisData, markdown);
      
      // Set HTML content first
      result.innerHTML = html;
      result.style.display = 'block';
      
      // Then render LaTeX in the entire result element
      renderLatexInElement(result);
      
      // Setup feedback button handlers
      this.setupFeedbackButtons();
      // Special cases from model outputs →转为友好提示
      if (markdown && markdown.trim() === 'This is not a question.') {
        this.renderStatusAlert('neutral', 'No question detected', 'Try selecting the full question on the page and click re-analyze.');
      } else if (markdown && markdown.trim().startsWith('Nice work!')) {
        this.renderStatusAlert('success', 'Analysis complete', 'Your answer is correct. You can try another question.');
      }
    } catch (e) {
      console.error('QA Analyzer: Error rendering markdown:', e);
      result.textContent = markdown;
      result.style.display = 'block';
    }
    
    this.show();
  }
  
  parseAnalysis(markdown) {
    const analysis = {
      studentAnswer: null,
      correctAnswer: null,
      misconception: null,
      stepByStep: [],
      knowledgePoints: [],
      fullText: markdown
    };
    
    // Extract structured data from markdown
    const studentAnswerMatch = markdown.match(/\*\*Student Answer\*\*:\s*([^\n]+)/);
    if (studentAnswerMatch) {
      analysis.studentAnswer = studentAnswerMatch[1].trim();
    }
    
    const correctAnswerMatch = markdown.match(/\*\*Correct Answer\*\*:\s*([^\n]+)/);
    if (correctAnswerMatch) {
      analysis.correctAnswer = correctAnswerMatch[1].trim();
    }
    
    const misconceptionMatch = markdown.match(/\*\*Misconception\*\*:\s*([^\n]+)/);
    if (misconceptionMatch) {
      analysis.misconception = misconceptionMatch[1].trim();
    }
    
    // Extract knowledge points
    const kpMatch = markdown.match(/\*\*Knowledge Points?\*\*:\s*([^\n]+)/);
    if (kpMatch) {
      analysis.knowledgePoints = kpMatch[1].split(',').map(kp => kp.trim());
    }
    
    return analysis;
  }
  
  buildAnalysisHTML(analysisData, fullMarkdown) {
    let html = '';
    
    // Add misconception highlight if present
    if (analysisData.misconception) {
      html += `<div class="qa-misconception-box">
        <div class="qa-misconception-label">💡 Misconception Identified</div>
        <div class="qa-misconception-text">${analysisData.misconception}</div>
      </div>`;
    }
    
    // Add knowledge points as tags
    if (analysisData.knowledgePoints && analysisData.knowledgePoints.length > 0) {
      html += '<div class="qa-knowledge-points">';
      html += '<span class="qa-label">Topics:</span>';
      analysisData.knowledgePoints.forEach(kp => {
        html += `<span class="qa-tag">${kp}</span>`;
      });
      html += '</div>';
    }
    
    // Remove already displayed structured data from markdown to avoid duplication
    let cleanedMarkdown = fullMarkdown;
    
    // Remove Student Answer section
    cleanedMarkdown = cleanedMarkdown.replace(/\*\*Student Answer\*\*:\s*[^\n]+\n?/g, '');
    
    // Remove Correct Answer section
    cleanedMarkdown = cleanedMarkdown.replace(/\*\*Correct Answer\*\*:\s*[^\n]+\n?/g, '');
    
    // Remove Misconception section
    if (analysisData.misconception) {
      cleanedMarkdown = cleanedMarkdown.replace(/\*\*Misconception\*\*:\s*[^\n]+\n?/g, '');
    }
    
    // Remove Knowledge Points section
    if (analysisData.knowledgePoints && analysisData.knowledgePoints.length > 0) {
      cleanedMarkdown = cleanedMarkdown.replace(/\*\*Knowledge Points?\*\*:\s*[^\n]+\n?/g, '');
    }
    
    // Clean up extra whitespace and empty lines
    cleanedMarkdown = cleanedMarkdown.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    
    // Only render remaining content if there's anything left
    if (cleanedMarkdown && cleanedMarkdown.length > 10) {
      html += '<div class="qa-full-analysis">';
      const fullHtml = renderMarkdownWithLatex(cleanedMarkdown);
      html += fullHtml;
      html += '</div>';
    }
    
    // Add feedback and save buttons
    html += `<div class="qa-feedback-section">
      <div class="qa-action-buttons">
        <button class="qa-feedback-btn qa-up" title="Helpful">
          👍
        </button>
        <button class="qa-feedback-btn qa-down" title="Not helpful">
          👎
        </button>
        <button class="qa-save-btn"><span class="star-icon">☆</span> Save</button>
      </div>
    </div>`;
    
    return html;
  }
  
  setupFeedbackButtons() {
    const upBtn = this.panel.querySelector('.qa-up');
    const downBtn = this.panel.querySelector('.qa-down');
    const saveBtn = this.panel.querySelector('.qa-save-btn');
    
    if (upBtn) {
      upBtn.addEventListener('click', () => this.handleFeedback(true));
    }
    
    if (downBtn) {
      downBtn.addEventListener('click', () => this.handleFeedback(false));
    }
    
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }
  }
  
  async handleFeedback(isHelpful) {
    console.log('QA Analyzer: Feedback:', isHelpful ? 'helpful' : 'not helpful');
    
    const upBtn = this.panel.querySelector('.qa-up');
    const downBtn = this.panel.querySelector('.qa-down');
    
    if (isHelpful) {
      upBtn.classList.add('qa-active');
      downBtn.classList.remove('qa-active');
    } else {
      downBtn.classList.add('qa-active');
      upBtn.classList.remove('qa-active');
    }
    
    // Send feedback to cloud
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'submitCloudFeedback',
        url: this.getCurrentUrl(),
        isHelpful: isHelpful
      });
      
      if (response.success && response.stats) {
        this.updateFeedbackStats(response.stats);
      }
    } catch (error) {
      console.error('QA Analyzer: Error submitting feedback:', error);
    }
  }
  
  async handleSave() {
    console.log('QA Analyzer: Save misconception requested');
    
    const saveBtn = this.panel.querySelector('.qa-save-btn');
    const starIcon = saveBtn.querySelector('.star-icon');
    
    try {
      const resultDiv = this.panel.querySelector('.qa-result');
      const fullMarkdown = resultDiv ? resultDiv.textContent : '';
      
      const analysisData = this.parseAnalysis(fullMarkdown);
      const pageTitle = document.title;
      const pageUrl = this.getCurrentUrl();
      
      // Save to LOCAL storage only
      const response = await chrome.runtime.sendMessage({
        action: 'saveMisconception',
        url: pageUrl,
        questionTitle: pageTitle,
        studentAnswer: analysisData.studentAnswer,
        correctAnswer: analysisData.correctAnswer,
        misconception: analysisData.misconception,
        knowledgePoints: analysisData.knowledgePoints,
        fullAnalysis: fullMarkdown
      });
      
      if (response && response.success) {
        // Toggle star state
        if (this.isSaved) {
          starIcon.textContent = '☆';
          saveBtn.classList.remove('saved');
          this.isSaved = false;
        } else {
          starIcon.textContent = '★';
          saveBtn.classList.add('saved');
          this.isSaved = true;
        }
        this.toast('Saved successfully!');
      }
    } catch (error) {
      console.error('QA Analyzer: Error saving misconception:', error);
      this.toast('Error saving. Please try again.', true);
    }
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

  updateHeaderSubject(subject) {
    const icon = this.subjectIcon(subject);
    const title = this.panel.querySelector('.qa-title');
    if (title) {
      title.textContent = `${icon} ${subject || 'Unknown Subject'}`;
    }
  }

  subjectIcon(subject) {
    if (!subject) return '📘';
    const s = subject.toLowerCase();
    if (s.includes('physics')) return '🧲';
    if (s.includes('chem')) return '🧪';
    if (s.includes('bio')) return '🧬';
    if (s.includes('calc') || s.includes('precal') || s.includes('stat') || s.includes('math')) return '∑';
    if (s.includes('psych')) return '🧠';
    if (s.includes('cs') || s.includes('computer')) return '💻';
    if (s.includes('econ')) return '💹';
    if (s.includes('english') || s.includes('seminar')) return '📖';
    return '📘';
  }

  renderStatusAlert(variant, title, message) {
    const result = this.panel.querySelector('.qa-result');
    if (!result) return;
    const color = variant === 'success' ? '#16a34a' : variant === 'warning' ? '#f59e0b' : '#0f172a';
    const bg = variant === 'success' ? 'rgba(22,163,74,.08)' : variant === 'warning' ? 'rgba(245,158,11,.10)' : 'rgba(15,23,42,.06)';
    const html = `<div style="border:1px solid ${color}33;background:${bg};color:${color};border-radius:8px;padding:10px 12px;margin:8px 0;">
      <strong>${title}</strong><div style="margin-top:4px;color:inherit;opacity:.9;">${message}</div>
    </div>`;
    result.insertAdjacentHTML('afterbegin', html);
  }

  toast(text, isError = false) {
    const t = this.panel.querySelector('.qa-toast');
    if (!t) return;
    t.textContent = text;
    t.style.display = 'block';
    t.style.position = 'absolute';
    t.style.bottom = '12px';
    t.style.left = '50%';
    t.style.transform = 'translateX(-50%)';
    t.style.background = isError ? '#ef4444' : 'var(--primary-color)';
    t.style.color = '#fff';
    t.style.padding = '8px 12px';
    t.style.borderRadius = '8px';
    t.style.boxShadow = '0 4px 12px rgba(0,0,0,.15)';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.style.display = 'none'; }, 1600);
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
  
  async checkRecommendedAnalysis() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'checkRecommendedAnalysis',
        url: this.getCurrentUrl()
      });
      
      if (response.success && response.analysis) {
        console.log('QA Analyzer: Found community recommendation');
        this.showAnalysis(response.analysis.content, true); // true = from community
        this.showCommunityBadge(response.analysis);
      } else {
        console.log('QA Analyzer: No community recommendation available');
      }
    } catch (error) {
      console.log('QA Analyzer: Error checking recommendations:', error.message);
    }
  }
  
  showCommunityBadge(analysis) {
    const total = analysis.helpful_count + analysis.not_helpful_count;
    const badge = `<div class="qa-community-badge">
      ⭐ Community Recommended
      <span class="qa-feedback-stats">${analysis.helpful_count} of ${total} found helpful</span>
    </div>`;
    
    const result = this.panel.querySelector('.qa-result');
    if (result) {
      result.insertAdjacentHTML('afterbegin', badge);
    }
  }
  
  updateFeedbackStats(stats) {
    const statsDiv = this.panel.querySelector('.qa-feedback-stats');
    if (statsDiv && stats) {
      statsDiv.textContent = `${stats.helpful_count} of ${stats.total} found helpful`;
    }
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


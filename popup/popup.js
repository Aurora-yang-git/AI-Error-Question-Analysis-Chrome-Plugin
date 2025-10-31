/* global chrome */

console.log('Popup script loaded');

class PopupController {
  constructor() {
    this.autoScanToggle = document.getElementById('autoScanToggle');
    this.analyzeBtn = document.getElementById('analyzeBtn');
    this.viewMisconceptionsBtn = document.getElementById('viewMisconceptionsBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.statusSection = document.getElementById('statusSection');
    this.statusText = document.getElementById('statusText');
    
    this.init();
  }
  
  async init() {
    console.log('Initializing popup...');
    
    // Load current settings
    await this.loadSettings();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Check current tab status
    await this.checkCurrentTab();
  }
  
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['autoScanEnabled']);
      this.autoScanToggle.checked = result.autoScanEnabled || false;
      console.log('Loaded auto-scan setting:', this.autoScanToggle.checked);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
  
  setupEventListeners() {
    // Auto-scan toggle
    this.autoScanToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      console.log('Auto-scan toggled:', enabled);
      
      try {
        await chrome.storage.local.set({ autoScanEnabled: enabled });
        
        // Send message to background script
        chrome.runtime.sendMessage({
          action: 'setAutoScanStatus',
          enabled: enabled
        });
        
        // Show feedback
        this.showStatus(enabled ? 'Auto-scan enabled' : 'Auto-scan disabled', 2000);
      } catch (error) {
        console.error('Error saving auto-scan setting:', error);
        this.showStatus('Error saving setting', 2000, 'error');
      }
    });
    
    // Analyze button
    this.analyzeBtn.addEventListener('click', async () => {
      await this.analyzeCurrentQuestion();
    });
    
    // View misconceptions button
    this.viewMisconceptionsBtn.addEventListener('click', () => {
      this.openMisconceptionsPage();
    });
    
    // Settings button
    this.settingsBtn.addEventListener('click', () => {
      this.openSettingsPage();
    });
  }
  
  async checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url || !tab.url.startsWith('http')) {
        this.analyzeBtn.disabled = true;
        this.analyzeBtn.textContent = 'Not on a webpage';
        return;
      }
      
      // Check if this looks like a question page
      const isQuestionPage = this.isQuestionPage(tab.url, tab.title);
      
      if (isQuestionPage) {
        this.analyzeBtn.disabled = false;
        this.analyzeBtn.innerHTML = '<span class="btn-icon">📊</span>Analyze Current Question';
      } else {
        this.analyzeBtn.disabled = false;
        this.analyzeBtn.innerHTML = '<span class="btn-icon">🔍</span>Analyze Page Content';
      }
      
    } catch (error) {
      console.error('Error checking current tab:', error);
      this.analyzeBtn.disabled = true;
      this.analyzeBtn.textContent = 'Error checking page';
    }
  }
  
  isQuestionPage(url, title) {
    // Check for common question/quiz patterns
    const questionPatterns = [
      /question/i,
      /problem/i,
      /quiz/i,
      /test/i,
      /exam/i,
      /practice/i,
      /amc/i,
      /sat/i,
      /act/i,
      /ap/i
    ];
    
    return questionPatterns.some(pattern => 
      pattern.test(url) || pattern.test(title)
    );
  }
  
  async analyzeCurrentQuestion() {
    console.log('Starting analysis...');
    
    try {
      // Disable button and show status + spinner
      this.analyzeBtn.disabled = true;
      this.analyzeBtn.innerHTML = '<span class="spinner" style="margin-right:8px"></span>Analyzing…';
      this.showStatus('Analyzing question...', 0);
      
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      // Send analysis request to background script
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeCurrentTab',
        tabId: tab.id
      });
      
      if (response && response.success) {
        this.showStatus('Analysis started! Check the page for results.', 3000);
        
        // Close popup after a short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        throw new Error(response?.error || 'Analysis failed');
      }
      
    } catch (error) {
      console.error('Analysis error:', error);
      this.showStatus('Analysis failed: ' + error.message, 3000, 'error');
    } finally {
      this.analyzeBtn.disabled = false;
      this.analyzeBtn.innerHTML = '<span class="btn-icon">📊</span>Analyze Current Question';
    }
  }
  
  showStatus(message, duration = 0, type = 'info') {
    this.statusText.textContent = message;
    this.statusSection.style.display = 'block';
    
    // Add type-specific styling
    this.statusSection.className = 'status-section';
    if (type === 'error') {
      this.statusSection.style.borderLeftColor = '#e74c3c';
      this.statusText.style.color = '#e74c3c';
    } else if (type === 'success') {
      this.statusSection.style.borderLeftColor = '#27ae60';
      this.statusText.style.color = '#27ae60';
    } else {
      this.statusSection.style.borderLeftColor = '#667eea';
      this.statusText.style.color = '#667eea';
    }
    
    // Hide after duration if specified
    if (duration > 0) {
      setTimeout(() => {
        this.statusSection.style.display = 'none';
      }, duration);
    }
  }
  
  openMisconceptionsPage() {
    // Open misconceptions page in new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('misconceptions/misconceptions.html')
    });
  }
  
  openSettingsPage() {
    // Open settings page in new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('settings.html')
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

// Handle popup visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Popup became visible, refresh status
    const controller = new PopupController();
  }
});


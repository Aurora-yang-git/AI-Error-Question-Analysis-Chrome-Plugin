chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

let offscreenDocumentCreated = false;
const analyzingTabs = new Set();
const contentScriptReadyTabs = new Set();

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  extractPageContent(activeInfo.tabId);
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only extract content when the page is fully loaded
  if (changeInfo.status === 'complete') {
    extractPageContent(tabId);
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up analyzing state
  analyzingTabs.delete(tabId);
  contentScriptReadyTabs.delete(tabId);
  console.log('Background: Tab', tabId, 'removed, cleaned up state');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'contentScriptReady') {
    const tabId = sender.tab?.id;
    if (tabId) {
      console.log('Background: Content script ready for tab:', tabId);
      contentScriptReadyTabs.add(tabId);
      
      // If there's a pending analysis result, send it now
      const tab = sender.tab;
      if (tab && tab.url) {
        const key = `analysis_${tab.url}`;
        chrome.storage.local.get(key, (result) => {
          if (result[key] && result[key].status === 'completed') {
            console.log('Background: Sending pending analysis to newly ready content script');
            chrome.tabs.sendMessage(tabId, {
              action: 'showAnalysis',
              result: result[key].content
            }).catch(err => console.log('Background: Failed to send pending result:', err.message));
          }
        });
      }
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'reanalyzeTab') {
    const tabId = sender.tab?.id;
    if (tabId) {
      console.log('Background: Re-analyze requested for tab:', tabId);
      chrome.storage.session.get(['pageContent', 'pageUrl'], (data) => {
        if (data.pageContent) {
          triggerAnalysis(tabId, data.pageContent, data.pageUrl);
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }
});

// Function to extract page content
async function extractPageContent(tabId) {
  try {
    console.log('=== Background: Extracting page content for tab:', tabId);
    const tab = await chrome.tabs.get(tabId);
    console.log('Tab URL:', tab.url);
    console.log('Tab title:', tab.title);
    
    // Only process http/https pages
    if (!tab.url || !tab.url.startsWith('http')) {
      console.log('Skipping non-http page');
      chrome.storage.session.set({ 
        pageContent: null,
        pageUrl: null,
        pageTitle: null
      });
      return;
    }
    
    // Execute content extraction script
    console.log('Executing content extraction script...');
    const injection = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['scripts/extract-content.js']
    });
    
    // Save extracted content to session storage
    const content = injection[0].result;
    console.log('Extracted content length:', content ? content.length : 0);
    
    chrome.storage.session.set({ 
      pageContent: content,
      pageUrl: tab.url,
      pageTitle: tab.title
    });
    console.log('Content saved to session storage');
    
    // Inject analyzer UI script and CSS
    try {
      console.log('Injecting analyzer UI...');
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/analyzer-ui.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/analyzer-ui.css']
      });
      
      // Inject KaTeX CSS for LaTeX rendering
      try {
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['node_modules/katex/dist/katex.min.css']
        });
        console.log('KaTeX CSS injected');
      } catch (katexError) {
        console.log('KaTeX CSS injection failed (may not be needed):', katexError.message);
      }
      
      console.log('Analyzer UI injected successfully');
    } catch (injectionError) {
      console.error('Failed to inject analyzer UI:', injectionError);
      // Continue with analysis even if UI injection fails
    }
    
    // Trigger analysis if content was extracted
    if (content) {
      triggerAnalysis(tabId, content, tab.url);
    }
  } catch (error) {
    console.error('Error extracting page content:', error);
    chrome.storage.session.set({ 
      pageContent: null,
      pageUrl: null,
      pageTitle: null
    });
  }
}

// Function to trigger analysis
async function triggerAnalysis(tabId, content, url) {
  // Don't analyze if already analyzing this tab
  if (analyzingTabs.has(tabId)) {
    console.log('Background: Tab', tabId, 'already analyzing, skipping');
    return;
  }
  
  // Check for existing cached analysis first
  const key = `analysis_${url}`;
  const cachedResult = await chrome.storage.local.get(key);
  
  if (cachedResult[key]) {
    const data = cachedResult[key];
    const age = Date.now() - data.timestamp;
    const isRecent = age < 60 * 60 * 1000; // 1 hour
    
    console.log('Background: Found cached analysis, age:', Math.round(age / 1000), 'seconds, recent:', isRecent);
    
    if (isRecent && data.status === 'completed') {
      console.log('Background: Using cached analysis result');
      
      // Wait for content script to be ready
      const startTime = Date.now();
      while (!contentScriptReadyTabs.has(tabId) && (Date.now() - startTime) < 2000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Send cached result to content script
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'showAnalysis',
          result: data.content
        });
        console.log('Background: Sent cached analysis to content script');
        return; // Exit early, no need to analyze
      } catch (error) {
        console.log('Background: Failed to send cached result, will re-analyze:', error.message);
        // Continue to fresh analysis
      }
    } else if (isRecent && data.status === 'analyzing') {
      console.log('Background: Analysis already in progress, skipping');
      return;
    } else if (isRecent && data.status === 'error') {
      console.log('Background: Cached analysis had error, will re-analyze');
    } else {
      console.log('Background: Cached analysis is too old, will re-analyze');
    }
  }
  
  analyzingTabs.add(tabId);
  
  try {
    // Wait for content script to be ready, or timeout after 2 seconds
    const startTime = Date.now();
    while (!contentScriptReadyTabs.has(tabId) && (Date.now() - startTime) < 2000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (contentScriptReadyTabs.has(tabId)) {
      console.log('Background: Content script is ready');
    } else {
      console.log('Background: Content script not ready after timeout, continuing anyway');
    }
    
    // Notify content script to show loading
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'showLoading' });
      console.log('Background: Sent loading message to content script');
    } catch (error) {
      console.log('Background: Failed to send loading message:', error.message);
    }
    
    // Store analyzing state
    await chrome.storage.local.set({
      [key]: {
        status: 'analyzing',
        timestamp: Date.now(),
        url: url
      }
    });
    
    // Ensure offscreen document exists
    await ensureOffscreenDocument();
    
    // Send analysis request to offscreen document
    console.log('Background: Sending analysis request to offscreen...');
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeQuestion',
      content: content
    });
    
    if (response.success) {
      console.log('Background: Analysis completed successfully');
      
      // Store result
      await chrome.storage.local.set({
        [key]: {
          status: 'completed',
          content: response.result,
          timestamp: Date.now(),
          url: url
        }
      });
      
      // Send result to content script
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'showAnalysis',
          result: response.result
        });
        console.log('Background: Sent analysis result to content script');
      } catch (sendError) {
        console.log('Background: Failed to send to content script, but result is stored:', sendError.message);
        // Content script will load it from storage when ready
      }
    } else {
      throw new Error(response.error || 'Analysis failed');
    }
  } catch (error) {
    console.error('Background: Analysis error:', error);
    
    // Store error state
    const key = `analysis_${url}`;
    await chrome.storage.local.set({
      [key]: {
        status: 'error',
        error: error.message,
        timestamp: Date.now(),
        url: url
      }
    });
    
    // Send error to content script
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'showError',
        error: `Analysis failed: ${error.message}`
      });
    } catch (e) {
      console.log('Background: Content script not available for error message:', e.message);
      // Error is stored, content script will show it when loaded
    }
  } finally {
    analyzingTabs.delete(tabId);
  }
}

// Function to ensure offscreen document exists
async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) {
    return;
  }
  
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
      console.log('Background: Offscreen document already exists');
      offscreenDocumentCreated = true;
      return;
    }
    
    // Create offscreen document
    console.log('Background: Creating offscreen document...');
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'Need DOM context for LanguageModel API to analyze questions'
    });
    
    offscreenDocumentCreated = true;
    console.log('Background: Offscreen document created');
    
    // Wait a bit for it to initialize
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Ping to verify it's ready
    const pingResponse = await chrome.runtime.sendMessage({ action: 'ping' });
    console.log('Background: Offscreen document ready:', pingResponse.ready);
  } catch (error) {
    console.error('Background: Error creating offscreen document:', error);
    offscreenDocumentCreated = false;
    throw error;
  }
}

console.log('Background script loaded');

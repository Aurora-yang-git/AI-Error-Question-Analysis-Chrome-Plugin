import {
  checkRecommendedAnalysis,
  submitFeedback,
  saveAnalysisToCloud,
  getFeedbackStats
} from './utils/supabase-service.js';
import { buildFingerprint, hashString } from './utils/hash.js';

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
          result: result[key].content,
          subject: result[key].subject || detectSubjectFromUrl(tab.url)
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
      
      // Get current tab info
      chrome.tabs.get(tabId, (tab) => {
        if (tab && tab.url) {
          // Clear cache for this URL
          const cacheKey = `analysis_${tab.url}`;
          chrome.storage.local.remove(cacheKey, () => {
            console.log('Background: Cleared cache for:', tab.url);
            
            // Re-extract content and force new analysis
            extractPageContent(tabId, true); // true = forceAnalyze
          });
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'checkRecommendedAnalysis') {
    checkRecommendedAnalysis(request.url)
      .then(analysis => {
        sendResponse({ success: true, analysis });
      })
      .catch(error => {
        console.error('Background: Error checking recommended analysis:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'submitCloudFeedback') {
    submitFeedback(request.url, request.isHelpful)
      .then(stats => {
        sendResponse({ success: true, stats });
      })
      .catch(error => {
        console.error('Background: Error submitting feedback:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'saveAnalysisToCloud') {
    saveAnalysisToCloud(request.url, request.analysisData)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Background: Error saving to cloud:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'saveMisconception') {
    const subject = request.url ? detectSubjectFromUrl(request.url) : 'Unknown';
    const fingerprint = buildFingerprint({
      url: request.url || '',
      title: request.questionTitle || '',
      subject,
      studentAnswer: request.studentAnswer || '',
      correctAnswer: request.correctAnswer || ''
    });
    const analysisHash = hashString(request.fullAnalysis || '');
    const misconception = {
      id: generateId(),
      timestamp: Date.now(),
      url: request.url,
      questionTitle: request.questionTitle,
      studentAnswer: request.studentAnswer,
      correctAnswer: request.correctAnswer,
      misconception: request.misconception,
      knowledgePoints: request.knowledgePoints,
      fullAnalysis: request.fullAnalysis,
      helpfulFeedback: { helpful: 0, notHelpful: 0 },
      subject,
      fingerprint,
      analysisHash,
      count: 1
    };
    
    chrome.storage.local.get(['misconceptions'], (result) => {
      const misconceptions = result.misconceptions || [];
      // Try to find existing by fingerprint
      let merged = false;
      for (let i = 0; i < misconceptions.length; i++) {
        const m = misconceptions[i];
        if (m.fingerprint && m.fingerprint === fingerprint) {
          m.timestamp = Date.now();
          m.count = (m.count || 1) + 1;
          merged = true;
          break;
        }
      }
      // Fallback merge by fullAnalysis hash
      if (!merged && analysisHash) {
        for (let i = 0; i < misconceptions.length; i++) {
          const m = misconceptions[i];
          if (m.analysisHash && m.analysisHash === analysisHash) {
            m.timestamp = Date.now();
            m.count = (m.count || 1) + 1;
            // Ensure fingerprint carried over
            if (!m.fingerprint) m.fingerprint = fingerprint;
            merged = true;
            break;
          }
        }
      }
      if (!merged) {
        misconceptions.push(misconception);
      }
      
      chrome.storage.local.set({ misconceptions }, () => {
        console.log('Background: Misconception saved locally:', misconception.id);
        sendResponse({ success: true, id: misconception.id });
      });
    });
    
    return true;
  }

  if (request.action === 'getMisconceptions') {
    chrome.storage.local.get(['misconceptions'], (result) => {
      sendResponse({ success: true, misconceptions: result.misconceptions || [] });
    });
    return true;
  }

  if (request.action === 'deleteMisconception') {
    chrome.storage.local.get(['misconceptions'], (result) => {
      let misconceptions = result.misconceptions || [];
      misconceptions = misconceptions.filter(m => m.id !== request.id);
      
      chrome.storage.local.set({ misconceptions }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === 'clearAllMisconceptions') {
    chrome.storage.local.set({ misconceptions: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'setAutoScanStatus') {
    console.log('Background: Setting auto-scan status:', request.enabled);
    chrome.storage.local.set({ autoScanEnabled: request.enabled }, () => {
      console.log('Background: Auto-scan status saved:', request.enabled);
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'analyzeCurrentTab') {
    const tabId = request.tabId;
    console.log('Background: Manual analysis requested for tab:', tabId);
    
    if (tabId) {
      chrome.tabs.get(tabId, (tab) => {
        if (tab && tab.url) {
          // Clear cache for this URL
          const cacheKey = `analysis_${tab.url}`;
          chrome.storage.local.remove(cacheKey, () => {
            console.log('Background: Cleared cache for manual analysis:', tab.url);
            
            // Force new analysis
            extractPageContent(tabId, true); // true = forceAnalyze
          });
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }
});

function generateId() {
  return 'misc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Function to extract page content
async function extractPageContent(tabId, forceAnalyze = false) {
  try {
    console.log('=== Background: Extracting page content for tab:', tabId, 'forceAnalyze:', forceAnalyze);
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
    const result = injection[0].result;
    let content, userAnswer, correctAnswer, pageTitle, rationales, explanation;
    
    if (result && typeof result === 'object' && result.content) {
      content = result.content;
      userAnswer = result.userAnswer;
      correctAnswer = result.correctAnswer;
      rationales = result.rationales || [];
      explanation = result.explanation || null;
      pageTitle = result.title || tab.title;
    } else {
      content = result; // Backward compatibility
      userAnswer = null;
      correctAnswer = null;
      rationales = [];
      explanation = null;
      pageTitle = tab.title;
    }
    
    console.log('Extracted content length:', content ? content.length : 0);
    console.log('User answer detected:', userAnswer);
    console.log('Correct answer detected:', correctAnswer);
    console.log('Rationales found:', rationales.length);
    
    chrome.storage.session.set({ 
      pageContent: content,
      pageUrl: tab.url,
      pageTitle: pageTitle,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer,
      rationales: rationales,
      explanation: explanation
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
      // Check auto-scan setting unless forceAnalyze is true
      if (forceAnalyze) {
        console.log('Background: Force analyze requested, proceeding with analysis');
        triggerAnalysis(tabId, content, tab.url, { userAnswer, correctAnswer, rationales, explanation }, forceAnalyze);
      } else {
        chrome.storage.local.get(['autoScanEnabled'], (settings) => {
          const autoScanEnabled = settings.autoScanEnabled !== false; // Default to true
          console.log('Background: Auto-scan setting:', autoScanEnabled);
          
          if (autoScanEnabled) {
            console.log('Background: Auto-scan enabled, triggering analysis');
            triggerAnalysis(tabId, content, tab.url, { userAnswer, correctAnswer, rationales, explanation }, forceAnalyze);
          } else {
            console.log('Background: Auto-scan disabled, skipping analysis');
            // Hide panel when auto-scan is disabled
            chrome.tabs.sendMessage(tabId, {
              action: 'hidePanel'
            }).catch(err => console.log('Failed to hide panel:', err));
          }
        });
      }
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
async function triggerAnalysis(tabId, content, url, context = {}, forceAnalyze = false) {
  const { userAnswer, correctAnswer, rationales, explanation } = context;
  const subject = detectSubjectFromUrl(url);
  // Don't analyze if already analyzing this tab
  if (analyzingTabs.has(tabId)) {
    console.log('Background: Tab', tabId, 'already analyzing, skipping');
    return;
  }
  
  // Check for existing cached analysis first (unless forceAnalyze is true)
  const key = `analysis_${url}`;
  const cachedResult = await chrome.storage.local.get(key);
  
  if (cachedResult[key] && !forceAnalyze) {
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
      const subject = detectSubjectFromUrl(url);
      await chrome.tabs.sendMessage(tabId, { action: 'showLoading', subject });
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
    
    // Send analysis request to offscreen document with context
    console.log('Background: Sending analysis request to offscreen...');
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeQuestion',
      content: content,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer,
      rationales: rationales || [],
      explanation: explanation,
      subject: subject,
      url: url,
      debug: true
    });
    
    if (response.success) {
      console.log('Background: Analysis completed successfully');
      if (response.debug) {
        try {
          console.groupCollapsed('[AI Prompt]', url);
          console.log('Subject:', subject);
          console.log('Student Answer:', userAnswer, 'Correct Answer:', correctAnswer);
          if (response.debug.fields) {
            console.log('A–D Explanations:', {
              A: response.debug.fields.expA,
              B: response.debug.fields.expB,
              C: response.debug.fields.expC,
              D: response.debug.fields.expD
            });
          }
          console.log('--- FULL PROMPT BEGIN ---');
          console.log(response.debug.prompt);
          console.log('--- FULL PROMPT END ---');
          console.groupEnd();
        } catch (e) {
          console.log('Background: Failed to print debug prompt:', e.message);
        }
      }
      
      // Store result
      await chrome.storage.local.set({
        [key]: {
          status: 'completed',
          content: response.result,
          timestamp: Date.now(),
          url: url,
          subject: subject
        }
      });
      
      // Send result to content script
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'showAnalysis',
          result: response.result,
          subject
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

function detectSubjectFromUrl(url) {
  try {
    const match = url && url.match(/apclassroom\.collegeboard\.org\/(\d+)/);
    const id = match ? match[1] : null;
    const map = {
      '7': 'AP Chemistry',
      '8': 'AP Computer Science A',
      '11': 'AP Microeconomics',
      '13': 'AP English Literature and Composition',
      '26': 'AP Calculus BC',
      '29': 'AP Physics C: Mechanics',
      '30': 'AP Psychology',
      '33': 'AP Statistics',
      '78': 'AP Physics C: Electricity and Magnetism',
      '93': 'AP Physics 2',
      '94': 'AP Seminar',
      '103': 'AP Computer Science Principles',
      '117': 'AP Precalculus'
    };
    const subject = id && map[id] ? map[id] : 'Unknown';
    console.log('Background: Detected subject from URL:', id, '=>', subject);
    return subject;
  } catch (e) {
    console.log('Background: Failed to detect subject from URL:', e.message);
    return 'Unknown';
  }
}

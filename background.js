chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

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
    console.log('Content preview:', content ? content.substring(0, 200) : 'null');
    
    chrome.storage.session.set({ 
      pageContent: content,
      pageUrl: tab.url,
      pageTitle: tab.title
    });
    console.log('Content saved to session storage');
  } catch (error) {
    console.error('Error extracting page content:', error);
    chrome.storage.session.set({ 
      pageContent: null,
      pageUrl: null,
      pageTitle: null
    });
  }
}

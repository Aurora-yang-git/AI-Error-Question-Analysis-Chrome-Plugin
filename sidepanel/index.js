/* global LanguageModel */

import DOMPurify from 'dompurify';
import { marked } from 'marked';

const inputPrompt = document.body.querySelector('#input-prompt');
const buttonPrompt = document.body.querySelector('#button-prompt');
const buttonReset = document.body.querySelector('#button-reset');
const elementResponse = document.body.querySelector('#response');
const elementLoading = document.body.querySelector('#loading');
const elementError = document.body.querySelector('#error');
const sliderTemperature = document.body.querySelector('#temperature');
const sliderTopK = document.body.querySelector('#top-k');
const labelTemperature = document.body.querySelector('#label-temperature');
const labelTopK = document.body.querySelector('#label-top-k');
const pageInfoElement = document.body.querySelector('#page-info');
const pageTitleElement = document.body.querySelector('#page-title');
const pageUrlElement = document.body.querySelector('#page-url');

let session;
let pageContent = '';
let pageUrl = '';
let pageTitle = '';

async function runPrompt(prompt, params) {
  try {
    if (!session) {
      session = await LanguageModel.create(params);
    }
    return session.prompt(prompt);
  } catch (e) {
    console.log('Prompt failed');
    console.error(e);
    console.log('Prompt:', prompt);
    // Reset session
    reset();
    throw e;
  }
}

async function reset() {
  if (session) {
    session.destroy();
  }
  session = null;
}

async function initDefaults() {
  const defaults = await LanguageModel.params();
  console.log('Model default:', defaults);
  if (!('LanguageModel' in self)) {
    showResponse('Model not available');
    return;
  }
  sliderTemperature.value = defaults.defaultTemperature;
  // Pending https://issues.chromium.org/issues/367771112.
  // sliderTemperature.max = defaults.maxTemperature;
  if (defaults.defaultTopK > 3) {
    // limit default topK to 3
    sliderTopK.value = 3;
    labelTopK.textContent = 3;
  } else {
    sliderTopK.value = defaults.defaultTopK;
    labelTopK.textContent = defaults.defaultTopK;
  }
  sliderTopK.max = defaults.maxTopK;
  labelTemperature.textContent = defaults.defaultTemperature;
}

initDefaults();

// Get initial page content
chrome.storage.session.get(['pageContent', 'pageUrl', 'pageTitle'], (data) => {
  updatePageContent(data.pageContent, data.pageUrl, data.pageTitle);
});

// Listen for page content changes
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.pageContent || changes.pageUrl || changes.pageTitle) {
    const content = changes.pageContent?.newValue;
    const url = changes.pageUrl?.newValue;
    const title = changes.pageTitle?.newValue;
    updatePageContent(content, url, title);
  }
});

function updatePageContent(content, url, title) {
  pageContent = content || '';
  pageUrl = url || '';
  pageTitle = title || '';
  
  console.log('=== updatePageContent called ===');
  console.log('content type:', typeof content);
  console.log('content value:', content);
  console.log('content length:', content ? content.length : 0);
  console.log('url:', url);
  console.log('title:', title);
  
  // Update UI to display page information
  if (pageContent && pageTitle) {
    pageTitleElement.textContent = pageTitle;
    pageUrlElement.textContent = pageUrl;
    pageInfoElement.removeAttribute('hidden');
  } else {
    pageInfoElement.setAttribute('hidden', '');
  }
  
  console.log('Page content updated:', {
    hasContent: !!pageContent,
    url: pageUrl,
    title: pageTitle,
    contentLength: pageContent.length
  });
}

buttonReset.addEventListener('click', () => {
  hide(elementLoading);
  hide(elementError);
  hide(elementResponse);
  reset();
  buttonReset.setAttribute('disabled', '');
});

sliderTemperature.addEventListener('input', (event) => {
  labelTemperature.textContent = event.target.value;
  reset();
});

sliderTopK.addEventListener('input', (event) => {
  labelTopK.textContent = event.target.value;
  reset();
});

inputPrompt.addEventListener('input', () => {
  if (inputPrompt.value.trim()) {
    buttonPrompt.removeAttribute('disabled');
  } else {
    buttonPrompt.setAttribute('disabled', '');
  }
});

buttonPrompt.addEventListener('click', async () => {
  const prompt = inputPrompt.value.trim();
  showLoading();
  try {
    // Build full prompt with page content
    let fullPrompt = prompt;
    
    console.log('=== Debug Info ===');
    console.log('pageContent length:', pageContent ? pageContent.length : 0);
    console.log('pageTitle:', pageTitle);
    console.log('pageUrl:', pageUrl);
    console.log('Has pageContent:', !!pageContent);
    
    if (pageContent) {
      fullPrompt = `Current webpage information:
Title: ${pageTitle}
URL: ${pageUrl}

Page content:
${pageContent}

User question: ${prompt}`;
      console.log('Full prompt length:', fullPrompt.length);
    } else {
      console.log('No page content available, using prompt only');
    }
    
    const params = {
      initialPrompts: [
        { role: 'system', content: 'You are a helpful and friendly assistant. When webpage content is provided, please answer questions based on that content. ' }
      ],
      temperature: sliderTemperature.value,
      topK: sliderTopK.value,
      outputLanguage: 'en'
    };
    const response = await runPrompt(fullPrompt, params);
    showResponse(response);
  } catch (e) {
    showError(e);
  }
});

function showLoading() {
  buttonReset.removeAttribute('disabled');
  hide(elementResponse);
  hide(elementError);
  show(elementLoading);
}

function showResponse(response) {
  hide(elementLoading);
  show(elementResponse);
  elementResponse.innerHTML = DOMPurify.sanitize(marked.parse(response));
}

function showError(error) {
  show(elementError);
  hide(elementResponse);
  hide(elementLoading);
  elementError.textContent = error;
}

function show(element) {
  element.removeAttribute('hidden');
}

function hide(element) {
  element.setAttribute('hidden', '');
}

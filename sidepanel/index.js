/* global LanguageModel */

import { renderMarkdownWithLatex } from '../utils/markdown-renderer.js';

const buttonReset = document.body.querySelector('#button-reset');
const elementResponse = document.body.querySelector('#response');
const elementLoading = document.body.querySelector('#loading');
const elementError = document.body.querySelector('#error');
const pageInfoElement = document.body.querySelector('#page-info');
const pageTitleElement = document.body.querySelector('#page-title');
const pageUrlElement = document.body.querySelector('#page-url');

let session;
let pageContent = '';
let pageUrl = '';
let pageTitle = '';
let isAnalyzing = false;

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
    showError('Language Model is not available in your browser');
    return;
  }
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
  console.log('content length:', content ? content.length : 0);
  console.log('url:', url);
  console.log('title:', title);
  
  // Update UI to display page information
  if (pageContent && pageTitle) {
    pageTitleElement.textContent = pageTitle;
    pageUrlElement.textContent = pageUrl;
    pageInfoElement.removeAttribute('hidden');
    
    // Automatically analyze when content is updated
    analyzeQuestion();
  } else {
    pageInfoElement.setAttribute('hidden', '');
    showError('No content available to analyze. Please navigate to a webpage with a question.');
  }
}

async function analyzeQuestion() {
  if (isAnalyzing) {
    console.log('Already analyzing, skipping...');
    return;
  }
  
  if (!pageContent) {
    showError('No content available to analyze.');
    return;
  }
  
  isAnalyzing = true;
  showLoading();
  
  try {
    console.log('=== Starting Question Analysis ===');
    console.log('pageContent length:', pageContent.length);
    
    // Build analysis prompt
    const analysisPrompt = `You are an expert tutor analyzing a student's incorrect answer to a question.

IMPORTANT: The webpage may contain multiple questions. Please analyze ONLY THE FIRST QUESTION you find. Ignore any other questions on the page.

Webpage content:
${pageContent}

Please analyze the FIRST QUESTION ONLY and provide:
1. **Question Summary**: Briefly describe what the first question is asking
2. **Student's Answer**: Identify which option the student selected (if mentioned)
3. **Correct Answer**: State the correct answer
4. **Why Student Was Wrong**: Explain the misconception or error in the student's thinking
5. **Detailed Explanation**: Provide a clear, step-by-step explanation of why the correct answer is right
6. **Key Concepts**: List the important concepts the student should understand

If you notice multiple questions on the page, acknowledge this but focus your analysis entirely on the first complete question you identify.

Format your response in clear sections with headers. Be encouraging and educational.`;
    
    console.log('Prompt length:', analysisPrompt.length);
    
    const params = {
      initialPrompts: [
        { role: 'system', content: 'You are an expert tutor who helps students understand their mistakes and learn from them. Provide clear, detailed, and encouraging explanations.' }
      ],
      temperature: 0.7,
      topK: 3,
      outputLanguage: 'en'
    };
    
    const response = await runPrompt(analysisPrompt, params);
    showResponse(response);
  } catch (e) {
    console.error('Analysis failed:', e);
    showError('Failed to analyze the question: ' + e.message);
  } finally {
    isAnalyzing = false;
  }
}

buttonReset.addEventListener('click', () => {
  hide(elementLoading);
  hide(elementError);
  hide(elementResponse);
  reset();
  buttonReset.setAttribute('disabled', '');
  
  // Re-analyze after reset
  if (pageContent) {
    setTimeout(() => analyzeQuestion(), 100);
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
  elementResponse.innerHTML = renderMarkdownWithLatex(response);
  buttonReset.removeAttribute('disabled');
}

function showError(error) {
  show(elementError);
  hide(elementResponse);
  hide(elementLoading);
  elementError.textContent = error;
  buttonReset.setAttribute('disabled', '');
}

function show(element) {
  element.removeAttribute('hidden');
}

function hide(element) {
  element.setAttribute('hidden', '');
}

/* global chrome, LanguageModel */

console.log('Offscreen document loaded');

let session = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeQuestion') {
    console.log('Offscreen: Received analysis request');
    analyzeQuestion(request.content)
      .then(result => {
        console.log('Offscreen: Analysis complete');
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('Offscreen: Analysis error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'ping') {
    sendResponse({ ready: true });
    return true;
  }
});

async function analyzeQuestion(content) {
  try {
    // Check if LanguageModel is available
    if (!('LanguageModel' in self)) {
      throw new Error('LanguageModel API is not available. Please enable Gemini Nano in chrome://flags');
    }

    // Create or reuse session
    if (!session) {
      console.log('Offscreen: Creating AI session...');
      const params = {
        temperature: 0.7,
        topK: 3,
        outputLanguage: 'en'
      };
      session = await LanguageModel.create(params);
      console.log('Offscreen: AI session created');
    }

    // Build concise prompt
    const prompt = `You are analyzing a student's answer to ONE question. Be EXTREMELY CONCISE.

IMPORTANT: Analyze ONLY the FIRST question you find. Max 150 words total.

Webpage content:
${content}

Provide your analysis in this EXACT format (use LaTeX $...$ for math):

**Correct Answer**: [state the correct answer with letter/number]

**Why Wrong**: [one sentence explaining the error]

**Key Concept**: [1-2 sentences with essential formula if needed]

Example format:
**Correct Answer**: B ($\\frac{1}{2}$)
**Why Wrong**: You overcomplicated the probability calculation.
**Key Concept**: For each position 1-9, Flora either lands or doesn't (2 choices). Only position 10 must be landed on, giving $\\frac{2^9}{2^{10}} = \\frac{1}{2}$.

Be direct and concise. Use LaTeX for ALL math expressions.`;

    console.log('Offscreen: Running AI prompt...');
    const result = await session.prompt(prompt);
    console.log('Offscreen: AI response received, length:', result.length);
    
    return result;
  } catch (error) {
    console.error('Offscreen: Error in analyzeQuestion:', error);
    // Reset session on error
    if (session) {
      session.destroy();
      session = null;
    }
    throw error;
  }
}

console.log('Offscreen: Ready to analyze questions');


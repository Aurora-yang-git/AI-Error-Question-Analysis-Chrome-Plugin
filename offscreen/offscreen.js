/* global chrome, LanguageModel */

console.log('Offscreen document loaded');

let session = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeQuestion') {
    console.log('Offscreen: Received analysis request');
    const { content, userAnswer, correctAnswer, rationales, explanation, subject, url, debug } = request;
    analyzeQuestion(content, { userAnswer, correctAnswer, rationales, explanation, subject, url, debug })
      .then(result => {
        console.log('Offscreen: Analysis complete');
        sendResponse(result);
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

async function analyzeQuestion(content, context = {}) {
  const { userAnswer, correctAnswer, rationales, explanation, subject, url, debug } = context;
  
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

    // Build College Board explanations in A-D order
    const expA = rationales && rationales[0] ? rationales[0].rationale : 'None';
    const expB = rationales && rationales[1] ? rationales[1].rationale : 'None';
    const expC = rationales && rationales[2] ? rationales[2].rationale : 'None';
    const expD = rationales && rationales[3] ? rationales[3].rationale : 'None';
    const studentAnswer = userAnswer || 'Not detected';

    // Build prompt with new template
    const prompt = `You are an expert AI tutor analyzing a student's answer to identify and clarify misconceptions in the subject of ${subject}.

Question content:
${content}

College Board Explanation (for reference only):

A: ${expA}
B: ${expB}
C: ${expC}
D: ${expD}

IMPORTANT: - Look for the student's selected answer (checked or highlighted choice). - The student’s answer may be correct or incorrect. - If the content is not a question, respond with: > This is not a question. - If the student’s answer is correct, respond with: > Nice work! No misconception to review. If the student is incorrect, output your analysis in EXACTLY this format (no extra commentary):

**Misconception**: [ONE clear, specific sentence explaining what the student falsely believes AND how to correctly tell or test the difference — focus on conceptual understanding, not procedural error.]  

Guidelines for Misconception: - Be direct, student-facing, and conceptual. - Avoid any mention of “the student thought,” “the student misunderstood,” or “the wrong answer.” - Use comparative or diagnostic phrasing that helps the student distinguish ideas: - “If there were no __, then __ would not happen, so __.” - “__ only occurs when __, not when __.” - “__ does not act on its own; it’s temporarily affected by __.” - Prioritize physical reasoning or testable cues that help students *self-correct* next time. Use LaTeX $...$ for any math expressions.`;

    if (debug) {
      console.log('\n[AI PROMPT BEGIN]\n' + prompt + '\n[AI PROMPT END]\n');
    }

    console.log('Offscreen: Running AI prompt...');
    const result = await session.prompt(prompt);
    console.log('Offscreen: AI response received, length:', result.length);
    
    const response = { success: true, result };
    if (debug) {
      response.debug = {
        prompt,
        fields: {
          subject,
          url,
          studentAnswer,
          correctAnswer,
          expA,
          expB,
          expC,
          expD
        }
      };
    }
    return response;
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


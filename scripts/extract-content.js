import Defuddle from 'defuddle';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

function convertHtmlToMarkdown(htmlContent) {
  console.log('Converting HTML to Markdown...');
  
  // Initialize Turndown service
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    preformattedCode: true,
  });
  
  // Use GitHub Flavored Markdown plugin
  turndownService.use(gfm);
  
  // Custom rule for LaTeX images - extract alt text as LaTeX
  turndownService.addRule('latexImages', {
    filter: function (node) {
      return (
        node.nodeName === 'IMG' &&
        node.getAttribute('alt') &&
        (node.getAttribute('alt').includes('$') || 
         node.getAttribute('alt').includes('\\') ||
         node.getAttribute('src').includes('latex') ||
         node.classList.contains('latex'))
      );
    },
    replacement: function (content, node) {
      const alt = node.getAttribute('alt');
      console.log('Processing LaTeX image:', alt);
      
      // If alt text contains LaTeX, wrap it properly
      if (alt) {
        // Check if it's already wrapped in $ signs
        if (alt.startsWith('$') && alt.endsWith('$')) {
          console.log('Already wrapped LaTeX:', alt);
          return alt;
        }
        // Check if it's a display equation (usually longer or contains specific commands)
        if (alt.length > 50 || alt.includes('\\[') || alt.includes('\\]') || alt.includes('\\frac')) {
          console.log('Display LaTeX:', alt);
          return `$$${alt}$$`;
        }
        // Otherwise treat as inline
        console.log('Inline LaTeX:', alt);
        return `$${alt}$`;
      }
      return '';
    }
  });
  
  // Custom rule for LaTeX spans and divs
  turndownService.addRule('latexElements', {
    filter: function (node) {
      return (
        (node.nodeName === 'SPAN' || node.nodeName === 'DIV') &&
        (node.classList.contains('math') || 
         node.classList.contains('latex') ||
         node.classList.contains('katex') ||
         node.getAttribute('data-latex') ||
         (node.textContent && node.textContent.includes('$')))
      );
    },
    replacement: function (content, node) {
      const text = node.textContent || '';
      const latexAttr = node.getAttribute('data-latex');
      
      if (latexAttr) {
        // Use data-latex attribute if available
        return latexAttr.startsWith('$') ? latexAttr : `$${latexAttr}$`;
      }
      
      if (text.includes('$')) {
        // Text already has $ signs, return as is
        return text;
      }
      
      // Check if it looks like LaTeX (contains backslashes)
      if (text.includes('\\') && (text.includes('frac') || text.includes('sum') || text.includes('int'))) {
        return `$${text}$`;
      }
      
      return text;
    }
  });
  
  // Custom rule to clean up empty links
  turndownService.addRule('emptyLinks', {
    filter: function(node) {
      return node.nodeName === 'A' && !node.textContent.trim();
    },
    replacement: function() {
      return '';
    }
  });
  
  try {
    let markdown = turndownService.turndown(htmlContent);
    
    // Clean up the markdown
    // Remove title if it's at the beginning
    const titleMatch = markdown.match(/^# .+\n+/);
    if (titleMatch) {
      markdown = markdown.slice(titleMatch[0].length);
    }
    
    // Remove consecutive newlines (more than 2)
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    
    // Remove empty markdown links
    markdown = markdown.replace(/\n*(?<!!)\[]\([^)]+\)\n*/g, '');
    
    // Enhanced LaTeX processing
    // First, filter out [asy] blocks that are not LaTeX
    markdown = markdown.replace(/\$\$\[asy\][\s\S]*?\[\/asy\]\$\$/g, '```asy\n$&\n```');
    markdown = markdown.replace(/\$\$\[asy\][\s\S]*?\$\$/g, '```asy\n$&\n```');
    
    // Also handle [asy] blocks that might not be wrapped in $$
    markdown = markdown.replace(/\[asy\][\s\S]*?\[\/asy\]/g, '```asy\n$&\n```');
    markdown = markdown.replace(/\[asy\][\s\S]*?(?=\n\n|\n$|$)/g, '```asy\n$&\n```');
    
    // Find and fix LaTeX formulas that might be broken across lines
    markdown = markdown.replace(/\$\s*\n\s*\$/g, '$$');
    markdown = markdown.replace(/\$\s*\n\s*([^$]+?)\s*\n\s*\$/g, '$$$1$$');
    
    // Fix common LaTeX formatting issues
    markdown = markdown.replace(/\$\s*\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\$/g, '$\\frac{$1}{$2}$');
    markdown = markdown.replace(/\$\s*\\textbf\s*\{([^}]+)\}\s*\$/g, '$\\textbf{$1}$');
    
    // Clean up spaces before/after LaTeX
    markdown = markdown.replace(/\s+(\$+)/g, ' $1');
    markdown = markdown.replace(/(\$+)\s+/g, '$1 ');
    
    // Ensure proper LaTeX wrapping for common patterns
    // Look for unescaped LaTeX patterns and wrap them
    markdown = markdown.replace(/(?<!\$)\\frac\{[^}]+\}\{[^}]+\}(?!\$)/g, '$$$&$');
    markdown = markdown.replace(/(?<!\$)\\textbf\{[^}]+\}(?!\$)/g, '$$$&$');
    markdown = markdown.replace(/(?<!\$)\\qquad(?!\$)/g, '$$$&$');
    
    console.log('LaTeX processing completed');
    console.log('Markdown preview after LaTeX processing:', markdown.substring(0, 500));
    
    return markdown.trim();
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error);
    return htmlContent; // Return original if conversion fails
  }
}

// Function to find the visible question root container
function findVisibleQuestionRoot(document) {
  console.log('Extract-content: Searching for visible question root...');

  // 1. 找到页面上所有可能的题目块
  const allQuestionBlocks = document.querySelectorAll('.teacher-item-preview, .PerformanceItem.question-preview-player');
  console.log('Extract-content: Found', allQuestionBlocks.length, 'potential question blocks');

  // 2. 优先选择包含当前选中答案的容器
  // 这可以更准确地找到用户正在查看的题目
  const selectedOptions = document.querySelectorAll('.mcq-option[aria-selected="true"], .lrn-mcq-option[aria-selected="true"], .mcq-option.selected, .lrn-mcq-option.selected');
  console.log('Extract-content: Found', selectedOptions.length, 'selected options');

  if (selectedOptions.length > 0) {
    const selectedOption = selectedOptions[0];
    console.log('Extract-content: Selected option found:', selectedOption);

    // 向上查找包含这个选项的题目容器
    for (const block of allQuestionBlocks) {
      if (block.contains(selectedOption)) {
        console.log('Extract-content: Found question root containing selected option:', block);
        return block;
      }
    }
  }

  // 3. 如果没找到包含选中选项的容器，回退到原来的可见性检查
  for (const block of allQuestionBlocks) {
    // offsetParent !== null 是最准的判断元素是否可见的方法
    if (block.offsetParent !== null) {
      console.log('Extract-content: Found visible question root (fallback):', block);
      return block;
    }
  }

  // 4. 如果找不到，返回 null
  console.log('Extract-content: No visible question root found');
  return null;
}

// Function to detect user's selected answer and correct answer
function detectUserAnswer(document) {
  console.log('Extract-content: Detecting user answer...');
  
  let userAnswer = null;
  let correctAnswer = null;
  let root = null;
  
  // Step 0: Try to find the visible question root first (scoping fix)
  const visibleRoot = findVisibleQuestionRoot(document);
  let lrnMode = false;
  
  if (visibleRoot) {
    root = visibleRoot;
    console.log('Extract-content: Using visible question root for scoping');
    // Check if it's Learnosity mode within the visible root
    const lrnOptions = visibleRoot.querySelectorAll('.lrn-mcq-option');
    lrnMode = lrnOptions.length > 0;
  } else {
    // Fallback: Determine the current question root that contains the options list
    console.log('Extract-content: No visible root found, falling back to option-based detection');
    let optionNodes = Array.from(document.querySelectorAll('.mcq-option'));
    if (optionNodes.length === 0) {
      // Learnosity structure fallback
      optionNodes = Array.from(document.querySelectorAll('.lrn-mcq-option'));
      lrnMode = optionNodes.length > 0;
    }
    if (optionNodes.length > 0) {
      // climb up until a container that groups multiple .mcq-option
      let container = optionNodes[0].parentElement;
      while (container && container.querySelectorAll('.mcq-option').length < 2) {
        container = container.parentElement;
      }
      root = container || document;
    } else {
      root = document;
    }
  }
  const optionSelector = lrnMode ? '.lrn-mcq-option' : '.mcq-option';
  console.log('Extract-content: Using scoped root for detection with options count:', (root.querySelectorAll(optionSelector)||[]).length);
  
  // Method 1 removed: do not use global direct query; we only decide inside each option
  
  // Method 2: Correct answer within root - option containing icon.--correct or option with class 'correct'
  let directCorrectByIcon = lrnMode ? null : root.querySelector('.mcq-option .icon.--correct');
  if (directCorrectByIcon) {
    const optionEl = directCorrectByIcon.closest('.mcq-option');
    const letterDiv = optionEl ? optionEl.querySelector('.letter') : null;
    if (letterDiv) {
      correctAnswer = letterDiv.textContent.trim();
      console.log('Extract-content: Detected correct answer (icon-based):', correctAnswer);
    }
  } else {
    // fallback: look for container marked as correct
    const correctOption = lrnMode ? root.querySelector('.lrn-mcq-option.lrn_valid') : root.querySelector('.mcq-option.correct, .mcq-option.--correct');
    if (correctOption) {
      if (lrnMode) {
        const idx = Array.from(root.querySelectorAll('.lrn-mcq-option')).indexOf(correctOption);
        if (idx >= 0) {
          const lettersOrder = ['A','B','C','D','E'];
          correctAnswer = lettersOrder[idx] || String.fromCharCode(65 + idx);
          console.log('Extract-content: Detected correct answer (lrn_valid):', correctAnswer);
        }
      } else {
        const letterDiv = correctOption.querySelector('.letter');
        if (letterDiv) {
          correctAnswer = letterDiv.textContent.trim();
          console.log('Extract-content: Detected correct answer (container class):', correctAnswer);
        }
      }
    }
  }
  
  // Iterate through all options and determine letters by index order
  const allOptions = root.querySelectorAll(optionSelector);
  const lettersOrder = ['A', 'B', 'C', 'D', 'E'];
  
  allOptions.forEach((option, index) => {
    const letter = lettersOrder[index] || String.fromCharCode(65 + index);
    // Student answer: prefer container signals
    const hasChosenLetter = lrnMode ? false : !!option.querySelector('.letter.--chosen');
    const ariaSelected = lrnMode ? !!option.querySelector('input[checked]') : ['aria-pressed', 'aria-selected', 'aria-checked'].some(attr => option.getAttribute(attr) === 'true');
    const classSelected = lrnMode ? option.classList.contains('lrn_selected') : (option.classList.contains('--selected') || option.classList.contains('--chosen'));
    if (!userAnswer && (hasChosenLetter || ariaSelected || classSelected)) {
      userAnswer = letter;
      console.log('Extract-content: Detected user answer (scoped option):', letter, {
        hasChosenLetter,
        ariaSelected,
        classSelected
      });
    }
    // Correct answer: icon or container class
    if (!correctAnswer) {
      const correctIcon = lrnMode ? null : option.querySelector('.icon.--correct');
      const containerCorrect = lrnMode ? option.classList.contains('lrn_valid') : (option.classList.contains('correct') || option.classList.contains('--correct'));
      if (correctIcon || containerCorrect) {
        correctAnswer = letter;
        console.log('Extract-content: Detected correct answer (scoped option):', letter);
      }
    }
  });

  // Fallback: if no chosen/aria/class signal found, assume student selected correct answer
  if (!userAnswer && correctAnswer) {
    userAnswer = correctAnswer;
    console.log('Extract-content: No explicit selection found; assuming student selected the correct answer:', userAnswer);
  }
  
  console.log('Extract-content: Final results - User:', userAnswer, 'Correct:', correctAnswer);
  
  return {
    userAnswer: userAnswer,
    correctAnswer: correctAnswer,
    rationale: null
  };
}

// Function to extract LaTeX from the page
function extractLatexFromPage(document) {
  console.log('Extract-content: Extracting LaTeX from page...');
  
  const latexElements = [];
  
  // Find all elements that might contain LaTeX
  const selectors = [
    'span.math',
    'div.math',
    'span.latex',
    'div.latex',
    'span.katex',
    'div.katex',
    '[data-latex]',
    'script[type="math/tex"]',
    'script[type="math/asciimath"]',
    'img.latex',
    'img[src*="latex"]'
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      let text = '';
      if (el.tagName === 'IMG') {
        text = el.getAttribute('alt') || '';
        console.log('Found LaTeX image:', text);
      } else {
        text = el.textContent || el.getAttribute('data-latex') || '';
      }
      
      if (text && (text.includes('\\') || text.includes('$'))) {
        latexElements.push({
          element: el,
          text: text,
          type: el.tagName.toLowerCase()
        });
      }
    });
  });
  
  // Look for inline LaTeX patterns in text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent;
    if (text && text.includes('$')) {
      // Check if this text is already inside a math element
      let parent = node.parentElement;
      let isInsideMath = false;
      while (parent) {
        if (parent.classList.contains('math') || parent.classList.contains('latex') || parent.classList.contains('katex')) {
          isInsideMath = true;
          break;
        }
        parent = parent.parentElement;
      }
      
      if (!isInsideMath) {
        // Extract LaTeX patterns from this text
        const latexMatches = text.match(/\$[^$]+\$/g);
        if (latexMatches) {
          latexMatches.forEach(match => {
            // Filter out [asy] blocks and other non-LaTeX content
            if (!match.includes('[asy]') && !match.includes('import') && match.length > 2) {
              latexElements.push({
                element: node.parentElement,
                text: match,
                type: 'text'
              });
            }
          });
        }
      }
    }
  }
  
  // Also look for LaTeX in specific content areas
  const contentSelectors = [
    '.mw-parser-output',
    '.problem',
    '.solution',
    'p',
    'div'
  ];
  
  contentSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const text = el.textContent;
      if (text && text.includes('$') && !text.includes('[asy]')) {
        const latexMatches = text.match(/\$[^$]+\$/g);
        if (latexMatches) {
          latexMatches.forEach(match => {
            if (match.length > 2 && !match.includes('[asy]')) {
              latexElements.push({
                element: el,
                text: match,
                type: 'content'
              });
            }
          });
        }
      }
    });
  });
  
  console.log('Extract-content: Found', latexElements.length, 'LaTeX elements');
  if (latexElements.length > 0) {
    console.log('Extract-content: LaTeX examples:', latexElements.slice(0, 3).map(el => el.text));
  }
  return latexElements;
}

// Function to extract existing rationales
function extractRationales(document) {
  console.log('Extract-content: Extracting rationales...');
  const rationales = [];
  // Scope to the same root as options to align order with A–D
  // Use the same logic as detectUserAnswer to ensure consistency
  let root = null;
  
  // Step 0: Try to find the visible question root first (same as detectUserAnswer)
  const visibleRoot = findVisibleQuestionRoot(document);
  if (visibleRoot) {
    root = visibleRoot;
    console.log('Extract-content: Using visible question root for rationale extraction');
  } else {
    // Fallback: Use the same fallback logic as detectUserAnswer
    console.log('Extract-content: No visible root found for rationales, falling back to option-based detection');
    const optionNodes = Array.from(document.querySelectorAll('.mcq-option'));
    if (optionNodes.length > 0) {
      let container = optionNodes[0].parentElement;
      while (container && container.querySelectorAll('.mcq-option').length < 2) {
        container = container.parentElement;
      }
      root = container || document;
    } else {
      root = document;
    }
  }
  
  // Log root container info for debugging
  console.log('Extract-content: Root container:', root.tagName, root.className || '(no class)', root.id || '(no id)');

  // First, try to find rationales by associating them with specific options
  const optionSelectors = ['.mcq-option', '.lrn-mcq-option'];
  let allOptions = [];
  optionSelectors.forEach(selector => {
    const options = Array.from(root.querySelectorAll(selector));
    allOptions = allOptions.concat(options);
  });

  console.log('Extract-content: Found', allOptions.length, 'options in root container');

  // Extract rationales by finding the distractor containers associated with options
  const letters = ['A', 'B', 'C', 'D', 'E'];
  let rationaleIndex = 0;

  allOptions.forEach((option, optionIndex) => {
    // Look for rationale containers near this option
    const distractor = option.closest('.LearnosityDistractor');
    if (distractor) {
      const contentEl = distractor.querySelector('.content');
      if (contentEl) {
        const text = contentEl.textContent ? contentEl.textContent.trim() : '';
        if (text) {
          const letter = letters[rationaleIndex] || String.fromCharCode(65 + rationaleIndex);
          rationales.push({ answer: letter, rationale: text });
          console.log('Extract-content: Rationale mapped to', letter, 'via option association');
          rationaleIndex += 1;
        }
      }
    }
  });

  // If we found rationales through options, return them
  if (rationales.length > 0) {
    console.log('Extract-content: Extracted', rationales.length, 'rationales via option association');
    return rationales;
  }

  // Fallback: If no option-associated rationales found, try the broader search but limit it
  console.log('Extract-content: No option-associated rationales found, trying broader search');
  const contents = root.querySelectorAll('.LearnosityDistractor .content');
  console.log('Extract-content: Found', contents.length, 'potential rationales in root container');

  // Limit to a reasonable number (usually A-E for multiple choice)
  const maxRationales = Math.min(contents.length, 5);
  let idx = 0;

  for (const contentEl of contents) {
    if (idx >= maxRationales) break;

    const text = contentEl.textContent ? contentEl.textContent.trim() : '';
    if (!text) continue;

    const letter = letters[idx] || String.fromCharCode(65 + idx);
    rationales.push({ answer: letter, rationale: text });
    console.log('Extract-content: Rationale mapped to', letter, '- fallback method');
    idx += 1;
  }

  console.log('Extract-content: Extracted', rationales.length, 'rationales from root container');
  return rationales;
}

function parse(document) {

  console.log('Extract-content: Starting to parse document with Defuddle');
  
  try {
    // Detect user's selected answer and correct answer
    const answerInfo = detectUserAnswer(document);
    console.log('Extract-content: Answer info:', answerInfo);
    
    // Extract existing rationales
    const rationales = extractRationales(document);
    console.log('Extract-content: Rationales found:', rationales.length);
    
    // First, extract LaTeX elements for debugging
    const latexElements = extractLatexFromPage(document);
    console.log('Extract-content: LaTeX elements found:', latexElements.map(el => ({
      type: el.type,
      text: el.text.substring(0, 100) + (el.text.length > 100 ? '...' : '')
    })));
    
    // Use Defuddle to extract content
    const defuddled = new Defuddle(document, { url: document.URL }).parse();
    
    if (!defuddled || !defuddled.content) {
      console.log('Extract-content: Defuddle returned no content');
    return null;
  }

    
    console.log('Extract-content: Defuddle extraction successful');
    console.log('Content length (HTML):', defuddled.content.length);
    console.log('Title:', defuddled.title);
    console.log('Word count:', defuddled.wordCount);
    
    // Convert HTML to clean Markdown with LaTeX
    const markdownContent = convertHtmlToMarkdown(defuddled.content);
    
    // Extract question part (before rationales)
    let questionContent = markdownContent;
    let explanationContent = '';
    
    // Try to separate question from explanations
    const questionEndMarker = /(?:Solution|Answer|Explanation|Rationale)/i;
    const questionMatch = markdownContent.search(questionEndMarker);
    
    if (questionMatch > 0) {
      questionContent = markdownContent.substring(0, questionMatch).trim();
      explanationContent = markdownContent.substring(questionMatch).trim();
    }
    
    console.log('Content length (Markdown):', markdownContent.length);
    console.log('Question length:', questionContent.length);
    console.log('Explanation length:', explanationContent.length);
    
    // Check if LaTeX was preserved
    const latexMatches = markdownContent.match(/\$[^$]+\$/g);
    console.log('Extract-content: LaTeX matches found in markdown:', latexMatches ? latexMatches.length : 0);
    if (latexMatches) {
      console.log('Extract-content: LaTeX examples:', latexMatches.slice(0, 5));
    }
    
    // Return object with content, user answer, correct answer, and rationales
    return {
      content: questionContent,
      explanation: explanationContent || null,
      userAnswer: answerInfo.userAnswer || null,
      correctAnswer: answerInfo.correctAnswer || null,
      rationales: rationales,
      title: defuddled.title || document.title
    };
  } catch (error) {
    console.error('Extract-content: Error during parsing:', error);
    return null;
  }
}

parse(window.document);



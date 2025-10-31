/* global marked, katex, DOMPurify */

import { marked } from 'marked';
import katex from 'katex';
import DOMPurify from 'dompurify';

// Configure marked to handle LaTeX
marked.use({
  renderer: {
    text(text) {
      // Handle marked's text object format
      let textString;
      if (typeof text === 'string') {
        textString = text;
      } else if (text && typeof text === 'object' && 'text' in text) {
        // marked passes text as {type: 'text', raw: '...', text: '...'}
        textString = text.text || text.raw || '';
      } else {
        textString = String(text || '');
      }
      
      // Pre-process LaTeX to handle common issues
      textString = preprocessLatex(textString);
      
      // Handle display math $$...$$
      textString = textString.replace(/\$\$(.+?)\$\$/g, (match, formula) => {
        try {
          const cleanFormula = formula.trim();
          return katex.renderToString(cleanFormula, { 
            displayMode: true, 
            throwOnError: false,
            output: 'html',
            strict: false
          });
        } catch (e) {
          console.error('KaTeX error (display):', e, 'Formula:', formula);
          return `<span style="color: red;">LaTeX Error: ${e.message}</span><pre>$$${formula}$$</pre>`;
        }
      });
      
      // Handle inline math $...$
      textString = textString.replace(/\$(.+?)\$/g, (match, formula) => {
        try {
          const cleanFormula = formula.trim();
          return katex.renderToString(cleanFormula, { 
            displayMode: false, 
            throwOnError: false,
            output: 'html',
            strict: false
          });
        } catch (e) {
          console.error('KaTeX error (inline):', e, 'Formula:', formula);
          return `<span style="color: red;">LaTeX Error: ${e.message}</span><pre>$${formula}$</pre>`;
        }
      });
      
      return textString;
    }
  }
});

// Pre-process LaTeX to fix common formatting issues
function preprocessLatex(text) {
  // First, protect [asy] code blocks from LaTeX processing
  const asyBlocks = [];
  let asyIndex = 0;
  text = text.replace(/```asy[\s\S]*?```/g, (match) => {
    const placeholder = `ASY_BLOCK_${asyIndex++}`;
    asyBlocks.push(match);
    return placeholder;
  });
  
  // Fix common LaTeX spacing issues
  text = text.replace(/\$\s*\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}\s*\$/g, '$\\frac{$1}{$2}$');
  text = text.replace(/\$\s*\\textbf\s*\{([^}]+)\}\s*\$/g, '$\\textbf{$1}$');
  text = text.replace(/\$\s*\\qquad\s*\$/g, '$\\qquad$');
  
  // Fix broken LaTeX across lines
  text = text.replace(/\$\s*\n\s*\$/g, '$$');
  text = text.replace(/\$\s*\n\s*([^$]+?)\s*\n\s*\$/g, '$$$1$$');
  
  // Ensure proper spacing around LaTeX
  text = text.replace(/([^$])\$([^$])/g, '$1 $2');
  text = text.replace(/([^$])\$([^$])/g, '$1 $2');
  
  // Restore [asy] blocks
  asyBlocks.forEach((block, index) => {
    text = text.replace(`ASY_BLOCK_${index}`, block);
  });
  
  return text;
}

/**
 * Render markdown content with LaTeX support
 * @param {string} markdown - The markdown content to render
 * @returns {string} - Sanitized HTML with rendered LaTeX
 */
export function renderMarkdownWithLatex(markdown) {
  try {
    // Ensure input is a string
    const markdownString = String(markdown || '');
    
    // Parse markdown to HTML
    const html = marked.parse(markdownString);
    
    // Sanitize HTML
    const sanitized = DOMPurify.sanitize(html);
    
    return sanitized;
  } catch (error) {
    console.error('Error rendering markdown with LaTeX:', error);
    // Fallback to plain text
    return DOMPurify.sanitize(String(markdown || ''));
  }
}

/**
 * Render LaTeX formulas in an existing HTML element
 * @param {HTMLElement} element - The element containing LaTeX formulas
 */
export function renderLatexInElement(element) {
  if (!element) return;
  
  // Find all elements with LaTeX content and render them
  const latexElements = element.querySelectorAll('.latex-block, .latex-inline');
  
  latexElements.forEach(el => {
    try {
      const latex = el.textContent;
      const isDisplay = el.classList.contains('latex-block');
      
      katex.render(latex, el, {
        throwOnError: false,
        displayMode: isDisplay,
      });
    } catch (e) {
      console.error('KaTeX rendering error:', e);
      el.innerHTML = `<span style="color: red;">LaTeX Error: ${e.message}</span><pre>${el.textContent}</pre>`;
    }
  });
}

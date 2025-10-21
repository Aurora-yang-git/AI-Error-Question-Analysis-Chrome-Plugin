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
      
      // Handle display math $$...$$
      textString = textString.replace(/\$\$(.+?)\$\$/g, (match, formula) => {
        try {
          return katex.renderToString(formula, { 
            displayMode: true, 
            throwOnError: false,
            output: 'html'
          });
        } catch (e) {
          console.error('KaTeX error (display):', e);
          return `$$${formula}$$`;
        }
      });
      
      // Handle inline math $...$
      textString = textString.replace(/\$(.+?)\$/g, (match, formula) => {
        try {
          return katex.renderToString(formula, { 
            displayMode: false, 
            throwOnError: false,
            output: 'html'
          });
        } catch (e) {
          console.error('KaTeX error (inline):', e);
          return `$${formula}$`;
        }
      });
      
      return textString;
    }
  }
});

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

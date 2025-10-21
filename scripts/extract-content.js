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
         node.getAttribute('src').includes('latex'))
      );
    },
    replacement: function (content, node) {
      const alt = node.getAttribute('alt');
      // If alt text contains LaTeX, wrap it properly
      if (alt) {
        // Check if it's already wrapped in $ signs
        if (alt.startsWith('$') && alt.endsWith('$')) {
          return alt;
        }
        // Check if it's a display equation (usually longer or contains specific commands)
        if (alt.length > 50 || alt.includes('\\[') || alt.includes('\\]')) {
          return `$$${alt}$$`;
        }
        // Otherwise treat as inline
        return `$${alt}$`;
      }
      return '';
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
    
    // Clean up spaces before/after LaTeX
    markdown = markdown.replace(/\s+(\$+)/g, ' $1');
    markdown = markdown.replace(/(\$+)\s+/g, '$1 ');
    
    return markdown.trim();
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error);
    return htmlContent; // Return original if conversion fails
  }
}

function parse(document) {
  console.log('Extract-content: Starting to parse document with Defuddle');
  
  try {
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
    
    console.log('Content length (Markdown):', markdownContent.length);
    console.log('Markdown preview:', markdownContent.substring(0, 300));
    
    // Return the clean Markdown content
    // This will include:
    // - Clean markdown formatting
    // - LaTeX formulas extracted from image alt text
    // - Tables, lists, and other formatting preserved
    return markdownContent;
  } catch (error) {
    console.error('Extract-content: Error during parsing:', error);
    return null;
  }
}

parse(window.document);

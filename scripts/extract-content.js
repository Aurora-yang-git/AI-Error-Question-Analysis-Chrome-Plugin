import { isProbablyReaderable, Readability } from '@mozilla/readability';

function canBeParsed(document) {
  return isProbablyReaderable(document, {
    minContentLength: 100
  });
}

function parse(document) {
  console.log('Extract-content: Starting to parse document');
  if (!canBeParsed(document)) {
    console.log('Extract-content: Document is not readable');
    return null;
  }
  const documentClone = document.cloneNode(true);
  const article = new Readability(documentClone).parse();
  if (!article) {
    console.log('Extract-content: Readability returned null');
    return null;
  }
  console.log('Extract-content: Successfully extracted content, length:', article.textContent ? article.textContent.length : 0);
  return article.textContent;
}

parse(window.document);

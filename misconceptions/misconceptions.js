import { renderMarkdownWithLatex, renderLatexInElement } from '../utils/markdown-renderer.js';
import { buildFingerprint, hashString } from '../utils/hash.js';

class MisconceptionsViewer {
  constructor() {
    this.listContainer = document.getElementById('misconceptionsList');
    this.emptyState = document.getElementById('emptyState');
    this.loading = document.getElementById('loading');
    this.clearAllBtn = document.getElementById('clearAllBtn');
    this.refreshBtn = document.getElementById('refreshBtn');
    
    this.init();
  }
  
  async init() {
    // Set up event listeners
    this.clearAllBtn.addEventListener('click', () => this.clearAll());
    this.refreshBtn.addEventListener('click', () => this.loadMisconceptions());
    
    // Load misconceptions
    await this.loadMisconceptions();
  }
  
  async loadMisconceptions() {
    this.showLoading();
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getMisconceptions' });
      
      if (response && response.success) {
        const misconceptions = response.misconceptions || [];
        this.renderMisconceptions(misconceptions);
      } else {
        this.showError('Failed to load misconceptions');
      }
    } catch (error) {
      console.error('Error loading misconceptions:', error);
      this.showError('Error loading misconceptions');
    } finally {
      this.hideLoading();
    }
  }
  
  renderMisconceptions(misconceptions) {
    this.listContainer.innerHTML = '';
    
    if (misconceptions.length === 0) {
      this.emptyState.style.display = 'block';
      this.listContainer.style.display = 'none';
      return;
    }
    
    this.emptyState.style.display = 'none';
    this.listContainer.style.display = 'block';
    
    // Normalize + dedupe by fingerprint, fallback to analysis hash
    const map = new Map();
    misconceptions.forEach(m => {
      const fp = m.fingerprint || buildFingerprint({
        url: m.url || '',
        title: m.questionTitle || '',
        subject: m.subject || '',
        studentAnswer: m.studentAnswer || '',
        correctAnswer: m.correctAnswer || ''
      });
      const ah = m.analysisHash || hashString(m.fullAnalysis || '');
      const key = fp || `ah:${ah}`;
      if (map.has(key)) {
        const ex = map.get(key);
        ex.count = (ex.count || 1) + (m.count || 1);
        ex.timestamp = Math.max(ex.timestamp || 0, m.timestamp || 0);
      } else {
        m.fingerprint = fp;
        m.analysisHash = ah;
        if (!m.count) m.count = 1;
        map.set(key, m);
      }
    });
    const deduped = Array.from(map.values()).sort((a,b)=> (b.timestamp||0)-(a.timestamp||0));

    deduped.forEach(misconception => {
      const card = this.createMisconceptionCard(misconception);
      this.listContainer.appendChild(card);
    });
  }
  
  createMisconceptionCard(misconception) {
    const card = document.createElement('div');
    card.className = 'misconception-card';
    card.dataset.id = misconception.id;
    
    const date = new Date(misconception.timestamp);
    
    card.innerHTML = `
      <div class="misconception-header">
        <div>
          <div class="misconception-title">${this.subjectIcon(misconception.subject)} ${this.escapeHtml(misconception.questionTitle || 'Untitled Question')}</div>
          <div class="misconception-meta">${this.formatDate(date)} • <a href="${misconception.url}" target="_blank">${this.truncateUrl(misconception.url)}</a></div>
        </div>
        ${misconception.count>1?`<div class="badge-dup">×${misconception.count}</div>`:''}
      </div>
      
      ${this.renderAnswers(misconception.studentAnswer, misconception.correctAnswer)}
      
      ${misconception.misconception ? this.renderMisconceptionBox(misconception.misconception) : ''}
      
      ${misconception.knowledgePoints && misconception.knowledgePoints.length > 0 ? this.renderKnowledgePoints(misconception.knowledgePoints) : ''}
      
      <div class="full-analysis">
        ${this.renderFullAnalysis(misconception.fullAnalysis)}
      </div>
      
      <div class="misconception-actions">
        <button class="btn-delete" data-id="${misconception.id}">🗑️ Delete</button>
      </div>
    `;
    
    // Set up event listener for delete button
    const deleteBtn = card.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => this.deleteMisconception(misconception.id));
    
    // Render LaTeX in the full analysis
    setTimeout(() => {
      const analysisDiv = card.querySelector('.full-analysis');
      if (analysisDiv) {
        renderLatexInElement(analysisDiv);
      }
    }, 100);
    
    return card;
  }
  
  renderAnswers(studentAnswer, correctAnswer) {
    if (!studentAnswer && !correctAnswer) return '';
    
    return `
      <div class="misconception-answers">
        ${studentAnswer ? `
          <div class="answer-item">
            <span class="answer-label">Your Answer:</span>
            <span class="answer-value your-answer">${this.escapeHtml(studentAnswer)}</span>
          </div>
        ` : ''}
        ${correctAnswer ? `
          <div class="answer-item">
            <span class="answer-label">Correct Answer:</span>
            <span class="answer-value correct-answer">${this.escapeHtml(correctAnswer)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  renderMisconceptionBox(misconception) {
    return `
      <div class="misconception-box">
        <div class="misconception-box-label">💡 Misconception</div>
        <div class="misconception-text">${this.escapeHtml(misconception)}</div>
      </div>
    `;
  }
  
  renderKnowledgePoints(knowledgePoints) {
    if (!knowledgePoints || knowledgePoints.length === 0) return '';
    
    const tags = knowledgePoints.map(kp => 
      `<span class="knowledge-tag">${this.escapeHtml(kp)}</span>`
    ).join('');
    
    return `<div class="knowledge-points">${tags}</div>`;
  }
  
  renderFullAnalysis(analysis) {
    if (!analysis) return '<p>No analysis available.</p>';
    
    try {
      // Try to render as markdown with LaTeX
      const html = renderMarkdownWithLatex(analysis);
      return html;
    } catch (error) {
      console.error('Error rendering markdown:', error);
      // Fall back to escaped text
      return '<pre>' + this.escapeHtml(analysis) + '</pre>';
    }
  }
  
  async deleteMisconception(id) {
    if (!confirm('Are you sure you want to delete this misconception?')) {
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteMisconception',
        id: id
      });
      
      if (response && response.success) {
        // Remove from UI
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
          card.remove();
          
          // Check if list is now empty
          const cards = document.querySelectorAll('.misconception-card');
          if (cards.length === 0) {
            this.emptyState.style.display = 'block';
            this.listContainer.style.display = 'none';
          }
        }
      }
    } catch (error) {
      console.error('Error deleting misconception:', error);
      alert('Error deleting misconception');
    }
  }
  
  async clearAll() {
    if (!confirm('Are you sure you want to delete ALL saved misconceptions? This cannot be undone.')) {
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearAllMisconceptions' });
      
      if (response && response.success) {
        this.emptyState.style.display = 'block';
        this.listContainer.style.display = 'none';
        this.listContainer.innerHTML = '';
      }
    } catch (error) {
      console.error('Error clearing misconceptions:', error);
      alert('Error clearing misconceptions');
    }
  }
  
  showLoading() {
    this.loading.style.display = 'block';
    this.listContainer.style.display = 'none';
    this.emptyState.style.display = 'none';
  }
  
  hideLoading() {
    this.loading.style.display = 'none';
  }
  
  showError(message) {
    this.emptyState.innerHTML = `
      <div class="empty-icon">⚠️</div>
      <h2>Error</h2>
      <p>${message}</p>
    `;
    this.emptyState.style.display = 'block';
  }
  
  formatDate(date) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  truncateUrl(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname.substring(0, 50);
    } catch {
      return url.substring(0, 50);
    }
  }

  subjectIcon(subject) {
    if (!subject) return '📘';
    const s = String(subject).toLowerCase();
    if (s.includes('physics')) return '🧲';
    if (s.includes('chem')) return '🧪';
    if (s.includes('bio')) return '🧬';
    if (s.includes('calc') || s.includes('precal') || s.includes('stat') || s.includes('math')) return '∑';
    if (s.includes('psych')) return '🧠';
    if (s.includes('cs') || s.includes('computer')) return '💻';
    if (s.includes('econ')) return '💹';
    if (s.includes('english') || s.includes('seminar')) return '📖';
    return '📘';
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new MisconceptionsViewer();
});


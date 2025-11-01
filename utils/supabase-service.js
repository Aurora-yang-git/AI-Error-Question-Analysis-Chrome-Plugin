import { createClient } from '@supabase/supabase-js';

let supabase = null;
let userId = null;
let supabaseConfig = null;

// Try to import Supabase config, but don't fail if it doesn't exist
try {
  const configModule = await import('../supabase-config.js');
  supabaseConfig = configModule.supabaseConfig;
} catch (error) {
  console.log('Supabase config not found. Running in local-only mode.');
}

export async function initSupabase() {
  if (supabase) return supabase;
  
  if (!supabaseConfig || !supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error('Supabase not configured');
  }
  
  supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
  userId = await generateUserId();
  
  return supabase;
}

async function generateUserId() {
  const stored = localStorage.getItem('qa_user_id');
  if (stored) return stored;
  
  const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('qa_user_id', id);
  return id;
}

async function hashUrl(url) {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16);
}

export async function getRecommendedAnalysis(url) {
  try {
    await initSupabase();
    const urlHash = await hashUrl(url);
    
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('url_hash', urlHash)
      .single();
    
    if (error || !data) return null;
    
    if (meetsRecommendationThreshold(data)) {
      return data;
    }
    
    return null;
  } catch (error) {
    console.log('Supabase unavailable, using local mode:', error.message);
    return null;
  }
}

function meetsRecommendationThreshold(analysis) {
  const total = analysis.helpful_count + analysis.not_helpful_count;
  if (total < 3) return false;
  
  const ratio = analysis.helpful_count / total;
  return ratio > 0.6;
}

export async function submitFeedback(url, isHelpful) {
  try {
    await initSupabase();
    const urlHash = await hashUrl(url);
    
    // Use upsert to handle both insert and update
    const { error } = await supabase
      .from('feedback')
      .upsert({
        url_hash: urlHash,
        user_id: userId,
        is_helpful: isHelpful
      }, {
        onConflict: 'url_hash,user_id'
      });
    
    if (error) {
      console.error('Error submitting feedback:', error);
      return null;
    }
    
    // Get updated stats
    return await getFeedbackStats(url);
  } catch (error) {
    console.log('Supabase unavailable for feedback:', error.message);
    return null;
  }
}

export async function getFeedbackStats(url) {
  try {
    await initSupabase();
    const urlHash = await hashUrl(url);
    
    const { data, error } = await supabase
      .from('feedback')
      .select('is_helpful')
      .eq('url_hash', urlHash);
    
    if (error || !data) {
      return { total: 0, helpful_count: 0, not_helpful_count: 0 };
    }
    
    const helpfulCount = data.filter(f => f.is_helpful).length;
    const notHelpfulCount = data.filter(f => !f.is_helpful).length;
    
    return {
      total: data.length,
      helpful_count: helpfulCount,
      not_helpful_count: notHelpfulCount
    };
  } catch (error) {
    console.log('Supabase unavailable for stats:', error.message);
    return { total: 0, helpful_count: 0, not_helpful_count: 0 };
  }
}

export async function saveAnalysisToCloud(url, analysisData) {
  try {
    await initSupabase();
    const urlHash = await hashUrl(url);
    
    const { error } = await supabase
      .from('analyses')
      .upsert({
        url_hash: urlHash,
        url: url,
        content: analysisData.content,
        student_answer: analysisData.studentAnswer,
        correct_answer: analysisData.correctAnswer,
        misconception: analysisData.misconception,
        knowledge_points: JSON.stringify(analysisData.knowledgePoints || [])
      }, {
        onConflict: 'url_hash'
      });
    
    if (error) {
      console.error('Error saving analysis:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('Supabase unavailable for saving:', error.message);
    return false;
  }
}

export async function checkRecommendedAnalysis(url) {
  return await getRecommendedAnalysis(url);
}







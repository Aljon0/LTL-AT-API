import { BUSINESS_KEYWORDS } from './constants.js';

export function calculateRelevanceScore(title, content) {
  const text = (title + ' ' + (content || '')).toLowerCase();
  let score = 0;

  BUSINESS_KEYWORDS.forEach(keyword => {
    if (text.includes(keyword)) {
      score += 1;
    }
  });

  return score;
}

export function groupArticlesByTopic(articles) {
  const topicGroups = new Map();
  
  articles.forEach(article => {
    if (!topicGroups.has(article.topic)) {
      topicGroups.set(article.topic, []);
    }
    topicGroups.get(article.topic).push(article);
  });

  return topicGroups;
}
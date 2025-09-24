import axios from 'axios';
import Parser from 'rss-parser';
import { RSS_FEEDS } from '../utils/constants.js';
import { calculateRelevanceScore, groupArticlesByTopic } from '../utils/helpers.js';

const parser = new Parser();
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;

let trendsCache = {
  articles: [],
  lastUpdated: null,
  topicTrends: new Map()
};

export function getTrendsCache() {
  return trendsCache;
}

export async function fetchRSSFeeds(topics = ['general']) {
  const articles = [];
  const maxArticlesPerTopic = 10;

  if (!Array.isArray(topics)) {
    topics = ['general'];
  }

  for (const topic of topics) {
    const feeds = RSS_FEEDS[topic.toLowerCase()] || RSS_FEEDS['general'];
    
    for (const feedUrl of feeds.slice(0, 2)) {
      try {
        console.log(`Fetching RSS feed: ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        
        const topicArticles = feed.items
          .slice(0, maxArticlesPerTopic)
          .map(item => ({
            title: item.title,
            summary: item.contentSnippet || item.content?.substring(0, 200) || 'No summary available',
            link: item.link,
            publishDate: new Date(item.pubDate || item.isoDate),
            source: feedUrl.split('/')[2],
            topic: topic,
            relevanceScore: calculateRelevanceScore(item.title, item.contentSnippet)
          }));

        articles.push(...topicArticles);
      } catch (error) {
        console.error(`Error fetching RSS feed ${feedUrl}:`, error.message);
      }
    }
  }

  return articles.sort((a, b) => b.publishDate - a.publishDate);
}

export async function fetchNewsAPI(topics = ['business'], country = 'us') {
  if (!NEWS_API_KEY) {
    console.warn('NEWS_API_KEY not configured, skipping NewsAPI');
    return [];
  }

  if (!Array.isArray(topics)) {
    topics = ['business'];
  }

  try {
    const articles = [];
    
    for (const topic of topics.slice(0, 3)) {
      const response = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: {
          category: topic.toLowerCase(),
          country: country,
          pageSize: 20,
          apiKey: NEWS_API_KEY
        }
      });

      const topicArticles = response.data.articles
        .filter(article => article.title && article.description)
        .map(article => ({
          title: article.title,
          summary: article.description,
          link: article.url,
          publishDate: new Date(article.publishedAt),
          source: article.source.name,
          topic: topic,
          relevanceScore: calculateRelevanceScore(article.title, article.description),
          imageUrl: article.urlToImage
        }));

      articles.push(...topicArticles);
    }

    return articles.sort((a, b) => b.publishDate - a.publishDate);
  } catch (error) {
    console.error('Error fetching from NewsAPI:', error.message);
    return [];
  }
}

export async function updateTrendsCache(userTopics = ['business', 'technology']) {
  try {
    if (!Array.isArray(userTopics) || userTopics.length === 0) {
      userTopics = ['business', 'technology'];
    }
    
    console.log('Starting trends cache update for topics:', userTopics);
    
    let rssArticles = [];
    let newsApiArticles = [];
    
    try {
      rssArticles = await fetchRSSFeeds(userTopics);
      console.log(`Fetched ${rssArticles.length} RSS articles`);
    } catch (rssError) {
      console.error('RSS fetch failed:', rssError);
      rssArticles = [];
    }
    
    try {
      newsApiArticles = await fetchNewsAPI(userTopics);
      console.log(`Fetched ${newsApiArticles.length} NewsAPI articles`);
    } catch (apiError) {
      console.error('NewsAPI fetch failed:', apiError);
      newsApiArticles = [];
    }

    const allArticles = [...rssArticles, ...newsApiArticles]
      .filter((article, index, arr) => {
        if (!article || !article.title) return false;
        return arr.findIndex(a => a && a.title === article.title) === index;
      })
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 50);

    trendsCache = {
      articles: allArticles,
      lastUpdated: new Date(),
      topicTrends: groupArticlesByTopic(allArticles)
    };

    console.log(`Trends cache updated successfully with ${allArticles.length} articles`);
    return allArticles;
  } catch (error) {
    console.error('Critical error in updateTrendsCache:', error);
    return trendsCache?.articles || [];
  }
}

export function getTrendingSummary(topics, limit = 5) {
  try {
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      console.log('No topics provided, using defaults');
      topics = ['business', 'technology'];
    }
    
    if (!trendsCache || !trendsCache.articles || !Array.isArray(trendsCache.articles)) {
      console.log('Trends cache not initialized or empty');
      return [];
    }
    
    const relevantArticles = trendsCache.articles
      .filter(article => {
        if (!article || typeof article !== 'object') return false;
        
        return topics.some(topic => {
          if (!topic || typeof topic !== 'string') return false;
          const topicLower = topic.toLowerCase();
          
          return (article.topic && String(article.topic).toLowerCase().includes(topicLower)) ||
                 (article.title && String(article.title).toLowerCase().includes(topicLower)) ||
                 (article.summary && String(article.summary).toLowerCase().includes(topicLower));
        });
      })
      .slice(0, Math.max(0, parseInt(limit) || 5));
  
    return relevantArticles.map(article => ({
      title: article.title || 'No title available',
      summary: article.summary ? 
        (String(article.summary).substring(0, 150) + (article.summary.length > 150 ? '...' : '')) : 
        'No summary available',
      source: article.source || 'Unknown source',
      publishDate: article.publishDate || new Date(),
      relevanceScore: article.relevanceScore || 0
    }));
  } catch (error) {
    console.error('Error in getTrendingSummary:', error);
    return [];
  }
}

export async function getTrendsForGeneration(topics) {
  try {
    const userTopics = Array.isArray(topics) && topics.length > 0 
      ? topics 
      : ['business', 'technology'];
    
    const cacheAge = trendsCache?.lastUpdated 
      ? Date.now() - new Date(trendsCache.lastUpdated).getTime() 
      : Infinity;
    
    if (!trendsCache?.lastUpdated || cacheAge > 30 * 60 * 1000) {
      await updateTrendsCache(userTopics);
    }

    const relevantTrends = getTrendingSummary(userTopics, 3);
    
    let context = '';
    if (relevantTrends && relevantTrends.length > 0) {
      context = `
CURRENT TRENDING TOPICS:
${relevantTrends.map((trend, index) => 
  `${index + 1}. ${trend.title || 'No title'}
   Summary: ${trend.summary || 'No summary'}`
).join('\n\n')}`;
    }

    return {
      context,
      used: relevantTrends || []
    };
  } catch (error) {
    console.error('Error fetching trends for generation:', error);
    return {
      context: '',
      used: []
    };
  }
}
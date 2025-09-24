import { getTrendingSummary, getTrendsCache, updateTrendsCache } from '../services/trendsService.js';

export async function getTrends(req, res) {
  try {
    const { topics, limit = 20 } = req.query;
    
    let requestedTopics = ['business', 'technology'];
    if (topics) {
      const parsedTopics = topics.split(',')
        .map(t => t ? t.trim() : '')
        .filter(t => t.length > 0);
      
      if (parsedTopics.length > 0) {
        requestedTopics = parsedTopics;
      }
    }

    console.log('Fetching trends for topics:', requestedTopics);

    const cache = getTrendsCache();
    const cacheAge = cache.lastUpdated ? Date.now() - new Date(cache.lastUpdated).getTime() : Infinity;
    
    if (!cache.lastUpdated || cacheAge > 30 * 60 * 1000 || cache.articles.length === 0) {
      console.log('Cache is stale or empty, updating...');
      await updateTrendsCache(requestedTopics);
    }

    const trendingSummary = getTrendingSummary(requestedTopics, parseInt(limit) || 20);
    const updatedCache = getTrendsCache();

    res.json({
      trends: trendingSummary,
      lastUpdated: updatedCache.lastUpdated,
      totalArticles: updatedCache.articles ? updatedCache.articles.length : 0,
      availableTopics: updatedCache.topicTrends ? Array.from(updatedCache.topicTrends.keys()) : []
    });
  } catch (error) {
    console.error('Error in /api/trends endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trends', 
      details: error.message,
      trends: [],
      lastUpdated: null
    });
  }
}

export async function refreshTrends(req, res) {
  try {
    console.log('Refresh trends request body:', req.body);
    
    let topics = req.body?.topics;
    
    if (!topics || !Array.isArray(topics)) {
      console.log('Invalid or missing topics, using defaults');
      topics = ['business', 'technology'];
    } else {
      topics = topics.filter(t => t && typeof t === 'string' && t.trim().length > 0);
      if (topics.length === 0) {
        topics = ['business', 'technology'];
      }
    }
    
    console.log('Refreshing trends for validated topics:', topics);
    
    const articles = await updateTrendsCache(topics);
    const cache = getTrendsCache();
    
    res.json({
      success: true,
      message: 'Trends refreshed successfully',
      articlesCount: articles ? articles.length : 0,
      lastUpdated: cache.lastUpdated,
      topics: topics
    });
  } catch (error) {
    console.error('Error in /api/trends/refresh endpoint:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to refresh trends', 
      details: error.message,
      success: false
    });
  }
}
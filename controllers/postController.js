import { generateDualPost } from '../services/aiService.js';
import { getTrendsForGeneration } from '../services/trendsService.js';

export async function generatePostWithTrends(req, res) {
  req.setTimeout(120000);
  res.setTimeout(120000);
  
  try {
    const { userId, prompt, context, profileData, documentContext, includeTrends = true } = req.body;

    console.log('=== Dual Post Generation with Trends ===');
    console.log('User ID:', userId);
    console.log('Include trends:', includeTrends);

    if (!userId || !prompt || !profileData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let trendingContext = '';
    let usedTrends = [];

    if (includeTrends) {
      const trends = await getTrendsForGeneration(profileData.topics);
      trendingContext = trends.context;
      usedTrends = trends.used;
    }

    const result = await generateDualPost({
      prompt,
      context,
      profileData,
      documentContext,
      trendingContext,
      includeTrends
    });

    res.json({
      ...result,
      trendsUsed: usedTrends,
      metadata: {
        ...result.metadata,
        userId
      }
    });
  } catch (error) {
    console.error('Error generating dual posts:', error);
    res.status(500).json({ 
      error: 'Failed to generate posts', 
      details: error.message 
    });
  }
}

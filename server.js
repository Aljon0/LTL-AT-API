import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';
import Groq from 'groq-sdk';
import multer from 'multer';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import Parser from 'rss-parser';
import Stripe from 'stripe';


// Configure dotenv
dotenv.config();

const parser = new Parser();
const NEWS_API_KEY = process.env.NEWS_API_KEY; 
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// FIXED CORS Configuration - This will work for your local development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`Preflight request from: ${origin}`);
    res.sendStatus(200);
  } else {
    next();
  }
});

// Synchronous email transporter creation - FIXED
const createEmailTransporter = () => {
  try {function getTrendingSummary(topics, limit = 5) {
    // Add safety checks
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      topics = ['business', 'technology'];
    }
    
    const relevantArticles = trendsCache.articles
      .filter(article => 
        topics.some(topic => 
          article.topic && article.topic.toLowerCase().includes(topic.toLowerCase())
        )
      )
      .slice(0, limit);
  
    return relevantArticles.map(article => ({
      title: article.title || 'No title',
      summary: (article.summary || 'No summary').substring(0, 150) + '...',
      source: article.source || 'Unknown source',
      publishDate: article.publishDate || new Date(),
      relevanceScore: article.relevanceScore || 0
    }));
  }
    // Primary: Gmail configuration
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      console.log('Creating Gmail transporter...');
      console.log('Email user:', process.env.EMAIL_USER);
      console.log('Password length:', process.env.EMAIL_PASSWORD.length);
      
      // FIXED: Use nodemailer.createTransport (not createTransporter)
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
    
    // Secondary: Custom SMTP configuration
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log('Creating custom SMTP transporter...');
      // FIXED: Use nodemailer.createTransport (not createTransporter)
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    
    console.warn('No email configuration found');
    return null;
    
  } catch (error) {
    console.error('Email transporter creation failed:', error.message);
    return null;
  }
};

// Initialize email transporter synchronously
const emailTransporter = createEmailTransporter();

// Test email connection on startup
if (emailTransporter) {
  emailTransporter.verify()
    .then(() => {
      console.log('Email service verified and ready');
    })
    .catch((error) => {
      console.error('Email verification failed:', error.message);
    });
} else {
  console.warn('Email service not configured - emails will be disabled');
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

// Helper function to extract text from documents
async function extractTextFromDocument(file) {
  try {
    console.log(`Processing file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`);
    
    switch (file.mimetype) {
      case 'application/pdf':
        return `[PDF Document: ${file.originalname} - PDF text extraction will be implemented. File contains ${file.size} bytes of content.]`;
      
      case 'text/plain':
        try {
          const text = file.buffer.toString('utf-8');
          console.log(`Text file processed successfully, extracted ${text.length} characters`);
          return text;
        } catch (textError) {
          console.error(`Text parsing error for ${file.originalname}:`, textError);
          return `[Error reading text file: ${file.originalname} - ${textError.message}]`;
        }
      
      default:
        return `[Unsupported file type: ${file.mimetype}]`;
    }
  } catch (error) {
    console.error(`General error extracting text from ${file.originalname}:`, error);
    return `[Error reading document: ${file.originalname} - ${error.message}]`;
  }
}

let trendsCache = {
  articles: [],
  lastUpdated: null,
  topicTrends: new Map()
};

// RSS feeds for different industries/topics
const RSS_FEEDS = {
  'technology': [
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://feeds.feedburner.com/venturebeat/SZYF'
  ],
  'business': [
    'https://feeds.bloomberg.com/markets/news.rss',
    'https://www.reuters.com/business/finance/rss',
    'https://feeds.fortune.com/fortune/feeds/rss/fortune_mostpowerfulwomen.xml'
  ],
  'marketing': [
    'https://feeds.feedburner.com/MarketingLand',
    'https://feeds.feedburner.com/socialmediaexaminer',
    'https://feeds.contentmarketinginstitute.com/ContentMarketingInstitute'
  ],
  'finance': [
    'https://feeds.bloomberg.com/markets/news.rss',
    'https://www.ft.com/rss',
    'https://feeds.feedburner.com/reuters/businessNews'
  ],
  'healthcare': [
    'https://feeds.feedburner.com/HealthcareItNews-NewsAndFeatures',
    'https://www.fierce-network.com/rss/xml'
  ],
  'general': [
    'https://feeds.feedburner.com/reuters/topNews',
    'https://feeds.bbci.co.uk/news/business/rss.xml'
  ]
};

// ===== NEWS TREND FUNCTIONS =====

async function fetchRSSFeeds(topics = ['general']) {
  const articles = [];
  const maxArticlesPerTopic = 10;

  // Safety check
  if (!Array.isArray(topics)) {
    topics = ['general'];
  }

  for (const topic of topics) {
    const feeds = RSS_FEEDS[topic.toLowerCase()] || RSS_FEEDS['general'];
    
    for (const feedUrl of feeds.slice(0, 2)) { // Limit feeds to prevent overload
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
            source: feedUrl.split('/')[2], // Extract domain
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

async function fetchNewsAPI(topics = ['business'], country = 'us') {
  if (!NEWS_API_KEY) {
    console.warn('NEWS_API_KEY not configured, skipping NewsAPI');
    return [];
  }

  // Safety check
  if (!Array.isArray(topics)) {
    topics = ['business'];
  }

  try {
    const articles = [];
    
    for (const topic of topics.slice(0, 3)) { // Limit to 3 topics to avoid rate limits
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

function calculateRelevanceScore(title, content) {
  // Simple relevance scoring based on business/professional keywords
  const businessKeywords = [
    'business', 'market', 'revenue', 'growth', 'innovation', 'technology',
    'strategy', 'leadership', 'management', 'industry', 'professional',
    'career', 'networking', 'partnership', 'investment', 'startup',
    'entrepreneur', 'digital transformation', 'AI', 'automation'
  ];

  const text = (title + ' ' + (content || '')).toLowerCase();
  let score = 0;

  businessKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      score += 1;
    }
  });

  return score;
}

async function updateTrendsCache(userTopics = ['business', 'technology']) {
  try {
    // Validate topics
    if (!Array.isArray(userTopics) || userTopics.length === 0) {
      userTopics = ['business', 'technology'];
    }
    
    console.log('Starting trends cache update for topics:', userTopics);
    
    // Fetch articles with error handling for each source
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

    // Combine and process articles
    const allArticles = [...rssArticles, ...newsApiArticles]
      .filter((article, index, arr) => {
        if (!article || !article.title) return false;
        return arr.findIndex(a => a && a.title === article.title) === index;
      })
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 50);

    // Update cache
    trendsCache = {
      articles: allArticles,
      lastUpdated: new Date(),
      topicTrends: groupArticlesByTopic(allArticles)
    };

    console.log(`Trends cache updated successfully with ${allArticles.length} articles`);
    return allArticles;
  } catch (error) {
    console.error('Critical error in updateTrendsCache:', error);
    // Return empty array but keep existing cache
    return trendsCache?.articles || [];
  }
}

function groupArticlesByTopic(articles) {
  const topicGroups = new Map();
  
  articles.forEach(article => {
    if (!topicGroups.has(article.topic)) {
      topicGroups.set(article.topic, []);
    }
    topicGroups.get(article.topic).push(article);
  });

  return topicGroups;
}

function getTrendingSummary(topics, limit = 5) {
  try {
    // Enhanced safety checks
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      console.log('No topics provided, using defaults');
      topics = ['business', 'technology'];
    }
    
    // Ensure trendsCache exists and has articles
    if (!trendsCache || !trendsCache.articles || !Array.isArray(trendsCache.articles)) {
      console.log('Trends cache not initialized or empty');
      return [];
    }
    
    const relevantArticles = trendsCache.articles
      .filter(article => {
        // Check article exists and has required properties
        if (!article || typeof article !== 'object') return false;
        
        // Check if article matches any of the requested topics
        return topics.some(topic => {
          if (!topic || typeof topic !== 'string') return false;
          const topicLower = topic.toLowerCase();
          
          // Check multiple fields for topic relevance
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
// ===== NEW API ENDPOINTS =====

// Get current trends
app.get('/api/trends', async (req, res) => {
  try {
    const { topics, limit = 20 } = req.query;
    
    // Enhanced topic parsing with better error handling
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

    // Initialize cache if it doesn't exist
    if (!trendsCache) {
      trendsCache = {
        articles: [],
        lastUpdated: null,
        topicTrends: new Map()
      };
    }

    // Update cache if it's older than 30 minutes or empty
    const cacheAge = trendsCache.lastUpdated ? Date.now() - new Date(trendsCache.lastUpdated).getTime() : Infinity;
    if (!trendsCache.lastUpdated || cacheAge > 30 * 60 * 1000 || trendsCache.articles.length === 0) {
      console.log('Cache is stale or empty, updating...');
      await updateTrendsCache(requestedTopics);
    }

    const trendingSummary = getTrendingSummary(requestedTopics, parseInt(limit) || 20);

    res.json({
      trends: trendingSummary,
      lastUpdated: trendsCache.lastUpdated,
      totalArticles: trendsCache.articles ? trendsCache.articles.length : 0,
      availableTopics: trendsCache.topicTrends ? Array.from(trendsCache.topicTrends.keys()) : []
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
}); 

// Force refresh trends
app.post('/api/trends/refresh', async (req, res) => {
  try {
    console.log('Refresh trends request body:', req.body);
    
    let topics = req.body?.topics;
    
    // Enhanced validation and default handling
    if (!topics || !Array.isArray(topics)) {
      console.log('Invalid or missing topics, using defaults');
      topics = ['business', 'technology'];
    } else {
      // Filter out any invalid topic entries
      topics = topics.filter(t => t && typeof t === 'string' && t.trim().length > 0);
      if (topics.length === 0) {
        topics = ['business', 'technology'];
      }
    }
    
    console.log('Refreshing trends for validated topics:', topics);
    
    // Initialize cache structure if needed
    if (!trendsCache) {
      trendsCache = {
        articles: [],
        lastUpdated: null,
        topicTrends: new Map()
      };
    }
    
    const articles = await updateTrendsCache(topics);
    
    res.json({
      success: true,
      message: 'Trends refreshed successfully',
      articlesCount: articles ? articles.length : 0,
      lastUpdated: trendsCache.lastUpdated,
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
});

function createDualPostEmailTemplate(shortPost, longPost, userProfile) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your LinkedIn Posts - Short & Long Versions</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #27272a; 
            background: linear-gradient(135deg, #f4f4f5 0%, #e4e4e7 50%, #d4d4d8 100%);
            padding: 20px;
        }
        .container { 
            max-width: 700px; 
            margin: 0 auto; 
            background: rgba(255, 255, 255, 0.95); 
            backdrop-filter: blur(10px);
            border-radius: 24px; 
            overflow: hidden; 
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(228, 228, 231, 0.6);
        }
        .header { 
            background: linear-gradient(135deg, #18181b, #27272a); 
            padding: 40px 32px; 
            text-align: center; 
            position: relative;
            overflow: hidden;
        }
        .header h1 { 
            color: white; 
            font-size: 32px; 
            font-weight: 700; 
            margin-bottom: 8px;
        }
        .header p { 
            color: #d4d4d8; 
            font-size: 18px;
            font-weight: 500;
        }
        .content { 
            padding: 48px 32px; 
        }
        .post-section {
            margin-bottom: 40px;
        }
        .post-label {
            display: inline-block;
            padding: 6px 14px;
            background: linear-gradient(135deg,rgb(66, 66, 73),rgb(80, 79, 84));
            color: white;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
        }
        .post-preview { 
            background: linear-gradient(135deg, #f9fafb, #f4f4f5);
            border: 2px solid #e4e4e7; 
            border-radius: 16px; 
            padding: 24px; 
            position: relative;
            box-shadow: 0 10px 25px -12px rgba(0, 0, 0, 0.1);
        }
        .post-content { 
            font-size: 15px; 
            line-height: 1.7; 
            color: #374151; 
            white-space: pre-wrap;
            font-weight: 500;
        }
        .character-count {
            margin-top: 12px;
            text-align: right;
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
        }
        .cta-section {
            text-align: center;
            margin: 40px 0;
            padding: 32px;
            background: linear-gradient(135deg, #fafafa, #f5f5f5);
            border-radius: 16px;
        }
        .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg,rgb(12, 13, 13),rgb(45, 49, 52));
            color: white; 
            padding: 18px 36px; 
            border-radius: 12px; 
            text-decoration: none; 
            font-weight: 600; 
            font-size: 16px;
            box-shadow: 0 8px 25px -8px rgba(0, 119, 181, 0.5);
            transition: transform 0.2s;
        }
        .cta-button:hover {
            transform: translateY(-2px);  
        }
        .tips-section {
            background: #f0f9ff;
            border-left: 4px solid #0284c7;
            padding: 20px;
            border-radius: 8px;
            margin-top: 32px;
        }
        .tips-title {
            font-weight: 600;
            color: #0c4a6e;
            margin-bottom: 12px;
        }
        .tips-list {
            list-style: none;
            color: #075985;
            font-size: 14px;
        }
        .tips-list li {
            margin: 8px 0;
            padding-left: 20px;
            position: relative;
        }
        .tips-list li:before {
            content: "→";
            position: absolute;
            left: 0;
            color: #0284c7;
        }
        .footer { 
            background: linear-gradient(135deg, #f9fafb, #f4f4f5);
            padding: 32px; 
            border-top: 1px solid #e4e4e7; 
            text-align: center; 
            color: #6b7280; 
            font-size: 14px;
            font-weight: 500;
        }
        .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #d4d4d8, transparent);
            margin: 32px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Your LinkedIn Posts Are Ready!</h1>
            <p>1 Short + 1 Long Format Post</p>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 32px;">
                <p style="color: #6b7280; font-size: 16px;">
                    As per your subscription, here are both versions of your LinkedIn post.
                    Choose the one that fits your current mood and audience!
                </p>
            </div>

            <!-- Short Post -->
            <div class="post-section">
                <span class="post-label">Short Post</span>
                <div class="post-preview">
                    <div class="post-content">${shortPost || 'Short post not generated'}</div>
                    
                </div>
            </div>

            <div class="divider"></div>

            <!-- Long Post -->
            <div class="post-section">
                <span class="post-label">Long Post</span>
                <div class="post-preview">
                    <div class="post-content">${longPost || 'Long post not generated'}</div>
                    
                </div>
            </div>

            <!-- CTA Section -->
            <div class="cta-section">
                <h3 style="margin-bottom: 20px; color: #18181b; font-size: 20px;">Ready to Post?</h3>
                <p style="margin-bottom: 24px; color: #6b7280;">
                    Copy your preferred version and share it with your network
                </p>
                <a href="https://linkedin.com/feed" class="cta-button" target="_blank">
                    Open LinkedIn →
                </a>
            </div>

        </div>
        
        <div class="footer">
            <div style="font-weight: 700; color: #18181b; margin-bottom: 8px;">ThoughtLeader AI</div>
            <p>Automated LinkedIn Content Generation</p>
            <p style="margin-top: 16px; font-size: 12px;">
                This email was sent to ${userProfile?.email || 'your email'}
            </p>
            <p style="margin-top: 8px; font-size: 11px; color: #9ca3af;">
                You're receiving this because you requested automated content generation
            </p>
        </div>
    </div>
</body>
</html>`;
}

function createReceiptEmailTemplate(receiptData, userProfile) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Receipt - ThoughtLeader AI</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #18181b, #27272a); padding: 32px; text-align: center; color: white; }
        .content { padding: 32px; }
        .receipt-details { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 20px 0; }
        .total { font-size: 24px; font-weight: bold; color: #059669; text-align: center; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Payment Successful!</h1>
            <p>Receipt #${receiptData.receiptNumber}</p>
        </div>
        <div class="content">
            <h2>Thank you for your purchase!</h2>
            <div class="receipt-details">
                <p><strong>Plan:</strong> ${receiptData.planName}</p>
                <p><strong>Amount:</strong> ${receiptData.amount}</p>
                <p><strong>Date:</strong> ${receiptData.date}</p>
                <p><strong>Transaction ID:</strong> ${receiptData.transactionId}</p>
            </div>
            <div class="total">Total Paid: ${receiptData.amount}</div>
            <p>Your premium features are now active. Start creating amazing content!</p>
        </div>
    </div>
</body>
</html>`;
}

// Other middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  const origin = req.get('origin') || 'no-origin';
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${origin}`);
  next();
});

// ===== TEST CORS ENDPOINT =====
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS is working!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// ===== EMAIL CONFIGURATION TEST ENDPOINT =====
app.get('/api/test-email-config', async (req, res) => {
  try {
    console.log('Testing email configuration...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET (length: ' + process.env.EMAIL_PASSWORD.length + ')' : 'NOT SET');
    
    if (!emailTransporter) {
      return res.status(500).json({ 
        error: 'Email transporter not initialized',
        config: {
          emailUser: !!process.env.EMAIL_USER,
          emailPassword: !!process.env.EMAIL_PASSWORD,
          passwordLength: process.env.EMAIL_PASSWORD?.length || 0
        }
      });
    }
    
    // Test the connection
    const verified = await emailTransporter.verify();
    
    res.json({ 
      success: true,
      message: 'Email configuration is working',
      verified: verified,
      config: {
        emailUser: !!process.env.EMAIL_USER,
        emailPassword: !!process.env.EMAIL_PASSWORD,
        passwordLength: process.env.EMAIL_PASSWORD?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Email config test failed:', error);
    res.status(500).json({ 
      error: 'Email configuration test failed',
      details: error.message,
      code: error.code,
      config: {
        emailUser: !!process.env.EMAIL_USER,
        emailPassword: !!process.env.EMAIL_PASSWORD,
        passwordLength: process.env.EMAIL_PASSWORD?.length || 0
      }
    });
  }
});

// Add this endpoint to your server.js file
app.post('/api/upgrade-subscription', async (req, res) => {
  try {
    const { userId, planId, amount, paymentIntentId } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`Upgrading user ${userId} to ${planId} plan`);

    // In a real implementation, you would:
    // 1. Verify the payment with Stripe
    // 2. Update user subscription in your database
    // 3. Send confirmation email

    // For test mode, we'll just simulate success
    const receiptData = {
      receiptNumber: `RCT-${Date.now().toString().slice(-8)}`,
      transactionId: paymentIntentId || `txn_${Math.random().toString(36).substr(2, 9)}`,
      amount: amount,
      planName: planId,
      date: new Date().toLocaleDateString()
    };

    res.json({
      success: true,
      message: 'Subscription upgraded successfully (test mode)',
      receiptData
    });

  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ 
      error: 'Failed to upgrade subscription', 
      details: error.message 
    });
  }
});

// ===== AUTHENTICATION ENDPOINTS =====
app.post('/api/auth/user', async (req, res) => {
  try {
    const { uid, email, name, avatar, provider } = req.body;
    
    if (!uid || !email) {
      return res.status(400).json({ error: 'UID and email are required' });
    }
    
    const user = {
      id: uid,
      email,
      name: name || email.split('@')[0],
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=6366f1&color=ffffff`,
      provider: provider || 'google',
      isAdmin: false,
      subscription: 'free',
      createdAt: new Date().toISOString()
    };

    res.json({ user });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Failed to create/update user' });
  }
});

// ===== DOCUMENT PROCESSING =====
app.post('/api/process-documents', upload.array('documents'), async (req, res) => {
  try {
    const origin = req.get('origin') || 'no-origin';
    console.log('=== Document Processing Request ===');
    console.log('Files received:', req.files?.length || 0);
    console.log('Request origin:', origin);
    
    if (!req.files || req.files.length === 0) {
      return res.json({ 
        documentContext: '', 
        processedFiles: 0, 
        totalCharacters: 0,
        message: 'No documents provided'
      });
    }

    const documentTexts = [];
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        const text = await extractTextFromDocument(file);
        documentTexts.push(`--- ${file.originalname} ---\n${text}\n`);
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        documentTexts.push(`--- ${file.originalname} ---\n[Error processing file: ${fileError.message}]\n`);
      }
    }
    
    const documentContext = documentTexts.join('\n');

    console.log('✅ Document processing successful');
    res.json({ 
      documentContext,
      processedFiles: req.files.length,
      totalCharacters: documentContext.length,
      message: 'Documents processed successfully'
    });

  } catch (error) {
    console.error('❌ Error processing documents:', error);
    res.status(500).json({ 
      error: 'Failed to process documents', 
      details: error.message 
    });
  }
});

app.post('/api/generate-post-with-trends', async (req, res) => {
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

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'AI service configuration error' });
    }

    let trendingContext = '';
    let usedTrends = [];

    // Fetch trends if needed
    if (includeTrends) {
      try {
        const userTopics = Array.isArray(profileData.topics) && profileData.topics.length > 0 
          ? profileData.topics 
          : ['business', 'technology'];
        
        const cacheAge = trendsCache?.lastUpdated 
          ? Date.now() - new Date(trendsCache.lastUpdated).getTime() 
          : Infinity;
        
        if (!trendsCache?.lastUpdated || cacheAge > 30 * 60 * 1000) {
          await updateTrendsCache(userTopics);
        }

        const relevantTrends = getTrendingSummary(userTopics, 3);
        usedTrends = relevantTrends || [];

        if (relevantTrends && relevantTrends.length > 0) {
          trendingContext = `
CURRENT TRENDING TOPICS:
${relevantTrends.map((trend, index) => 
  `${index + 1}. ${trend.title || 'No title'}
   Summary: ${trend.summary || 'No summary'}`
).join('\n\n')}`;
        }
      } catch (trendsError) {
        console.error('Error fetching trends:', trendsError);
      }
    }

    // Generate BOTH short and long posts in one request for efficiency
    const dualPostPrompt = `You are a LinkedIn content creator. Create TWO separate posts based on the same topic but with different lengths and approaches.

User's Profile:
- Goals: ${profileData.goals || 'Not specified'}
- Voice Style: ${profileData.voiceStyle || 'Professional'}
- Topics: ${Array.isArray(profileData.topics) ? profileData.topics.join(', ') : 'General business'}

${documentContext ? `Context: ${String(documentContext).substring(0, 1000)}` : ''}
${trendingContext}

Topic/Prompt: ${prompt}
${context ? `Additional context: ${context}` : ''}

Please create:

1. SHORT POST (600-900 characters, approximately 100-150 words):
- Quick, punchy insight
- One clear takeaway
- 2-3 relevant hashtags
- Direct and concise
- Attention-grabbing opening

2. LONG POST (1200-2000 characters, approximately 200-350 words):
- Detailed story or analysis
- Multiple insights or lessons
- 4-5 relevant hashtags
- Include personal anecdote or case study if relevant
- More comprehensive exploration of the topic

${includeTrends ? 'Incorporate the trending topics naturally where relevant.' : ''}

Format your response EXACTLY like this:
[SHORT POST]
(your short post content here)

[LONG POST]
(your long post content here)`;

    console.log('Generating dual posts...');
    
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a professional LinkedIn content creator. Always follow the exact format requested." },
        { role: "user", content: dualPostPrompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 2000,
      stream: false
    });

    const generatedContent = completion.choices[0]?.message?.content;
    
    if (!generatedContent) {
      throw new Error('No content generated from AI service');
    }

    // Parse the response to separate short and long posts
    const shortPostMatch = generatedContent.match(/\[SHORT POST\]\n([\s\S]*?)(?=\[LONG POST\]|$)/);
    const longPostMatch = generatedContent.match(/\[LONG POST\]\n([\s\S]*?)$/);

    const shortPost = shortPostMatch ? shortPostMatch[1].trim() : '';
    const longPost = longPostMatch ? longPostMatch[1].trim() : '';

    if (!shortPost || !longPost) {
      console.error('Failed to parse dual posts, regenerating...');
      // Fallback: use the entire content as long post and create a summary for short
      const fallbackLong = generatedContent;
      const fallbackShort = generatedContent.substring(0, 900) + '...';
      
      res.json({
        shortPost: fallbackShort,
        longPost: fallbackLong,
        metadata: {
          model: "llama-3.3-70b-versatile",
          timestamp: new Date().toISOString(),
          usedTrends: includeTrends,
          trendsUsed: usedTrends.length,
          userId: userId
        },
        trendsUsed: usedTrends
      });
    } else {
      res.json({
        shortPost: shortPost,
        longPost: longPost,
        metadata: {
          model: "llama-3.3-70b-versatile",
          timestamp: new Date().toISOString(),
          usedTrends: includeTrends,
          trendsUsed: usedTrends.length,
          shortPostLength: shortPost.length,
          longPostLength: longPost.length,
          userId: userId
        },
        trendsUsed: usedTrends
      });
    }
    
  } catch (error) {
    console.error('Error generating dual posts:', error);
    res.status(500).json({ 
      error: 'Failed to generate posts', 
      details: error.message 
    });
  }
});

app.use((req, res, next) => {
  // Set a longer timeout for AI generation endpoints
  if (req.path.includes('/generate-post') || req.path.includes('/trends')) {
    req.setTimeout(120000); // 2 minutes
    res.setTimeout(120000);
  }
  next();
});

cron.schedule('*/30 * * * *', async () => {
  console.log('Running scheduled trends update...');
  try {
    await updateTrendsCache(['business', 'technology', 'marketing', 'finance']);
    console.log('Scheduled trends update completed');
  } catch (error) {
    console.error('Scheduled trends update failed:', error);
  }
});

// Initial trends cache population
setTimeout(async () => {
  console.log('Populating initial trends cache...');
  try {
    await updateTrendsCache(['business', 'technology', 'marketing']);
    console.log('Initial trends cache populated');
  } catch (error) {
    console.error('Initial trends cache population failed:', error);
  }
}, 5000);

// ===== EMAIL SERVICES =====
app.post('/api/send-test-email', async (req, res) => {
  try {
    const { userId, shortPost, longPost, userEmail } = req.body;

    console.log('=== Dual Post Email Send Request ===');
    console.log('User ID:', userId);
    console.log('User Email:', userEmail);
    console.log('Has short post:', !!shortPost);
    console.log('Has long post:', !!longPost);

    if (!userId || (!shortPost && !longPost)) {
      return res.status(400).json({ error: 'User ID and at least one post are required' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    if (!emailTransporter) {
      return res.status(500).json({ 
        error: 'Email service not configured',
        details: 'Please check server email configuration.'
      });
    }

    const mailOptions = {
      from: `"ThoughtLeader AI" <${process.env.EMAIL_USER || 'noreply@thoughtleader.ai'}>`,
      to: userEmail,
      subject: '🚀 Your LinkedIn Posts Are Ready! (Short + Long)',
      html: createDualPostEmailTemplate(shortPost, longPost, { email: userEmail })
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Dual post email sent successfully:', info.messageId);
    
    res.json({ 
      message: 'Email sent successfully',
      sentTo: userEmail,
      messageId: info.messageId
    });
    
  } catch (error) {
    console.error('Error in send-test-email:', error);
    res.status(500).json({ 
      error: 'Failed to send email', 
      details: error.message 
    });
  }
});


// ===== STRIPE PAYMENT PROCESSING =====
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', planId, userId } = req.body;

    if (!amount || !planId || !userId) {
      return res.status(400).json({ error: 'Missing required payment data' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        planId,
        userId,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      error: 'Failed to create payment intent', 
      details: error.message 
    });
  }
});

app.post('/api/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId, userEmail, userName } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      const receiptData = {
        receiptNumber: `RCT-${Date.now().toString().slice(-8)}`,
        transactionId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        planName: paymentIntent.metadata.planId,
        date: new Date().toLocaleDateString()
      };

      // Send receipt email if transporter is available
      if (userEmail && emailTransporter) {
        try {
          const mailOptions = {
            from: `"ThoughtLeader AI" <${process.env.EMAIL_USER || 'noreply@thoughtleader.ai'}>`,
            to: userEmail,
            subject: 'Payment Receipt - ThoughtLeader AI',
            html: createReceiptEmailTemplate(receiptData, { email: userEmail, name: userName })
          };

          await emailTransporter.sendMail(mailOptions);
          console.log('Receipt email sent to:', userEmail);
        } catch (emailError) {
          console.error('Failed to send receipt email:', emailError);
          // Don't fail the payment confirmation if email fails
        }
      }

      res.json({
        success: true,
        receiptData,
        message: 'Payment confirmed' + (emailTransporter ? ' and receipt sent' : '')
      });
    } else {
      res.status(400).json({ error: 'Payment not completed' });
    }

  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ 
      error: 'Failed to confirm payment', 
      details: error.message 
    });
  }
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'ThoughtLeader AI API is running',
    env: {
      hasGroqApiKey: !!process.env.GROQ_API_KEY,
      hasEmailConfig: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) || 
                     !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      emailTransporterStatus: emailTransporter ? 'configured' : 'not configured',
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      port: PORT,
      nodeEnv: process.env.NODE_ENV || 'development'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Express Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email Config: ${process.env.EMAIL_USER && process.env.EMAIL_PASSWORD ? 'SET' : 'MISSING'}`);
  console.log(`💳 Stripe Config: ${process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING'}`);
  console.log(`📬 Email Transporter: ${emailTransporter ? 'READY' : 'NOT AVAILABLE'}`);
  console.log(`🌐 CORS: Fixed for all origins`);
  console.log('✅ Server ready with email and payment processing');
  console.log('🔧 Test CORS at: http://localhost:3001/api/test-cors');
});
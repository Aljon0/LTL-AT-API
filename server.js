import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import Groq from 'groq-sdk';
import multer from 'multer';

// Configure dotenv
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize GROQ client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Configure multer for file uploads (in-memory)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf', 
      'text/plain'
    ];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

// Helper function to extract text from documents (simplified)
async function extractTextFromDocument(file) {
  try {
    console.log(`Processing file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`);
    
    switch (file.mimetype) {
      case 'application/pdf':
        // For now, return a placeholder - we'll add PDF parsing later
        console.log(`PDF file received: ${file.originalname} (${file.size} bytes)`);
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
        console.warn(`Unsupported file type: ${file.mimetype}`);
        return `[Unsupported file type: ${file.mimetype}]`;
    }
  } catch (error) {
    console.error(`General error extracting text from ${file.originalname}:`, error);
    return `[Error reading document: ${file.originalname} - ${error.message}]`;
  }
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== EXISTING LINKEDIN AUTH ENDPOINTS =====

// LinkedIn OAuth endpoint
app.post('/api/auth/linkedin/callback', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    console.log('Received LinkedIn callback:', { code: !!code, redirectUri });

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', process.env.LINKEDIN_CLIENT_ID);
    params.append('client_secret', process.env.LINKEDIN_CLIENT_SECRET);

    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = tokenResponse.data;
    console.log('Got LinkedIn access token');

    const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const linkedInUser = profileResponse.data;
    console.log('Got LinkedIn user profile:', linkedInUser.name);

    res.json({
      success: true,
      user: {
        id: linkedInUser.sub,
        email: linkedInUser.email,
        name: linkedInUser.name,
        picture: linkedInUser.picture,
        provider: 'linkedin'
      },
      accessToken: access_token
    });

  } catch (error) {
    console.error('LinkedIn OAuth error:', error);
    
    if (error.response) {
      console.error('LinkedIn API error:', error.response.data);
      return res.status(error.response.status).json({
        error: 'LinkedIn authentication failed',
        details: error.response.data
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to authenticate with LinkedIn',
      details: error.message 
    });
  }
});

// Simple user endpoints
app.post('/api/auth/user', async (req, res) => {
  try {
    const { uid, email, name, avatar, provider } = req.body;
    
    const user = {
      id: uid,
      email,
      name,
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

app.get('/api/auth/user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    res.json({ user: null });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// ===== DOCUMENT PROCESSING ENDPOINT =====

// Process documents and return extracted text
app.post('/api/process-documents', upload.array('documents'), async (req, res) => {
  try {
    console.log('=== Document Processing Request ===');
    console.log('Files received:', req.files?.length || 0);
    
    if (!req.files || req.files.length === 0) {
      return res.json({ documentContext: '', processedFiles: 0, totalCharacters: 0 });
    }

    console.log('Processing uploaded documents...');
    const documentTexts = await Promise.all(
      req.files.map(async (file, index) => {
        console.log(`Processing file ${index + 1}/${req.files.length}: ${file.originalname}`);
        const text = await extractTextFromDocument(file);
        return `--- ${file.originalname} ---\n${text}\n`;
      })
    );
    
    const documentContext = documentTexts.join('\n');
    console.log(`Processing complete: ${documentContext.length} characters from ${req.files.length} documents`);

    res.json({ 
      documentContext,
      processedFiles: req.files.length,
      totalCharacters: documentContext.length,
      message: 'Documents processed successfully'
    });

  } catch (error) {
    console.error('Error processing documents:', error);
    res.status(500).json({ 
      error: 'Failed to process documents', 
      details: error.message 
    });
  }
});

// Generate LinkedIn post using GROQ with document context
app.post('/api/generate-post', async (req, res) => {
  try {
    const { userId, prompt, context, profileData, documentContext } = req.body;

    console.log('=== Post Generation Request ===');
    console.log('User ID:', userId);
    console.log('Prompt:', prompt);
    console.log('Has document context:', !!documentContext);
    console.log('Document context length:', documentContext?.length || 0);

    if (!profileData) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    // Construct enhanced prompt with user context
    const systemPrompt = `You are a LinkedIn content creator helping ${profileData.linkedinUrl ? 'a professional' : 'someone'} create engaging posts.

User's Profile:
- Goals: ${profileData.goals}
- Voice Style: ${profileData.voiceStyle}
- Topics: ${profileData.topics?.join(', ')}
- LinkedIn URL: ${profileData.linkedinUrl}

${documentContext ? `
Additional Context from User's Documents:
${documentContext.substring(0, 2000)}...
` : ''}

Create a LinkedIn post that:
1. Matches their ${profileData.voiceStyle} voice style
2. Aligns with their goals: ${profileData.goals}
3. Is relevant to their topics of interest
4. Uses insights from their provided documents (if available)
5. Is engaging and professional
6. Includes relevant hashtags
7. Is between 150-300 words

Post topic/prompt: ${prompt}
${context ? `Additional context: ${context}` : ''}`;

    console.log('Sending request to GROQ...');
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 1000,
    });

    const generatedPost = completion.choices[0]?.message?.content;
    console.log('Post generated successfully');

    res.json({ 
      post: generatedPost,
      metadata: {
        model: "mixtral-8x7b-32768",
        timestamp: new Date().toISOString(),
        usedDocumentContext: !!documentContext,
        documentContextLength: documentContext?.length || 0
      }
    });
  } catch (error) {
    console.error('Error generating post:', error);
    res.status(500).json({ error: 'Failed to generate post', details: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'LinkedIn Auth API is running',
    env: {
      hasLinkedInClientId: !!process.env.LINKEDIN_CLIENT_ID,
      hasLinkedInClientSecret: !!process.env.LINKEDIN_CLIENT_SECRET,
      hasGroqApiKey: !!process.env.GROQ_API_KEY,
      port: PORT,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🔑 LinkedIn Client ID: ${process.env.LINKEDIN_CLIENT_ID ? 'SET' : 'MISSING'}`);
  console.log(`🔐 LinkedIn Client Secret: ${process.env.LINKEDIN_CLIENT_SECRET ? 'SET' : 'MISSING'}`);
  console.log(`🤖 GROQ API Key: ${process.env.GROQ_API_KEY ? 'SET' : 'MISSING'}`);
});
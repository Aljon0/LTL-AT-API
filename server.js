// server.js - Single file solution
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

// Configure dotenv
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// LinkedIn OAuth endpoint
app.post('/api/auth/linkedin/callback', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    console.log('Received LinkedIn callback:', { code: !!code, redirectUri });

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Create URLSearchParams for the request
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', process.env.LINKEDIN_CLIENT_ID);
    params.append('client_secret', process.env.LINKEDIN_CLIENT_SECRET);

    // Exchange code for access token
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

    // Get user profile from LinkedIn
    const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const linkedInUser = profileResponse.data;
    console.log('Got LinkedIn user profile:', linkedInUser.name);

    // Return user data
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
    
    // Create user object - in production, save this to a database
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
    
    // In production, fetch this from your database
    // For now, return null to indicate user doesn't exist
    res.json({ user: null });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
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
      port: PORT,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
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
});
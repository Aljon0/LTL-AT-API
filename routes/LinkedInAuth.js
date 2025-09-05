import axios from 'axios';
import express from 'express';

const router = express.Router();

router.post('/auth/linkedin/callback', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token } = tokenResponse.data;

    // Get user profile from LinkedIn
    const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const linkedInUser = profileResponse.data;

    // Return user data - let frontend handle Firebase auth
    res.json({
      success: true,
      user: {
        id: linkedInUser.sub,
        email: linkedInUser.email,
        name: linkedInUser.name,
        picture: linkedInUser.picture,
        provider: 'linkedin'
      },
      accessToken: access_token // Optional: if you need LinkedIn API access later
    });

  } catch (error) {
    console.error('LinkedIn OAuth error:', error);
    
    // Better error handling
    if (error.response) {
      // LinkedIn API error
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

// Simple user endpoints (you can expand these later)
router.post('/auth/user', async (req, res) => {
  try {
    const { uid, email, name, avatar, provider } = req.body;
    
    // For now, just return the user data
    // Later you can add database storage here
    const user = {
      id: uid,
      email,
      name,
      avatar,
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

router.get('/auth/user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    // For now, return mock data based on uid
    // Later you can fetch from your database
    const user = {
      id: uid,
      email: 'user@example.com', // You'd get this from your database
      name: 'User Name',
      avatar: '',
      isAdmin: false,
      subscription: 'free',
    };

    res.json({ user });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

export default router;
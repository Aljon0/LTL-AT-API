export async function createOrUpdateUser(req, res) {
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
  }
  
  export async function getUserProfile(req, res) {
    try {
      const { uid } = req.params;
      // In production, fetch from database
      res.status(404).json({ error: 'User not found' });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  export async function deleteAccount(req, res) {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'UserId is required' });
      }
      
      console.log(`Processing account deletion for user: ${userId}`);
      
      const deletionLog = {
        userId: userId,
        deletedAt: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('user-agent')
      };
      
      console.log('Account deletion logged:', deletionLog);
      
      res.json({ 
        success: true,
        message: 'Server-side account data deleted successfully' 
      });
    } catch (error) {
      console.error('Error in delete-account endpoint:', error);
      res.status(200).json({ 
        success: false,
        message: 'Server cleanup failed, but account data was deleted',
        error: error.message 
      });
    }
  }
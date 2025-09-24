import { getEmailTransporter } from '../config/email.js';
import { sendDualPostEmail } from '../services/emailService.js';

export async function sendTestEmail(req, res) {
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

    const result = await sendDualPostEmail(shortPost, longPost, userEmail);
    
    res.json(result);
  } catch (error) {
    console.error('Error in send-test-email:', error);
    res.status(500).json({ 
      error: 'Failed to send email', 
      details: error.message 
    });
  }
}

export async function testEmailConfig(req, res) {
  try {
    console.log('Testing email configuration...');
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET (length: ' + process.env.EMAIL_PASSWORD.length + ')' : 'NOT SET');
    
    const emailTransporter = getEmailTransporter();
    
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
}

import dotenv from 'dotenv';
import express from 'express';
import Groq from 'groq-sdk';
import multer from 'multer';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';

// Configure dotenv
dotenv.config();

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
  try {
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

// Enhanced email templates
function createLinkedInPostEmailTemplate(postContent, userProfile) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your LinkedIn Post is Ready</title>
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
            max-width: 600px; 
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
        .post-preview { 
            background: linear-gradient(135deg, #f9fafb, #f4f4f5);
            border: 2px solid #e4e4e7; 
            border-radius: 16px; 
            padding: 32px; 
            margin: 32px 0; 
            position: relative;
            box-shadow: 0 10px 25px -12px rgba(0, 0, 0, 0.1);
        }
        .post-content { 
            font-size: 16px; 
            line-height: 1.7; 
            color: #374151; 
            white-space: pre-wrap;
            font-weight: 500;
        }
        .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg,rgb(49, 52, 54),rgb(25, 29, 31));
            color: white; 
            padding: 20px 40px; 
            border-radius: 12px; 
            text-decoration: none; 
            font-weight: 600; 
            font-size: 16px;
            box-shadow: 0 8px 25px -8px rgba(0, 119, 181, 0.5);
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Your LinkedIn Post is Ready!</h1>
            <p>Generated specifically for your professional brand</p>
        </div>
        
        <div class="content">
            <h2>Here's your AI-generated LinkedIn post:</h2>
            
            <div class="post-preview">
                <div class="post-content">${postContent}</div>
            </div>
            
            <div style="text-align: center; margin: 40px 0;">
                <a href="https://linkedin.com/feed" class="cta-button" target="_blank">
                    Post to LinkedIn →
                </a>
            </div>
        </div>
        
        <div class="footer">
            <div style="font-weight: 700; color: #18181b; margin-bottom: 8px;">ThoughtLeader AI</div>
            <p>Automated LinkedIn Content Generation</p>
            <p style="margin-top: 16px; font-size: 12px;">This email was sent to ${userProfile?.email || 'your email'}</p>
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

// ===== AI CONTENT GENERATION =====
app.post('/api/generate-post', async (req, res) => {
  try {
    const { userId, prompt, context, profileData, documentContext } = req.body;

    console.log('=== Post Generation Request ===');
    console.log('User ID:', userId);
    console.log('Prompt length:', prompt?.length || 0);
    console.log('Document context length:', documentContext?.length || 0);

    if (!userId || !prompt || !profileData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'AI service configuration error' });
    }

    const systemPrompt = `You are a LinkedIn content creator helping ${profileData.linkedinUrl ? 'a professional' : 'someone'} create engaging posts.

User's Profile:
- Goals: ${profileData.goals || 'Not specified'}
- Voice Style: ${profileData.voiceStyle || 'Professional'}
- Topics: ${profileData.topics?.join(', ') || 'General business'}
- LinkedIn URL: ${profileData.linkedinUrl || 'Not provided'}

${documentContext ? `
Additional Context from User's Documents:
${documentContext.substring(0, 2000)}${documentContext.length > 2000 ? '...' : ''}
` : ''}

Create a LinkedIn post that:
1. Matches their ${profileData.voiceStyle || 'professional'} voice style
2. Aligns with their goals: ${profileData.goals || 'professional growth'}
3. Is relevant to their topics of interest
4. Uses insights from their provided documents (if available)
5. Is engaging and professional
6. Includes relevant hashtags
7. Is between 150-300 words

Post topic/prompt: ${prompt}
${context ? `Additional context: ${context}` : ''}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1000,
    });

    const generatedPost = completion.choices[0]?.message?.content;
    
    if (!generatedPost) {
      throw new Error('No content generated from AI service');
    }

    res.json({ 
      post: generatedPost,
      metadata: {
        model: "llama-3.3-70b-versatile",
        timestamp: new Date().toISOString(),
        usedDocumentContext: !!documentContext,
        documentContextLength: documentContext?.length || 0,
        userId: userId
      }
    });
  } catch (error) {
    console.error('Error generating post:', error);
    res.status(500).json({ 
      error: 'Failed to generate post', 
      details: error.message 
    });
  }
});

// ===== EMAIL SERVICES =====
app.post('/api/send-test-email', async (req, res) => {
  try {
    const { userId, postContent, userEmail } = req.body;

    console.log('=== Email Send Request ===');
    console.log('User ID:', userId);
    console.log('User Email:', userEmail);
    console.log('Content Length:', postContent?.length || 0);
    console.log('Email transporter available:', !!emailTransporter);

    if (!userId || !postContent) {
      return res.status(400).json({ error: 'User ID and post content are required' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Check if email transporter is available
    if (!emailTransporter) {
      console.error('Email transporter not available');
      return res.status(500).json({ 
        error: 'Email service not configured',
        details: 'Please check server email configuration. Visit /api/test-email-config for diagnostics.'
      });
    }

    const mailOptions = {
      from: `"ThoughtLeader AI" <${process.env.EMAIL_USER || 'noreply@thoughtleader.ai'}>`,
      to: userEmail,
      subject: '🚀 Your LinkedIn Post is Ready!',
      html: createLinkedInPostEmailTemplate(postContent, { email: userEmail })
    };

    console.log('Attempting to send email to:', userEmail);
    
    try {
      const info = await emailTransporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      
      res.json({ 
        message: 'Email sent successfully',
        sentTo: userEmail,
        messageId: info.messageId
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Provide more specific error messages
      if (emailError.code === 'EAUTH') {
        return res.status(500).json({ 
          error: 'Email authentication failed. Please check your Gmail app password.',
          details: 'Make sure you have 2FA enabled and are using an app password, not your regular password.'
        });
      } else if (emailError.code === 'ECONNECTION') {
        return res.status(500).json({ 
          error: 'Cannot connect to email server. Please check your internet connection.',
          details: emailError.message
        });
      } else {
        return res.status(500).json({ 
          error: 'Failed to send email',
          details: emailError.message
        });
      }
    }

  } catch (error) {
    console.error('Error in send-test-email endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
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
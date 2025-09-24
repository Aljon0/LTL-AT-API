import nodemailer from 'nodemailer';

let emailTransporter = null;

function createEmailTransporter() {
  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      console.log('Creating Gmail transporter...');
      console.log('Email user:', process.env.EMAIL_USER);
      console.log('Password length:', process.env.EMAIL_PASSWORD.length);
      
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
    
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log('Creating custom SMTP transporter...');
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
}

export function getEmailTransporter() {
  if (!emailTransporter) {
    emailTransporter = createEmailTransporter();
  }
  return emailTransporter;
}

export async function verifyEmailService() {
  const transporter = getEmailTransporter();
  if (transporter) {
    try {
      await transporter.verify();
      console.log('Email service verified and ready');
    } catch (error) {
      console.error('Email verification failed:', error.message);
    }
  } else {
    console.warn('Email service not configured - emails will be disabled');
  }
}
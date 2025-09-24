import { getEmailTransporter } from '../config/email.js';
import { createDualPostEmailTemplate, createReceiptEmailTemplate } from '../utils/emailTemplates.js';

export async function sendDualPostEmail(shortPost, longPost, userEmail) {
  const emailTransporter = getEmailTransporter();
  
  if (!emailTransporter) {
    throw new Error('Email service not configured');
  }

  const mailOptions = {
    from: `"ThoughtLeader AI" <${process.env.EMAIL_USER || 'noreply@thoughtleader.ai'}>`,
    to: userEmail,
    subject: '🚀 Your LinkedIn Posts Are Ready! (Short + Long)',
    html: createDualPostEmailTemplate(shortPost, longPost, { email: userEmail })
  };

  const info = await emailTransporter.sendMail(mailOptions);
  console.log('Dual post email sent successfully:', info.messageId);
  
  return { 
    message: 'Email sent successfully',
    sentTo: userEmail,
    messageId: info.messageId
  };
}

export async function sendReceiptEmail(receiptData, userEmail, userName) {
  const emailTransporter = getEmailTransporter();
  
  if (!emailTransporter) {
    console.log('Email service not configured, skipping receipt email');
    return false;
  }

  try {
    const mailOptions = {
      from: `"ThoughtLeader AI" <${process.env.EMAIL_USER || 'noreply@thoughtleader.ai'}>`,
      to: userEmail,
      subject: 'Payment Receipt - ThoughtLeader AI',
      html: createReceiptEmailTemplate(receiptData, { email: userEmail, name: userName })
    };

    await emailTransporter.sendMail(mailOptions);
    console.log('Receipt email sent to:', userEmail);
    return true;
  } catch (emailError) {
    console.error('Failed to send receipt email:', emailError);
    return false;
  }
}
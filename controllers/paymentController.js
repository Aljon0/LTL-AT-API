import { getStripe } from '../config/stripe.js';
import { sendReceiptEmail } from '../services/emailService.js';

export async function createPaymentIntent(req, res) {
  try {
    const { amount, currency = 'usd', planId, userId } = req.body;

    if (!amount || !planId || !userId) {
      return res.status(400).json({ error: 'Missing required payment data' });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(500).json({ error: 'Payment service not configured' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
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
}

export async function confirmPayment(req, res) {
  try {
    const { paymentIntentId, userEmail, userName } = req.body;

    const stripe = getStripe();
    if (!stripe) {
      return res.status(500).json({ error: 'Payment service not configured' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      const receiptData = {
        receiptNumber: `RCT-${Date.now().toString().slice(-8)}`,
        transactionId: paymentIntent.id,
        amount: `$${(paymentIntent.amount / 100).toFixed(2)}`,
        planName: paymentIntent.metadata.planId,
        date: new Date().toLocaleDateString()
      };

      let emailSent = false;
      if (userEmail) {
        emailSent = await sendReceiptEmail(receiptData, userEmail, userName);
      }

      res.json({
        success: true,
        receiptData,
        message: 'Payment confirmed' + (emailSent ? ' and receipt sent' : '')
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
}

export async function upgradeSubscription(req, res) {
  try {
    const { userId, planId, amount, paymentIntentId } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`Upgrading user ${userId} to ${planId} plan`);

    const receiptData = {
      receiptNumber: `RCT-${Date.now().toString().slice(-8)}`,
      transactionId: paymentIntentId || `txn_${Math.random().toString(36).substr(2, 9)}`,
      amount: amount,
      planName: planId,
      date: new Date().toLocaleDateString()
    };

    res.json({
      success: true,
      message: 'Subscription upgraded successfully',
      receiptData
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ 
      error: 'Failed to upgrade subscription', 
      details: error.message 
    });
  }
}
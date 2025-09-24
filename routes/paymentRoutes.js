import { Router } from 'express';
import { confirmPayment, createPaymentIntent, upgradeSubscription } from '../controllers/paymentController.js';

const router = Router();

router.post('/create-payment-intent', createPaymentIntent);
router.post('/confirm-payment', confirmPayment);
router.post('/upgrade-subscription', upgradeSubscription);

export default router;

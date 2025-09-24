import { Router } from 'express';
import { sendTestEmail, testEmailConfig } from '../controllers/emailController.js';

const router = Router();

router.post('/send-test-email', sendTestEmail);
router.get('/test-email-config', testEmailConfig);

export default router;
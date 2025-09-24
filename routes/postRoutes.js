import { Router } from 'express';
import { generatePostWithTrends } from '../controllers/postController.js';

const router = Router();

router.post('/generate-post-with-trends', generatePostWithTrends);

export default router;
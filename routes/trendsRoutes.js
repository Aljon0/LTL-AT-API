import { Router } from 'express';
import { getTrends, refreshTrends } from '../controllers/trendsController.js';

const router = Router();

router.get('/', getTrends);
router.post('/refresh', refreshTrends);

export default router;

import { Router } from 'express';
import { processDocuments } from '../controllers/documentController.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/process-documents', upload.array('documents'), processDocuments);

export default router;

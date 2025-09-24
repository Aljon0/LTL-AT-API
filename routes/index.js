import { Router } from 'express';
import authRoutes from './authRoutes.js';
import documentRoutes from './documentRoutes.js';
import emailRoutes from './emailRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import postRoutes from './postRoutes.js';
import trendsRoutes from './trendsRoutes.js';

const router = Router();

// Test endpoint
router.get('/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS is working!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/', postRoutes); // Keep original paths
router.use('/trends', trendsRoutes);
router.use('/', emailRoutes); // Keep original paths  
router.use('/', paymentRoutes); // Keep original paths
router.use('/', documentRoutes); // Keep original paths

export default router;

import { Router } from 'express';
import { createOrUpdateUser, deleteAccount, getUserProfile } from '../controllers/authController.js';

const router = Router();

router.post('/user', createOrUpdateUser);
router.get('/user/:uid', getUserProfile);

// This route is at root level
router.post('/delete-account', deleteAccount);

export default router;

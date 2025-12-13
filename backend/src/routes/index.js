import { Router } from 'express';
import authRoutes from './auth.js';
import adminRoutes from './admin.js';
import sampleRoutes from './sample.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/hello', sampleRoutes);

export default router;

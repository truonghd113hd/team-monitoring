import { Router } from 'express';
import { getStats, getProjectStats } from '../controllers/statsController';

const router = Router();

router.get('/', getStats);
router.get('/projects', getProjectStats);

export default router;

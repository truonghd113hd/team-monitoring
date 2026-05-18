import { Router } from 'express';
import { syncFromGoogleSheets } from '../controllers/syncController';

const router = Router();

router.post('/google-sheets', syncFromGoogleSheets);

export default router;

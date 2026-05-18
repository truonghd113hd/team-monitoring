import { Router } from 'express';
import {
  getAllFiles,
  getFile,
  updateFile,
  deleteFile
} from '../controllers/fileController';

const router = Router();

router.get('/', getAllFiles);
router.get('/:id', getFile);
router.put('/:id', updateFile);
router.delete('/:id', deleteFile);

export default router;

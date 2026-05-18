import { Router } from 'express';
import {
  getMonthNotes,
  getNoteByDate,
  upsertNote,
  deleteNote
} from '../controllers/noteController';

const router = Router();

router.get('/month', getMonthNotes);
router.get('/:date', getNoteByDate);
router.post('/', upsertNote);
router.delete('/:date', deleteNote);

export default router;

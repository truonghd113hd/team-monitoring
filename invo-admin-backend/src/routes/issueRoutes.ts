import { Router } from 'express';
import {
  getAllIssues,
  getIssue,
  updateIssue,
  completeIssue,
  deleteIssue
} from '../controllers/issueController';

const router = Router();

router.get('/', getAllIssues);
router.get('/:id', getIssue);
router.put('/:id', updateIssue);
router.put('/:id/complete', completeIssue);
router.delete('/:id', deleteIssue);

export default router;

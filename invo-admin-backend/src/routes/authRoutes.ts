import { Router, Request, Response } from 'express';
import User from '../models/User';
import { login } from '../services/authService';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' });
      return;
    }
    const { token, user } = await login(email, password);
    res.json({ success: true, data: { token, user } });
  } catch (err) {
    res.status(401).json({ success: false, message: (err as Error).message });
  }
});

// GET /api/auth/me — returns current user
router.get('/me', authenticate, (req: Request, res: Response): void => {
  res.json({ success: true, data: req.user });
});

// ── User management (admin only) ──────────────────────────

// GET /api/auth/users
router.get('/users', authenticate, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// POST /api/auth/users — create user
router.post('/users', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, message: 'email, password and name are required' });
      return;
    }
    const user = await User.create({ email, password, name, role: role || 'viewer' });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    const code = (err as any).code;
    if (code === 11000) {
      res.status(409).json({ success: false, message: 'Email already in use' });
    } else {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  }
});

// PUT /api/auth/users/:id — update name, role, isActive (admin only; cannot demote own account)
router.put('/users/:id', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (String(req.params.id) === req.user!.userId && req.body.role && req.body.role !== 'admin') {
      res.status(400).json({ success: false, message: 'Cannot demote your own admin account' });
      return;
    }
    const allowed: any = {};
    if (req.body.name !== undefined) allowed.name = req.body.name;
    if (req.body.role !== undefined) allowed.role = req.body.role;
    if (req.body.isActive !== undefined) allowed.isActive = req.body.isActive;
    // Allow password reset by admin
    if (req.body.password) allowed.password = req.body.password;

    const user = await User.findByIdAndUpdate(req.params.id, allowed, { new: true, runValidators: true });
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', authenticate, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (String(req.params.id) === req.user!.userId) {
      res.status(400).json({ success: false, message: 'Cannot delete your own account' });
      return;
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// PUT /api/auth/change-password — any user can change own password
router.put('/change-password', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'currentPassword and newPassword required' });
      return;
    }
    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    const ok = await user.comparePassword(currentPassword);
    if (!ok) { res.status(400).json({ success: false, message: 'Current password is incorrect' }); return; }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;

import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import connectDB from './config/database';

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
import projectRoutes from './routes/projectRoutes';
import fileRoutes from './routes/fileRoutes';
import issueRoutes from './routes/issueRoutes';
import noteRoutes from './routes/noteRoutes';
import notificationRoutes from './routes/notificationRoutes';
import syncRoutes from './routes/syncRoutes';
import statsRoutes from './routes/statsRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import agentRoutes from './routes/agentRoutes';
import publicStatusRoutes from './routes/publicStatusRoutes';
import authRoutes from './routes/authRoutes';
import { authenticate } from './middleware/auth';

// Public routes (no auth required)
app.use('/api/auth', authRoutes);       // login + user management
app.use('/api/agent', agentRoutes);     // agent token auth handled inside the route
app.use('/api/public', publicStatusRoutes); // public status page

// All remaining routes require a valid JWT
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/files', authenticate, fileRoutes);
app.use('/api/issues', authenticate, issueRoutes);
app.use('/api/notes', authenticate, noteRoutes);
app.use('/api/notifications', authenticate, notificationRoutes);
app.use('/api/sync', authenticate, syncRoutes);
app.use('/api/stats', authenticate, statsRoutes);
app.use('/api/monitoring', authenticate, monitoringRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal Server Error' 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Note: Run note notification job separately with: npm run job:note-notifications`);
});

export default app;

import { Request, Response } from 'express';
import Issue from '../models/Issue';
import File from '../models/File';

// Get all issues with filters
export const getAllIssues = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, fileId, systemStatus, severity, assignee, sortBy } = req.query;
    const filter: any = {};
    
    if (projectId) filter.projectId = projectId;
    if (fileId) filter.fileId = fileId;
    if (systemStatus) filter.systemStatus = systemStatus;
    if (severity) filter.severity = severity;
    if (assignee) filter.assignee = assignee;
    
    // Determine sort order
    let sortOption: any = { createdAt: -1 }; // default sort
    if (sortBy === 'issueId') {
      sortOption = { issueId: 1 };
    } else if (sortBy === 'issueId_desc') {
      sortOption = { issueId: -1 };
    }
    
    const issues = await Issue.find(filter)
      .populate('projectId', 'name')
      .populate('fileId', 'fileName')
      .sort(sortOption);
    
    res.json({
      success: true,
      data: issues
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Get single issue
export const getIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('projectId', 'name')
      .populate('fileId', 'fileName');
    
    if (!issue) {
      res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: issue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Update issue
export const updateIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!issue) {
      res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: issue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Transition issue systemStatus progressively: open -> progress -> completed
export const completeIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
      return;
    }

    const oldStatus = issue.systemStatus;

    // Transition: open -> progress -> completed
    let newStatus: 'open' | 'progress' | 'completed';
    let message: string;
    
    if (issue.systemStatus === 'open') {
      newStatus = 'progress';
      message = 'Issue moved to progress';
    } else if (issue.systemStatus === 'progress') {
      newStatus = 'completed';
      issue.completedAt = new Date();
      message = 'Issue marked as completed';
    } else {
      // Already completed, no change
      res.json({
        success: true,
        message: 'Issue is already completed',
        data: issue
      });
      return;
    }
    
    issue.systemStatus = newStatus;
    await issue.save();

    // Update file statistics when transitioning to completed
    if (newStatus === 'completed' && oldStatus !== 'completed') {
      const file = await File.findById(issue.fileId);
      if (file) {
        // Decrease pending issues, increase resolved issues
        file.pendingIssues = Math.max(0, file.pendingIssues - 1);
        file.resolvedIssues += 1;
        
        // Update progress percentage
        if (file.totalIssues > 0) {
          file.progress = Math.round((file.resolvedIssues / file.totalIssues) * 100);
        }
        
        // Update file status
        file.status = file.pendingIssues === 0 ? 'completed' : 'in-progress';
        file.lastUpdated = new Date();
        
        await file.save();
      }
    }
    
    res.json({
      success: true,
      message,
      data: issue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Delete issue
export const deleteIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const issue = await Issue.findByIdAndDelete(req.params.id);
    
    if (!issue) {
      res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Issue deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

import { Request, Response } from 'express';
import Project from '../models/Project';
import File from '../models/File';
import Issue from '../models/Issue';

// Get all projects with stats
export const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const filesCount = await File.countDocuments({ projectId: project._id });
        const issuesCount = await Issue.countDocuments({ projectId: project._id });
        const pendingIssues = await Issue.countDocuments({ 
          projectId: project._id, 
          systemStatus: { $in: ['open', 'progress'] } 
        });
        
        return {
          ...project.toObject(),
          stats: {
            filesCount,
            issuesCount,
            pendingIssues
          }
        };
      })
    );
    
    res.json({
      success: true,
      data: projectsWithStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Get single project
export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Create project
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.create(req.body);
    
    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Update project
export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Delete project and all related files and issues
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found'
      });
      return;
    }
    
    // Delete all related issues first
    const deletedIssues = await Issue.deleteMany({ projectId: req.params.id });
    
    // Delete all related files
    const deletedFiles = await File.deleteMany({ projectId: req.params.id });
    
    // Finally delete the project
    await Project.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Project and all related data deleted successfully',
      data: {
        deletedProject: project.name,
        deletedFiles: deletedFiles.deletedCount,
        deletedIssues: deletedIssues.deletedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

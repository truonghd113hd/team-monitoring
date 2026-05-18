import { Request, Response } from 'express';
import File from '../models/File';
import Issue from '../models/Issue';

// Get all files
export const getAllFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    const filter: any = {};
    
    if (projectId) {
      filter.projectId = projectId;
    }
    
    const files = await File.find(filter)
      .populate('projectId', 'name')
      .sort({ lastUpdated: -1 });
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Get single file
export const getFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = await File.findById(req.params.id).populate('projectId', 'name');
    
    if (!file) {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: file
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Update file
export const updateFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = await File.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!file) {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: file
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Delete file and all related issues
export const deleteFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
      return;
    }
    
    // Delete all related issues
    const deletedIssues = await Issue.deleteMany({ fileId: req.params.id });
    
    // Delete the file
    await File.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'File and all related issues deleted successfully',
      data: {
        deletedFile: file.fileName,
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

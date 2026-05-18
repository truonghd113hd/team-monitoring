import { Request, Response } from 'express';
import Note from '../models/Note';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// Get notes for a month
export const getMonthNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, month, projectId } = req.query;
    
    if (!year || !month) {
      res.status(400).json({
        success: false,
        message: 'Year and month are required'
      });
      return;
    }
    
    const date = new Date(parseInt(year as string), parseInt(month as string) - 1);
    const startDate = format(startOfMonth(date), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(date), 'yyyy-MM-dd');
    
    const filter: any = {
      date: { $gte: startDate, $lte: endDate }
    };
    
    if (projectId) {
      filter.projectId = projectId;
    }
    
    const notes = await Note.find(filter).sort({ date: 1 });
    
    res.json({
      success: true,
      data: notes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Get note by date
export const getNoteByDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.params;
    const { projectId } = req.query;
    
    const filter: any = { date };
    if (projectId) {
      filter.projectId = projectId;
    }
    
    const note = await Note.findOne(filter);
    
    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Create or update note
export const upsertNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, content, projectId } = req.body;
    
    if (!date || !content) {
      res.status(400).json({
        success: false,
        message: 'Date and content are required'
      });
      return;
    }
    
    const filter: any = { date };
    if (projectId) {
      filter.projectId = projectId;
    }
    
    let note = await Note.findOne(filter);
    
    if (note) {
      note.content = content;
      await note.save();
    } else {
      note = await Note.create({
        date,
        content,
        projectId: projectId || null
      });
    }
    
    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Delete note
export const deleteNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.params;
    const { projectId } = req.query;
    
    const filter: any = { date };
    if (projectId) {
      filter.projectId = projectId;
    }
    
    const note = await Note.findOneAndDelete(filter);
    
    if (!note) {
      res.status(404).json({
        success: false,
        message: 'Note not found'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

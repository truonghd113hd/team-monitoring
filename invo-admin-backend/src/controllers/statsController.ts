import { Request, Response } from 'express';
import Project from '../models/Project';
import File from '../models/File';
import Issue from '../models/Issue';

// Get overall stats
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    const filter: any = {};
    
    if (projectId) filter.projectId = projectId;
    
    const [
      totalProjects,
      totalFiles,
      totalIssues,
      openIssues,
      resolvedIssues,
      criticalIssues
    ] = await Promise.all([
      projectId ? 1 : Project.countDocuments({ status: 'active' }),
      File.countDocuments(filter),
      Issue.countDocuments(filter),
      Issue.countDocuments({ ...filter, systemStatus: { $in: ['open', 'update', 'progress'] } }),
      Issue.countDocuments({ ...filter, systemStatus: 'completed' }),
      Issue.countDocuments({ ...filter, severity: 'critical' })
    ]);
    
    // Issues by severity
    const issuesBySeverity = await Issue.aggregate([
      ...(projectId ? [{ $match: filter }] : []),
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Issues by status
    const issuesByStatus = await Issue.aggregate([
      ...(projectId ? [{ $match: filter }] : []),
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Files with most issues
    const topFiles = await Issue.aggregate([
      ...(projectId ? [{ $match: filter }] : []),
      {
        $group: {
          _id: '$fileId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'files',
          localField: '_id',
          foreignField: '_id',
          as: 'file'
        }
      },
      { $unwind: '$file' },
      {
        $project: {
          fileName: '$file.fileName',
          issueCount: '$count'
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalProjects,
          totalFiles,
          totalIssues,
          openIssues,
          resolvedIssues,
          criticalIssues,
          resolutionRate: totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 0
        },
        issuesBySeverity: issuesBySeverity.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        issuesByStatus: issuesByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        topFiles
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Get stats grouped by project
export const getProjectStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all active projects with their issue counts
    const projectStats = await Project.aggregate([
      { $match: { status: 'active' } },
      {
        $lookup: {
          from: 'files',
          localField: '_id',
          foreignField: 'projectId',
          as: 'files'
        }
      },
      {
        $lookup: {
          from: 'issues',
          localField: '_id',
          foreignField: 'projectId',
          as: 'issues'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          googleSheetUrl: 1,
          status: 1,
          createdAt: 1,
          totalFiles: { $size: '$files' },
          totalIssues: { $size: '$issues' },
          openIssues: {
            $size: {
              $filter: {
                input: '$issues',
                as: 'issue',
                cond: { $in: ['$$issue.systemStatus', ['open', 'update', 'progress']] }
              }
            }
          },
          resolvedIssues: {
            $size: {
              $filter: {
                input: '$issues',
                as: 'issue',
                cond: { $eq: ['$$issue.systemStatus', 'completed'] }
              }
            }
          },
          criticalIssues: {
            $size: {
              $filter: {
                input: '$issues',
                as: 'issue',
                cond: { $eq: ['$$issue.severity', 'critical'] }
              }
            }
          },
          highIssues: {
            $size: {
              $filter: {
                input: '$issues',
                as: 'issue',
                cond: { $eq: ['$$issue.severity', 'high'] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          resolutionRate: {
            $cond: {
              if: { $gt: ['$totalIssues', 0] },
              then: {
                $multiply: [
                  { $divide: ['$resolvedIssues', '$totalIssues'] },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      { $sort: { totalIssues: -1 } }
    ]);

    res.json({
      success: true,
      data: projectStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

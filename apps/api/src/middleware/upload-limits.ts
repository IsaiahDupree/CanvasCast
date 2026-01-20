import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * File size limits configuration (DOC-005)
 * Enforces max 10MB per file and 50MB total per project
 */
export interface UploadLimitsConfig {
  maxFileSize: number; // bytes
  maxTotalSize: number; // bytes
}

/**
 * Default upload limits
 * - Individual file: 10MB
 * - Total upload: 50MB
 */
const DEFAULT_LIMITS: UploadLimitsConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalSize: 50 * 1024 * 1024, // 50MB
};

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)}MB`;
}

/**
 * Middleware to validate file upload size limits
 * Checks both individual file size and total upload size
 *
 * @param config - Optional custom limits configuration
 * @returns Express middleware function
 */
export function validateUploadLimits(
  config: UploadLimitsConfig = DEFAULT_LIMITS
): RequestHandler;
export function validateUploadLimits(
  req: Request,
  res: Response,
  next: NextFunction
): void;
export function validateUploadLimits(
  configOrReq: UploadLimitsConfig | Request = DEFAULT_LIMITS,
  res?: Response,
  next?: NextFunction
): RequestHandler | void {
  // If called with custom config, return middleware function
  if (res === undefined && next === undefined) {
    const config = configOrReq as UploadLimitsConfig;
    return (req: Request, res: Response, next: NextFunction) => {
      validateFiles(req, res, next, config);
    };
  }

  // If called as middleware directly, use default config
  const req = configOrReq as Request;
  validateFiles(req, res!, next!, DEFAULT_LIMITS);
}

/**
 * Core validation logic
 */
function validateFiles(
  req: Request,
  res: Response,
  next: NextFunction,
  config: UploadLimitsConfig
): void {
  // Collect all uploaded files
  const files: Express.Multer.File[] = [];

  // Handle single file upload
  if (req.file) {
    files.push(req.file);
  }

  // Handle multiple file upload
  if (req.files) {
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else {
      // Handle object format { fieldname: File[] }
      Object.values(req.files).forEach((fileArray) => {
        if (Array.isArray(fileArray)) {
          files.push(...fileArray);
        }
      });
    }
  }

  // If no files, allow the request to continue
  if (files.length === 0) {
    return next();
  }

  // Check individual file sizes
  for (const file of files) {
    if (file.size > config.maxFileSize) {
      return res.status(413).json({
        error: 'File too large',
        message: `Individual file "${file.originalname}" exceeds ${formatBytes(config.maxFileSize)} limit`,
        maxFileSize: formatBytes(config.maxFileSize),
        fileSize: formatBytes(file.size),
      });
    }
  }

  // Check total upload size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > config.maxTotalSize) {
    return res.status(413).json({
      error: 'Total upload size too large',
      message: `Total upload size exceeds ${formatBytes(config.maxTotalSize)} limit`,
      maxTotalSize: formatBytes(config.maxTotalSize),
      totalSize: formatBytes(totalSize),
      fileCount: files.length,
    });
  }

  // All checks passed
  next();
}

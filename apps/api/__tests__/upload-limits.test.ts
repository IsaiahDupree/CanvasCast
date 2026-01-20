import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { validateUploadLimits } from '../src/middleware/upload-limits';

describe('Upload Limits Middleware (DOC-005)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      files: [],
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('Individual File Size Validation', () => {
    it('should reject files larger than 10MB', () => {
      // Create a mock file larger than 10MB
      const largeFile = {
        fieldname: 'document',
        originalname: 'large-file.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024, // 11MB
        buffer: Buffer.alloc(11 * 1024 * 1024),
      } as Express.Multer.File;

      mockReq.files = [largeFile];

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'File too large',
        message: 'Individual file "large-file.pdf" exceeds 10MB limit',
        maxFileSize: '10MB',
        fileSize: '11MB',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept files smaller than 10MB', () => {
      const validFile = {
        fieldname: 'document',
        originalname: 'valid-file.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 5 * 1024 * 1024, // 5MB
        buffer: Buffer.alloc(5 * 1024 * 1024),
      } as Express.Multer.File;

      mockReq.files = [validFile];

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should accept files exactly at 10MB limit', () => {
      const exactFile = {
        fieldname: 'document',
        originalname: 'exact-file.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 10 * 1024 * 1024, // Exactly 10MB
        buffer: Buffer.alloc(10 * 1024 * 1024),
      } as Express.Multer.File;

      mockReq.files = [exactFile];

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Total Upload Size Validation', () => {
    it('should reject when total size exceeds 50MB', () => {
      // Create multiple files that total more than 50MB
      const files: Express.Multer.File[] = [
        {
          fieldname: 'document1',
          originalname: 'file1.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document2',
          originalname: 'file2.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document3',
          originalname: 'file3.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document4',
          originalname: 'file4.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document5',
          originalname: 'file5.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document6',
          originalname: 'file6.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 5 * 1024 * 1024, // 5MB (total = 55MB)
          buffer: Buffer.alloc(5 * 1024 * 1024),
        },
      ] as Express.Multer.File[];

      mockReq.files = files;

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Total upload size too large',
        message: 'Total upload size exceeds 50MB limit',
        maxTotalSize: '50MB',
        totalSize: '55MB',
        fileCount: 6,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept when total size is under 50MB', () => {
      const files: Express.Multer.File[] = [
        {
          fieldname: 'document1',
          originalname: 'file1.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document2',
          originalname: 'file2.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document3',
          originalname: 'file3.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB (total = 30MB)
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
      ] as Express.Multer.File[];

      mockReq.files = files;

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should accept when total size is exactly 50MB', () => {
      const files: Express.Multer.File[] = [
        {
          fieldname: 'document1',
          originalname: 'file1.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document2',
          originalname: 'file2.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document3',
          originalname: 'file3.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document4',
          originalname: 'file4.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
        {
          fieldname: 'document5',
          originalname: 'file5.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024, // 10MB (total = 50MB)
          buffer: Buffer.alloc(10 * 1024 * 1024),
        },
      ] as Express.Multer.File[];

      mockReq.files = files;

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file array', () => {
      mockReq.files = [];

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle undefined files', () => {
      mockReq.files = undefined;

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle single file upload', () => {
      const singleFile = {
        fieldname: 'document',
        originalname: 'single.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1 * 1024 * 1024, // 1MB
        buffer: Buffer.alloc(1 * 1024 * 1024),
      } as Express.Multer.File;

      mockReq.file = singleFile;
      mockReq.files = undefined;

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject single file if it exceeds 10MB', () => {
      const largeFile = {
        fieldname: 'document',
        originalname: 'large-single.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 15 * 1024 * 1024, // 15MB
        buffer: Buffer.alloc(15 * 1024 * 1024),
      } as Express.Multer.File;

      mockReq.file = largeFile;
      mockReq.files = undefined;

      validateUploadLimits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'File too large',
        message: 'Individual file "large-single.pdf" exceeds 10MB limit',
        maxFileSize: '10MB',
        fileSize: '15MB',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Configurable Limits', () => {
    it('should use custom limits when provided', () => {
      const customLimits = {
        maxFileSize: 5 * 1024 * 1024, // 5MB per file
        maxTotalSize: 20 * 1024 * 1024, // 20MB total
      };

      const file = {
        fieldname: 'document',
        originalname: 'file.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 6 * 1024 * 1024, // 6MB
        buffer: Buffer.alloc(6 * 1024 * 1024),
      } as Express.Multer.File;

      mockReq.files = [file];

      const customMiddleware = validateUploadLimits(customLimits);
      customMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'File too large',
        message: 'Individual file "file.pdf" exceeds 5MB limit',
        maxFileSize: '5MB',
        fileSize: '6MB',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

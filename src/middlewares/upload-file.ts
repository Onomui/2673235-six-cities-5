import type { Request, Response, NextFunction } from 'express';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { extname } from 'node:path';
import { extension as mimeExtension } from 'mime-types';
import { nanoid } from 'nanoid';
import { StatusCodes } from 'http-status-codes';
import { HttpError } from '../errors/http-error.js';
import type { Middleware } from './middleware.interface.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

export class UploadFileMiddleware implements Middleware {
  private readonly upload: RequestHandler;

  constructor(
    private readonly fieldName: string,
    private readonly uploadDir: string
  ) {
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (_req, file, cb) => {
        const mimeExt = mimeExtension(file.mimetype) || '';
        const origExt = extname(file.originalname);
        const ext = (mimeExt || origExt || '').replace(/^\./, '');
        const id = nanoid();
        const filename = ext ? `${id}.${ext}` : id;
        cb(null, filename);
      }
    });

    this.upload = multer({
      storage,
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          cb(new HttpError(StatusCodes.BAD_REQUEST, 'Only .jpg or .png files are allowed'));
          return;
        }
        cb(null, true);
      }
    }).single(this.fieldName);
  }

  execute(req: Request, res: Response, next: NextFunction): void {
    this.upload(req, res, (err: unknown) => {
      if (err) {
        next(new HttpError(StatusCodes.BAD_REQUEST, 'File upload error', err));
        return;
      }

      if (!req.file) {
        next(new HttpError(StatusCodes.BAD_REQUEST, 'File is required'));
        return;
      }

      next();
    });
  }
}

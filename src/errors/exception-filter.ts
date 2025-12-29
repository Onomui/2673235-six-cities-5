import { inject, injectable } from 'inversify';
import type { Request, Response, NextFunction } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import { TYPES } from '../container/types.js';
import { PinoLoggerService } from '../logger/logger.js';
import { HttpError } from './http-error.js';

export interface IExceptionFilter {
  catch(error: unknown, req: Request, res: Response, next: NextFunction): void;
}

type BodyParserError = {
  status?: number;
  statusCode?: number;
  type?: string;
  message?: string;
};

@injectable()
export class ExceptionFilter implements IExceptionFilter {
  constructor(@inject(TYPES.Logger) private readonly logger: PinoLoggerService) {}

  catch(error: unknown, req: Request, res: Response, next: NextFunction): void {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof HttpError) {
      this.logger.warn(error.message, {
        url: req.url,
        statusCode: error.statusCode,
        details: error.details
      });
      res.status(error.statusCode).json({
        error: error.message
      });
      return;
    }

    const err = error as BodyParserError;
    const status = err?.status ?? err?.statusCode;

    if (status === StatusCodes.BAD_REQUEST && err?.type === 'entity.parse.failed') {
      this.logger.warn('Bad request', { url: req.url, details: err.message });
      res.status(StatusCodes.BAD_REQUEST).json({
        error: getReasonPhrase(StatusCodes.BAD_REQUEST)
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    this.logger.error(message, { url: req.url });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR)
    });
  }
}

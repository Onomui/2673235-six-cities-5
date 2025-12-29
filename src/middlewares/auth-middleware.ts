import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HttpError } from '../errors/http-error.js';
import type { Middleware } from './middleware.interface.js';
import type { IUserRepository, WithId } from '../db/repositories/interfaces.js';
import type { UserDB } from '../db/models/user.js';
import { verifyToken } from '../utils/token.js';

export type RequestWithUser = Request & { user?: WithId<UserDB> };

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }

  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

export class AuthMiddleware implements Middleware {
  constructor(private readonly users: IUserRepository, private readonly secret: string) {}

  async execute(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = getBearerToken(req);
    if (!token) {
      next(new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized'));
      return;
    }

    const payload = await verifyToken(token, this.secret);
    if (!payload) {
      next(new HttpError(StatusCodes.UNAUTHORIZED, 'Invalid token'));
      return;
    }

    const user = await this.users.findById(payload.userId);
    if (!user) {
      next(new HttpError(StatusCodes.UNAUTHORIZED, 'User not found'));
      return;
    }

    (req as RequestWithUser).user = user;
    next();
  }
}

export class OptionalAuthMiddleware implements Middleware {
  constructor(private readonly users: IUserRepository, private readonly secret: string) {}

  async execute(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = getBearerToken(req);
    if (!token) {
      next();
      return;
    }

    const payload = await verifyToken(token, this.secret);
    if (!payload) {
      next();
      return;
    }

    const user = await this.users.findById(payload.userId);
    if (!user) {
      next();
      return;
    }

    (req as RequestWithUser).user = user;
    next();
  }
}

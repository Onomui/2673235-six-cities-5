import type { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import { inject, injectable } from 'inversify';
import { StatusCodes } from 'http-status-codes';

import { TYPES } from '../container/types.js';
import { Controller } from './controller.js';
import { PinoLoggerService } from '../logger/logger.js';

import type { IUserRepository, WithId } from '../db/repositories/interfaces.js';
import type { UserDB } from '../db/models/user.js';

import { UserRegisterDto, LoginDto } from '../dto/user.js';
import type { UserPublicDto, AuthTokenDto } from '../dto/user.js';

import { HttpError } from '../errors/http-error.js';
import { ValidateDtoMiddleware } from '../middlewares/validate-dto.js';
import { UploadFileMiddleware } from '../middlewares/upload-file.js';
import { ConfigService } from '../config/service.js';

import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { AuthMiddleware, type RequestWithUser } from '../middlewares/auth-middleware.js';

const DEFAULT_AVATAR_URL = '/static/default-avatar.png';

@injectable()
export class AuthController extends Controller {
  constructor(
    @inject(TYPES.Logger) logger: PinoLoggerService,
    @inject(TYPES.UserRepository) private readonly users: IUserRepository,
    @inject(TYPES.Config) private readonly config: ConfigService
  ) {
    super(logger, '/auth');

    const auth = new AuthMiddleware(this.users, this.config.getJwtSecret());

    this.addRoute({
      method: 'post',
      path: '/register',
      middlewares: [new ValidateDtoMiddleware(UserRegisterDto)],
      handlers: [asyncHandler(this.create.bind(this))]
    });

    this.addRoute({
      method: 'post',
      path: '/login',
      middlewares: [new ValidateDtoMiddleware(LoginDto)],
      handlers: [asyncHandler(this.login.bind(this))]
    });

    this.addRoute({
      method: 'get',
      path: '/status',
      middlewares: [auth],
      handlers: [asyncHandler(this.status.bind(this))]
    });

    this.addRoute({
      method: 'post',
      path: '/logout',
      middlewares: [auth],
      handlers: [asyncHandler(this.logout.bind(this))]
    });

    this.addRoute({
      method: 'post',
      path: '/avatar',
      middlewares: [auth, new UploadFileMiddleware('avatar', this.config.getUploadDir())],
      handlers: [asyncHandler(this.uploadAvatar.bind(this))]
    });
  }

  private async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const payload = req.body as UserRegisterDto;

    const existing = await this.users.findByEmail(payload.email);
    if (existing) {
      throw new HttpError(StatusCodes.CONFLICT, 'User with this email already exists');
    }

    const passwordHash = hashPassword(payload.password, this.config.getSalt());

    const created = await this.users.create({
      name: payload.name,
      email: payload.email,
      password: passwordHash,
      type: payload.type
    });

    this.created(res, this.toUserPublicDto(created));
  }

  private async login(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const payload = req.body as LoginDto;

    const user = await this.users.findByEmail(payload.email);
    if (!user || !user.password) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Invalid login or password');
    }

    const ok = verifyPassword(payload.password, user.password, this.config.getSalt());
    if (!ok) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Invalid login or password');
    }

    const token = await signToken(String(user._id), user.email, this.config.getJwtSecret());

    const dto: AuthTokenDto = { token };
    this.ok(res, dto);
  }

  private async status(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const currentUser = (req as RequestWithUser).user;
    if (!currentUser) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    this.ok(res, this.toUserPublicDto(currentUser));
  }

  private async logout(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    this.noContent(res);
  }

  private async uploadAvatar(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const currentUser = (req as RequestWithUser).user;
    if (!currentUser) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    if (!req.file) {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'Avatar file is required');
    }

    const avatarUrl = `/static/${req.file.filename}`;

    const updated = await this.users.updateAvatar(String(currentUser._id), avatarUrl);
    if (!updated) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'User not found');
    }

    this.ok(res, this.toUserPublicDto(updated));
  }

  private toUserPublicDto(user: WithId<UserDB>): UserPublicDto {
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
      type: user.type
    };
  }
}

import type { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import { inject, injectable } from 'inversify';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { TYPES } from '../container/types.js';
import { Controller } from './controller.js';
import { PinoLoggerService } from '../logger/logger.js';

import { CommentService } from '../services/comment.js';
import { OfferService } from '../services/offer.js';

import type { IUserRepository, WithId } from '../db/repositories/interfaces.js';
import type { UserDB } from '../db/models/user.js';
import type { CommentDB } from '../db/models/comment.js';
import type { OfferDB } from '../db/models/offer.js';

import { ConfigService } from '../config/service.js';

import { HttpError } from '../errors/http-error.js';

import { CommentCreateDto } from '../dto/comment.js';
import type { CommentDto } from '../dto/comment.js';

import { ValidateDtoMiddleware } from '../middlewares/validate-dto.js';
import { ValidateObjectIdMiddleware } from '../middlewares/validate-object-id.js';
import { AuthMiddleware, type RequestWithUser } from '../middlewares/auth-middleware.js';
import { DocumentExistsMiddleware } from '../middlewares/document-exists.js';

const MAX_COMMENTS = 50;
const DEFAULT_AVATAR_URL = '/static/default-avatar.png';

function getMongoId(doc: unknown): string {
  return String((doc as { _id: unknown })._id);
}

@injectable()
export class CommentController extends Controller {
  constructor(
    @inject(TYPES.Logger) logger: PinoLoggerService,
    @inject(TYPES.CommentService) private readonly comments: CommentService,
    @inject(TYPES.OfferService) private readonly offers: OfferService,
    @inject(TYPES.UserRepository) private readonly users: IUserRepository,
    @inject(TYPES.Config) private readonly config: ConfigService
  ) {
    super(logger, '/offers');

    const auth = new AuthMiddleware(this.users, this.config.getJwtSecret());

    this.addRoute({
      method: 'get',
      path: '/:offerId/comments',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        new DocumentExistsMiddleware<OfferDB>('offerId', this.offers, 'Offer not found')
      ],
      handlers: [asyncHandler(this.index.bind(this))]
    });

    this.addRoute({
      method: 'post',
      path: '/:offerId/comments',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        auth,
        new DocumentExistsMiddleware<OfferDB>('offerId', this.offers, 'Offer not found'),
        new ValidateDtoMiddleware(CommentCreateDto)
      ],
      handlers: [asyncHandler(this.create.bind(this))]
    });
  }

  private async index(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;

    const comments = await this.comments.findLastByOffer(offerId, MAX_COMMENTS);
    const dto = await Promise.all(comments.map((comment) => this.toDto(comment)));

    this.ok(res, dto);
  }

  private async create(req: RequestWithUser, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;

    if (!req.user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const payload = req.body as CommentCreateDto;

    const created = await this.comments.createAndUpdateStats({
      text: payload.text,
      rating: payload.rating,
      offer: new Types.ObjectId(offerId),
      author: req.user._id
    });

    const dto = await this.toDto(created);
    this.created(res, dto);
  }

  private async toDto(comment: CommentDB): Promise<CommentDto> {
    if (!comment.author) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Author not found');
    }

    const author = await this.users.findById(String(comment.author));
    if (!author) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Author not found');
    }

    return {
      id: getMongoId(comment),
      text: comment.text,
      rating: comment.rating,
      createdAt: comment.createdAt.toISOString(),
      author: this.toUserPublicDto(author)
    };
  }

  private toUserPublicDto(user: WithId<UserDB>) {
    return {
      id: getMongoId(user),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
      type: user.type
    };
  }
}

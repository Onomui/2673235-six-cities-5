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

import type { CommentDto } from '../dto/comment.js';
import { CommentCreateDto } from '../dto/comment.js';
import type { UserPublicDto } from '../dto/user.js';

import { ValidateObjectIdMiddleware } from '../middlewares/validate-object-id.js';
import { ValidateDtoMiddleware } from '../middlewares/validate-dto.js';
import { DocumentExistsMiddleware } from '../middlewares/document-exists.js';
import { AuthMiddleware, type RequestWithUser } from '../middlewares/auth-middleware.js';
import { ConfigService } from '../config/service.js';
import { HttpError } from '../errors/http-error.js';

const DEFAULT_AVATAR_URL = '/static/default-avatar.png';

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

    const auth = new AuthMiddleware(this.users, this.config.getSalt());

    this.addRoute({
      method: 'get',
      path: '/:offerId/comments',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        new DocumentExistsMiddleware('offerId', this.offers, 'Offer not found')
      ],
      handlers: [asyncHandler(this.index.bind(this))]
    });

    this.addRoute({
      method: 'post',
      path: '/:offerId/comments',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        new ValidateDtoMiddleware(CommentCreateDto),
        auth,
        new DocumentExistsMiddleware('offerId', this.offers, 'Offer not found')
      ],
      handlers: [asyncHandler(this.create.bind(this))]
    });
  }

  private async index(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;
    const items = await this.comments.findLastByOffer(offerId, 50);

    const dtos = await Promise.all(
      items.map((c: CommentDB) => this.toCommentDto(c as WithId<CommentDB>))
    );

    this.ok(res, dtos);
  }

  private async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;
    const { user } = req as RequestWithUser;

    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const payload = req.body as CommentCreateDto;

    const created = await this.comments.createAndUpdateStats({
      text: payload.text,
      rating: payload.rating,
      offer: new Types.ObjectId(offerId),
      author: user._id
    });

    const dto = await this.toCommentDto(created as WithId<CommentDB>);
    this.created(res, dto);
  }

  private async toCommentDto(comment: WithId<CommentDB>): Promise<CommentDto> {
    if (!comment.author) {
      throw new HttpError(StatusCodes.INTERNAL_SERVER_ERROR, 'Comment author is required');
    }

    const author = await this.users.findById(String(comment.author));
    if (!author) {
      throw new HttpError(StatusCodes.INTERNAL_SERVER_ERROR, 'Comment author not found');
    }

    return {
      id: String(comment._id),
      text: comment.text,
      rating: comment.rating,
      createdAt:
        comment.createdAt instanceof Date
          ? comment.createdAt.toISOString()
          : String(comment.createdAt),
      author: this.toUserPublic(author)
    };
  }

  private toUserPublic(user: WithId<UserDB>): UserPublicDto {
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
      type: user.type
    };
  }
}

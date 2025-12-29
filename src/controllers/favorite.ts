import type { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import { inject, injectable } from 'inversify';
import { StatusCodes } from 'http-status-codes';

import { TYPES } from '../container/types.js';
import { Controller } from './controller.js';
import { PinoLoggerService } from '../logger/logger.js';

import { FavoriteService } from '../services/favorite.js';
import { OfferService } from '../services/offer.js';

import type { OfferDB } from '../db/models/offer.js';
import type { OfferListItemDto } from '../dto/offer.js';

import type { IUserRepository } from '../db/repositories/interfaces.js';
import { ConfigService } from '../config/service.js';
import { AuthMiddleware, type RequestWithUser } from '../middlewares/auth-middleware.js';

import { ValidateObjectIdMiddleware } from '../middlewares/validate-object-id.js';
import { DocumentExistsMiddleware } from '../middlewares/document-exists.js';

import { HttpError } from '../errors/http-error.js';

function getMongoId(doc: unknown): string {
  return String((doc as { _id: unknown })._id);
}

@injectable()
export class FavoriteController extends Controller {
  constructor(
    @inject(TYPES.Logger) logger: PinoLoggerService,
    @inject(TYPES.FavoriteService) private readonly favorites: FavoriteService,
    @inject(TYPES.OfferService) private readonly offers: OfferService,
    @inject(TYPES.UserRepository) private readonly users: IUserRepository,
    @inject(TYPES.Config) private readonly config: ConfigService
  ) {
    super(logger, '/favorites');

    const auth = new AuthMiddleware(this.users, this.config.getJwtSecret());

    this.addRoute({
      method: 'get',
      path: '/',
      middlewares: [auth],
      handlers: [asyncHandler(this.index.bind(this))]
    });

    this.addRoute({
      method: 'put',
      path: '/:offerId',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        auth,
        new DocumentExistsMiddleware<OfferDB>('offerId', this.offers, 'Offer not found')
      ],
      handlers: [asyncHandler(this.create.bind(this))]
    });

    this.addRoute({
      method: 'delete',
      path: '/:offerId',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        auth,
        new DocumentExistsMiddleware<OfferDB>('offerId', this.offers, 'Offer not found')
      ],
      handlers: [asyncHandler(this.remove.bind(this))]
    });
  }

  private async index(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { user } = req as RequestWithUser;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const offers = await this.favorites.list(String(user._id));
    const dto = offers.map((offer) => this.toListItemDto(offer, true));

    this.ok(res, dto);
  }

  private async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;

    const { user } = req as RequestWithUser;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    await this.favorites.add(String(user._id), offerId);
    this.noContent(res);
  }

  private async remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;

    const { user } = req as RequestWithUser;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    await this.favorites.remove(String(user._id), offerId);
    this.noContent(res);
  }

  private toListItemDto(offer: OfferDB, isFavorite: boolean): OfferListItemDto {
    return {
      id: getMongoId(offer),
      price: offer.price,
      title: offer.title,
      type: offer.type,
      isFavorite,
      postDate: offer.postDate.toISOString(),
      city: offer.city,
      previewImage: offer.previewImage,
      isPremium: offer.isPremium,
      rating: offer.rating,
      commentsCount: offer.commentsCount
    };
  }
}

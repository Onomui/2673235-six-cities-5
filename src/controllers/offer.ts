import type { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import { inject, injectable } from 'inversify';
import { StatusCodes } from 'http-status-codes';

import { TYPES } from '../container/types.js';
import { Controller } from './controller.js';
import { PinoLoggerService } from '../logger/logger.js';

import type { IUserRepository, WithId } from '../db/repositories/interfaces.js';
import type { UserDB } from '../db/models/user.js';
import type { OfferDB } from '../db/models/offer.js';

import { OfferService } from '../services/offer.js';
import { FavoriteService } from '../services/favorite.js';

import { HttpError } from '../errors/http-error.js';

import { ValidateDtoMiddleware } from '../middlewares/validate-dto.js';
import { ValidateObjectIdMiddleware } from '../middlewares/validate-object-id.js';
import { AuthMiddleware, OptionalAuthMiddleware, type RequestWithUser } from '../middlewares/auth-middleware.js';
import { DocumentExistsMiddleware } from '../middlewares/document-exists.js';

import { ConfigService } from '../config/service.js';

import { OfferCreateDto, OfferUpdateDto } from '../dto/offer.js';
import type { OfferFullDto, OfferListItemDto } from '../dto/offer.js';

type OfferListQuery = {
  limit?: string;
  city?: string;
};

type OfferPremiumQuery = {
  city?: string;
};

const MAX_OFFERS_DEFAULT = 60;
const MAX_PREMIUM_OFFERS = 3;
const DEFAULT_AVATAR_URL = '/static/default-avatar.png';

function getMongoId(doc: unknown): string {
  return String((doc as { _id: unknown })._id);
}

@injectable()
export class OfferController extends Controller {
  constructor(
    @inject(TYPES.Logger) logger: PinoLoggerService,
    @inject(TYPES.OfferService) private readonly offers: OfferService,
    @inject(TYPES.FavoriteService) private readonly favorites: FavoriteService,
    @inject(TYPES.UserRepository) private readonly users: IUserRepository,
    @inject(TYPES.Config) private readonly config: ConfigService
  ) {
    super(logger, '/offers');

    const auth = new AuthMiddleware(this.users, this.config.getJwtSecret());
    const optionalAuth = new OptionalAuthMiddleware(this.users, this.config.getJwtSecret());

    this.addRoute({
      method: 'post',
      path: '/',
      middlewares: [auth, new ValidateDtoMiddleware(OfferCreateDto)],
      handlers: [asyncHandler(this.create.bind(this))]
    });

    this.addRoute({
      method: 'patch',
      path: '/:offerId',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        auth,
        new DocumentExistsMiddleware<OfferDB>('offerId', this.offers, 'Offer not found'),
        new ValidateDtoMiddleware(OfferUpdateDto)
      ],
      handlers: [asyncHandler(this.update.bind(this))]
    });

    this.addRoute({
      method: 'delete',
      path: '/:offerId',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        auth,
        new DocumentExistsMiddleware<OfferDB>('offerId', this.offers, 'Offer not found')
      ],
      handlers: [asyncHandler(this.delete.bind(this))]
    });

    this.addRoute({
      method: 'get',
      path: '/',
      middlewares: [optionalAuth],
      handlers: [asyncHandler(this.index.bind(this))]
    });

    this.addRoute({
      method: 'get',
      path: '/premium',
      middlewares: [optionalAuth],
      handlers: [asyncHandler(this.premium.bind(this))]
    });

    this.addRoute({
      method: 'get',
      path: '/:offerId',
      middlewares: [new ValidateObjectIdMiddleware('offerId'), optionalAuth],
      handlers: [asyncHandler(this.show.bind(this))]
    });
  }

  private async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const payload = req.body as OfferCreateDto;

    const { user } = req as RequestWithUser;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const created = await this.offers.create({
      title: payload.title,
      description: payload.description,
      postDate: new Date(payload.postDate),
      city: payload.city,
      previewImage: payload.previewImage,
      photos: payload.photos,
      isPremium: payload.isPremium,
      isFavorite: false,
      rating: payload.rating,
      type: payload.type,
      bedrooms: payload.bedrooms,
      maxAdults: payload.maxAdults,
      price: payload.price,
      amenities: payload.amenities,
      author: user._id,
      commentsCount: 0,
      coordinates: payload.coordinates
    });

    const favSet = await this.getFavoriteOfferIdSet(req);
    const dto = await this.toFullDto(created, favSet.has(getMongoId(created)));

    this.created(res, dto);
  }

  private async update(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;

    const { user } = req as RequestWithUser;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const offer = await this.offers.getById(offerId);
    if (!offer) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Offer not found');
    }

    if (String(offer.author) !== String(user._id)) {
      throw new HttpError(StatusCodes.FORBIDDEN, 'You can update only your offers');
    }

    const payload = req.body as OfferUpdateDto;

    const data: Partial<OfferDB> = { ...payload } as unknown as Partial<OfferDB>;

    if (payload.postDate) {
      data.postDate = new Date(payload.postDate);
    }

    delete (data as unknown as { isFavorite?: boolean }).isFavorite;

    const updated = await this.offers.update(offerId, data);
    if (!updated) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Offer not found');
    }

    const favSet = await this.getFavoriteOfferIdSet(req);
    const dto = await this.toFullDto(updated, favSet.has(getMongoId(updated)));

    this.ok(res, dto);
  }

  private async delete(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;

    const { user } = req as RequestWithUser;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const offer = await this.offers.getById(offerId);
    if (!offer) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Offer not found');
    }

    if (String(offer.author) !== String(user._id)) {
      throw new HttpError(StatusCodes.FORBIDDEN, 'You can delete only your offers');
    }

    await this.favorites.removeByOffer(offerId);
    await this.offers.remove(offerId);

    this.noContent(res);
  }

  private async index(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { limit, city } = req.query as OfferListQuery;

    const max = limit ? Number(limit) : MAX_OFFERS_DEFAULT;
    const safeLimit = Number.isFinite(max) && max > 0 ? max : MAX_OFFERS_DEFAULT;

    const offers = await this.offers.list(safeLimit, city as OfferDB['city'] | undefined);

    const favSet = await this.getFavoriteOfferIdSet(req);

    const dto = offers.map((offer) => {
      const id = getMongoId(offer);
      return this.toListItemDto(offer, favSet.has(id));
    });

    this.ok(res, dto);
  }

  private async premium(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { city } = req.query as OfferPremiumQuery;
    if (!city) {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'City query is required');
    }

    const offers = await this.offers.listPremiumByCity(city as OfferDB['city'], MAX_PREMIUM_OFFERS);

    const favSet = await this.getFavoriteOfferIdSet(req);

    const dto = offers.map((offer) => {
      const id = getMongoId(offer);
      return this.toListItemDto(offer, favSet.has(id));
    });

    this.ok(res, dto);
  }

  private async show(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;

    const offer = await this.offers.getById(offerId);
    if (!offer) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Offer not found');
    }

    const favSet = await this.getFavoriteOfferIdSet(req);

    const dto = await this.toFullDto(offer, favSet.has(getMongoId(offer)));
    this.ok(res, dto);
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

  private async toFullDto(offer: OfferDB, isFavorite: boolean): Promise<OfferFullDto> {
    const author = await this.users.findById(String(offer.author));
    if (!author) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Author not found');
    }

    return {
      ...this.toListItemDto(offer, isFavorite),
      description: offer.description,
      photos: offer.photos,
      bedrooms: offer.bedrooms,
      maxAdults: offer.maxAdults,
      amenities: offer.amenities,
      coordinates: offer.coordinates,
      author: this.toUserPublicDto(author)
    };
  }

  private toUserPublicDto(user: WithId<UserDB>) {
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
      type: user.type
    };
  }

  private async getFavoriteOfferIdSet(req: Request): Promise<Set<string>> {
    const { user } = req as RequestWithUser;
    if (!user) {
      return new Set<string>();
    }

    return this.favorites.getOfferIdSet(String(user._id));
  }
}

import type { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import { inject, injectable } from 'inversify';
import { StatusCodes } from 'http-status-codes';

import { TYPES } from '../container/types.js';
import { Controller } from './controller.js';
import { PinoLoggerService } from '../logger/logger.js';

import { OfferService } from '../services/offer.js';
import { FavoriteService } from '../services/favorite.js';

import type { OfferDB } from '../db/models/offer.js';
import type { IUserRepository, WithId } from '../db/repositories/interfaces.js';
import type { UserDB } from '../db/models/user.js';

import type { OfferListItemDto, OfferFullDto } from '../dto/offer.js';
import type { UserPublicDto } from '../dto/user.js';
import { OfferCreateDto, OfferUpdateDto } from '../dto/offer.js';

import { ValidateObjectIdMiddleware } from '../middlewares/validate-object-id.js';
import { ValidateDtoMiddleware } from '../middlewares/validate-dto.js';
import { DocumentExistsMiddleware } from '../middlewares/document-exists.js';
import { AuthMiddleware, OptionalAuthMiddleware, type RequestWithUser } from '../middlewares/auth-middleware.js';
import { ConfigService } from '../config/service.js';
import { HttpError } from '../errors/http-error.js';

const DEFAULT_AVATAR_URL = '/static/default-avatar.png';

@injectable()
export class OfferController extends Controller {
  constructor(
    @inject(TYPES.Logger) logger: PinoLoggerService,
    @inject(TYPES.OfferService) private readonly offers: OfferService,
    @inject(TYPES.UserRepository) private readonly users: IUserRepository,
    @inject(TYPES.FavoriteService) private readonly favorites: FavoriteService,
    @inject(TYPES.Config) private readonly config: ConfigService
  ) {
    super(logger, '/offers');

    const auth = new AuthMiddleware(this.users, this.config.getSalt());
    const optionalAuth = new OptionalAuthMiddleware(this.users, this.config.getSalt());

    this.addRoute({
      method: 'get',
      path: '/',
      middlewares: [optionalAuth],
      handlers: [asyncHandler(this.index.bind(this))]
    });

    this.addRoute({
      method: 'post',
      path: '/',
      middlewares: [new ValidateDtoMiddleware(OfferCreateDto), auth],
      handlers: [asyncHandler(this.create.bind(this))]
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
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        optionalAuth,
        new DocumentExistsMiddleware<OfferDB>('offerId', this.offers, 'Offer not found', 'offer')
      ],
      handlers: [asyncHandler(this.show.bind(this))]
    });

    this.addRoute({
      method: 'patch',
      path: '/:offerId',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        new ValidateDtoMiddleware(OfferUpdateDto),
        auth,
        new DocumentExistsMiddleware<OfferDB>('offerId', this.offers, 'Offer not found', 'offer')
      ],
      handlers: [asyncHandler(this.update.bind(this))]
    });

    this.addRoute({
      method: 'delete',
      path: '/:offerId',
      middlewares: [
        new ValidateObjectIdMiddleware('offerId'),
        auth,
        new DocumentExistsMiddleware<OfferDB>('offerId', this.offers, 'Offer not found', 'offer')
      ],
      handlers: [asyncHandler(this.remove.bind(this))]
    });
  }

  private async index(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 60;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 60;

    const city = typeof req.query.city === 'string' ? req.query.city : undefined;

    const items = await this.offers.list(limit, city as OfferDB['city'] | undefined);

    const favoriteIds = await this.getFavoriteOfferIdSet(req);
    const dtos = items.map((offer) => {
      const id = this.getOfferId(offer);
      return this.toListItemDto(offer, favoriteIds.has(id));
    });

    this.ok(res, dtos);
  }

  private async premium(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const city = typeof req.query.city === 'string' ? req.query.city : '';
    if (!city) {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'city query param is required');
    }

    const items = await this.offers.listPremiumByCity(city as OfferDB['city'], 3);

    const favoriteIds = await this.getFavoriteOfferIdSet(req);
    const dtos = items.map((offer) => {
      const id = this.getOfferId(offer);
      return this.toListItemDto(offer, favoriteIds.has(id));
    });

    this.ok(res, dtos);
  }

  private async show(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { offerId } = req.params;
    const offer = res.locals.offer as OfferDB;

    const favoriteIds = await this.getFavoriteOfferIdSet(req);
    const dto = await this.toFullDto(offer, favoriteIds.has(offerId));

    this.ok(res, dto);
  }

  private async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { user } = req as RequestWithUser;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const payload = req.body as OfferCreateDto;

    const created = await this.offers.create({
      title: payload.title,
      description: payload.description,
      postDate: new Date(payload.postDate),
      city: payload.city as OfferDB['city'],
      previewImage: payload.previewImage,
      photos: payload.photos,
      isPremium: payload.isPremium,
      isFavorite: false,
      rating: payload.rating,
      type: payload.type as OfferDB['type'],
      bedrooms: payload.bedrooms,
      maxAdults: payload.maxAdults,
      price: payload.price,
      amenities: payload.amenities as OfferDB['amenities'],
      author: user._id,
      commentsCount: 0,
      coordinates: payload.coordinates
    });

    const dto = await this.toFullDto(created, false);
    this.created(res, dto);
  }

  private async update(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { user } = req as RequestWithUser;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const { offerId } = req.params;
    const current = res.locals.offer as OfferDB;

    if (String(current.author) !== String(user._id)) {
      throw new HttpError(StatusCodes.FORBIDDEN, 'You can edit only your offers');
    }

    const payload = req.body as OfferUpdateDto;
    const data: Partial<OfferDB> = {};

    if (typeof payload.title === 'string') {
      data.title = payload.title;
    }
    if (typeof payload.description === 'string') {
      data.description = payload.description;
    }
    if (typeof payload.postDate === 'string') {
      data.postDate = new Date(payload.postDate);
    }
    if (typeof payload.city === 'string') {
      data.city = payload.city as OfferDB['city'];
    }
    if (typeof payload.previewImage === 'string') {
      data.previewImage = payload.previewImage;
    }
    if (Array.isArray(payload.photos)) {
      data.photos = payload.photos;
    }
    if (typeof payload.isPremium === 'boolean') {
      data.isPremium = payload.isPremium;
    }
    if (typeof payload.rating === 'number') {
      data.rating = payload.rating;
    }
    if (typeof payload.type === 'string') {
      data.type = payload.type as OfferDB['type'];
    }
    if (typeof payload.bedrooms === 'number') {
      data.bedrooms = payload.bedrooms;
    }
    if (typeof payload.maxAdults === 'number') {
      data.maxAdults = payload.maxAdults;
    }
    if (typeof payload.price === 'number') {
      data.price = payload.price;
    }
    if (Array.isArray(payload.amenities)) {
      data.amenities = payload.amenities as OfferDB['amenities'];
    }
    if (payload.coordinates) {
      data.coordinates = payload.coordinates;
    }

    const updated = await this.offers.update(offerId, data);
    if (!updated) {
      throw new HttpError(StatusCodes.INTERNAL_SERVER_ERROR, 'Offer update failed');
    }

    const favoriteIds = await this.getFavoriteOfferIdSet(req);
    const dto = await this.toFullDto(updated, favoriteIds.has(offerId));

    this.ok(res, dto);
  }

  private async remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { user } = req as RequestWithUser;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const { offerId } = req.params;
    const current = res.locals.offer as OfferDB;

    if (String(current.author) !== String(user._id)) {
      throw new HttpError(StatusCodes.FORBIDDEN, 'You can delete only your offers');
    }

    await this.offers.remove(offerId);
    await this.favorites.removeByOffer(offerId);

    this.noContent(res);
  }

  private getOfferId(offer: OfferDB): string {
    const withId = offer as Partial<WithId<OfferDB>>;
    return withId._id ? String(withId._id) : '';
  }

  private async getFavoriteOfferIdSet(req: Request): Promise<Set<string>> {
    const { user } = req as RequestWithUser;
    if (!user) {
      return new Set<string>();
    }

    const ids = await this.favorites.getOfferIds(String(user._id));
    return new Set(ids.map((id) => String(id)));
  }

  private async toFullDto(offer: OfferDB, isFavorite: boolean): Promise<OfferFullDto> {
    const id = this.getOfferId(offer);

    const author = await this.users.findById(String(offer.author));
    if (!author) {
      throw new HttpError(StatusCodes.INTERNAL_SERVER_ERROR, 'Offer author not found');
    }

    const authorDto = this.toUserPublic(author);

    return {
      id,
      price: offer.price,
      title: offer.title,
      type: offer.type as OfferFullDto['type'],
      isFavorite,
      postDate: offer.postDate instanceof Date ? offer.postDate.toISOString() : String(offer.postDate),
      city: offer.city as OfferFullDto['city'],
      previewImage: offer.previewImage,
      isPremium: offer.isPremium,
      rating: offer.rating,
      commentsCount: offer.commentsCount,
      description: offer.description,
      photos: offer.photos,
      bedrooms: offer.bedrooms,
      maxAdults: offer.maxAdults,
      amenities: offer.amenities as OfferFullDto['amenities'],
      author: authorDto,
      coordinates: offer.coordinates
    };
  }

  private toListItemDto(offer: OfferDB, isFavorite: boolean): OfferListItemDto {
    const id = this.getOfferId(offer);

    return {
      id,
      price: offer.price,
      title: offer.title,
      type: offer.type as OfferListItemDto['type'],
      isFavorite,
      postDate: offer.postDate instanceof Date ? offer.postDate.toISOString() : String(offer.postDate),
      city: offer.city as OfferListItemDto['city'],
      previewImage: offer.previewImage,
      isPremium: offer.isPremium,
      rating: offer.rating,
      commentsCount: offer.commentsCount
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

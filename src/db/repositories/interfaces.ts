import type { Types } from 'mongoose';
import type { OfferDB } from '../models/offer.js';
import type { UserDB } from '../models/user.js';
import type { CommentDB } from '../models/comment.js';

export type WithId<T> = T & { _id: Types.ObjectId };

export interface IOfferRepository {
  create(data: Partial<OfferDB>): Promise<OfferDB>;
  updateById(id: string, data: Partial<OfferDB>): Promise<OfferDB | null>;
  removeById(id: string): Promise<void>;
  findById(id: string): Promise<OfferDB | null>;
  list(limit: number, city?: OfferDB['city']): Promise<OfferDB[]>;
  listByIds(ids: string[]): Promise<OfferDB[]>;
  listPremiumByCity(city: OfferDB['city'], limit: number): Promise<OfferDB[]>;
  updateStats(id: string, rating: number, commentsCount: number): Promise<void>;
}

export interface IUserRepository {
  create(data: Partial<UserDB>): Promise<WithId<UserDB>>;
  findByEmail(email: string): Promise<WithId<UserDB> | null>;
  findById(id: string): Promise<WithId<UserDB> | null>;
  updateAvatar(id: string, avatarUrl: string): Promise<WithId<UserDB> | null>;
}

export interface IFavoriteRepository {
  add(userId: string, offerId: string): Promise<void>;
  remove(userId: string, offerId: string): Promise<void>;
  removeByOffer(offerId: string): Promise<void>;
  findOfferIdsByUser(userId: string): Promise<string[]>;
}

export interface ICommentRepository {
  create(data: Partial<CommentDB>): Promise<CommentDB>;
  findLastByOffer(offerId: string, limit: number): Promise<CommentDB[]>;
  calcAvgAndCount(offerId: string): Promise<{ avg: number; count: number }>;
  deleteByOffer(offerId: string): Promise<void>;
}

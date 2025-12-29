import { inject, injectable } from 'inversify';
import { TYPES } from '../container/types.js';
import { IFavoriteRepository, IOfferRepository } from '../db/repositories/interfaces.js';
import { OfferDB } from '../db/models/offer.js';

@injectable()
export class FavoriteService {
  constructor(
    @inject(TYPES.FavoriteRepository) private readonly favs: IFavoriteRepository,
    @inject(TYPES.OfferRepository) private readonly offers: IOfferRepository
  ) {}

  async add(userId: string, offerId: string) {
    await this.favs.add(userId, offerId);
  }

  async remove(userId: string, offerId: string) {
    await this.favs.remove(userId, offerId);
  }

  async removeByOffer(offerId: string) {
    await this.favs.removeByOffer(offerId);
  }

  async getOfferIds(userId: string) {
    return this.favs.findOfferIdsByUser(userId);
  }

  async getOfferIdSet(userId: string): Promise<Set<string>> {
    const ids = await this.getOfferIds(userId);
    return new Set(ids);
  }

  async list(userId: string): Promise<OfferDB[]> {
    const ids = await this.getOfferIds(userId);
    if (!ids.length) {
      return [];
    }
    return this.offers.listByIds(ids);
  }
}

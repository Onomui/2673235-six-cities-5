import { inject, injectable } from 'inversify';
import { TYPES } from '../container/types.js';
import { IOfferRepository, ICommentRepository } from '../db/repositories/interfaces.js';
import { OfferDB } from '../db/models/offer.js';

@injectable()
export class OfferService {
  constructor(
    @inject(TYPES.OfferRepository) private readonly offers: IOfferRepository,
    @inject(TYPES.CommentRepository) private readonly comments: ICommentRepository
  ) {}

  create(data: Partial<OfferDB>) {
    return this.offers.create(data);
  }

  update(id: string, data: Partial<OfferDB>) {
    return this.offers.updateById(id, data);
  }

  async remove(id: string) {
    await this.comments.deleteByOffer(id);
    await this.offers.removeById(id);
  }

  getById(id: string) {
    return this.offers.findById(id);
  }

  list(limit: number, city?: OfferDB['city']) {
    return this.offers.list(limit, city);
  }

  listPremiumByCity(city: OfferDB['city'], limit = 3) {
    const lim = Math.min(limit, 3);
    return this.offers.listPremiumByCity(city, lim);
  }

  async recalcStats(offerId: string) {
    const agg = await this.comments.calcAvgAndCount(offerId);
    let rating = Number(agg.avg || 0);

    if (!agg.count) {
      const offer = await this.offers.findById(offerId);
      if (offer) {
        rating = offer.rating;
      }
    }

    await this.offers.updateStats(offerId, rating, agg.count || 0);
  }
}

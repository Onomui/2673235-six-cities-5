import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { FavoriteDB } from '../models/favorite.js';
import type { IFavoriteRepository } from './interfaces.js';

export class FavoriteRepository implements IFavoriteRepository {
  constructor(private readonly model: Model<FavoriteDB>) {}

  async add(userId: string, offerId: string): Promise<void> {
    await this.model.create({
      user: new Types.ObjectId(userId),
      offer: new Types.ObjectId(offerId)
    });
  }

  async remove(userId: string, offerId: string): Promise<void> {
    await this.model.deleteOne({
      user: new Types.ObjectId(userId),
      offer: new Types.ObjectId(offerId)
    });
  }

  async removeByOffer(offerId: string): Promise<void> {
    await this.model.deleteMany({
      offer: new Types.ObjectId(offerId)
    });
  }

  async findOfferIdsByUser(userId: string): Promise<string[]> {
    const rows = await this.model
      .find({ user: new Types.ObjectId(userId) })
      .select('offer')
      .lean<{ offer: Types.ObjectId }[]>();

    return rows.map((r) => String(r.offer));
  }
}

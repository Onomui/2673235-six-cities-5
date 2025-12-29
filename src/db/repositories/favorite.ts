import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { FavoriteDB } from '../models/favorite.js';
import type { IFavoriteRepository } from './interfaces.js';

function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const code = (err as { code?: unknown }).code;
  return code === 11000;
}

export class FavoriteRepository implements IFavoriteRepository {
  constructor(private readonly model: Model<FavoriteDB>) {}

  async add(userId: string, offerId: string): Promise<void> {
    try {
      await this.model.create({
        user: new Types.ObjectId(userId),
        offer: new Types.ObjectId(offerId)
      });
    } catch (e) {
      if (isDuplicateKeyError(e)) {
        return;
      }
      throw e;
    }
  }

  async remove(userId: string, offerId: string): Promise<void> {
    await this.model.deleteOne({
      user: new Types.ObjectId(userId),
      offer: new Types.ObjectId(offerId)
    });
  }

  async removeByOffer(offerId: string): Promise<void> {
    await this.model.deleteMany({ offer: new Types.ObjectId(offerId) });
  }

  async findOfferIdsByUser(userId: string): Promise<string[]> {
    const ids = await this.model.distinct('offer', {
      user: new Types.ObjectId(userId)
    });

    return ids.map((id) => String(id));
  }
}

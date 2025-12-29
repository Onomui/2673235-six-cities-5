import { Model, Types } from 'mongoose';
import { OfferDB } from '../models/offer.js';
import { IOfferRepository } from './interfaces.js';

export class OfferRepository implements IOfferRepository {
  constructor(private readonly model: Model<OfferDB>) {}

  async create(data: Partial<OfferDB>): Promise<OfferDB> {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async updateById(id: string | Types.ObjectId, data: Partial<OfferDB>): Promise<OfferDB | null> {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true });
    return doc ? doc.toObject() : null;
  }

  async removeById(id: string | Types.ObjectId): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }

  async findById(id: string | Types.ObjectId): Promise<OfferDB | null> {
    const doc = await this.model.findById(id).lean();
    return (doc as unknown as OfferDB) || null;
  }

  async list(limit: number, city?: OfferDB['city']): Promise<OfferDB[]> {
    const q = city ? this.model.find({ city }) : this.model.find();
    const docs = await q.sort({ postDate: -1 }).limit(limit).lean();
    return docs as unknown as OfferDB[];
  }

  async listByIds(ids: (string | Types.ObjectId)[]): Promise<OfferDB[]> {
    if (!ids.length) {
      return [];
    }

    const docs = await this.model
      .find({ _id: { $in: ids } })
      .sort({ postDate: -1 })
      .lean();

    return docs as unknown as OfferDB[];
  }

  async listPremiumByCity(city: OfferDB['city'], limit: number): Promise<OfferDB[]> {
    const docs = await this.model
      .find({ city, isPremium: true })
      .sort({ postDate: -1 })
      .limit(limit)
      .lean();
    return docs as unknown as OfferDB[];
  }

  async updateStats(id: string | Types.ObjectId, rating: number, commentsCount: number): Promise<void> {
    await this.model.updateOne({ _id: id }, { rating, commentsCount });
  }
}

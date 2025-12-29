import { Schema, model, Types, type Model, type SchemaDefinition } from 'mongoose';

export type CityDB = 'Paris' | 'Cologne' | 'Brussels' | 'Amsterdam' | 'Hamburg' | 'Dusseldorf';
export type HousingTypeDB = 'apartment' | 'house' | 'room' | 'hotel';

export type AmenityDB =
  | 'Breakfast'
  | 'Air conditioning'
  | 'Laptop friendly workspace'
  | 'Baby seat'
  | 'Washer'
  | 'Towels'
  | 'Fridge';

export interface CoordinatesDB {
  latitude: number;
  longitude: number;
}

const coordinatesSchema = new Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  { _id: false }
);

export interface OfferDB {
  title: string;
  description: string;
  postDate: Date;
  city: CityDB;
  previewImage: string;
  photos: string[];
  isPremium: boolean;
  isFavorite: boolean;
  rating: number;
  type: HousingTypeDB;
  bedrooms: number;
  maxAdults: number;
  price: number;
  amenities: AmenityDB[];
  author: Types.ObjectId;
  commentsCount: number;
  coordinates: CoordinatesDB;
}

const offerDefinition: SchemaDefinition = {
  title: { type: String, required: true },
  description: { type: String, required: true },
  postDate: { type: Date, required: true },
  city: { type: String, required: true },
  previewImage: { type: String, required: true },
  photos: { type: [String], required: true },
  isPremium: { type: Boolean, required: true },
  isFavorite: { type: Boolean, required: true, default: false },
  rating: { type: Number, required: true },
  type: { type: String, required: true },
  bedrooms: { type: Number, required: true },
  maxAdults: { type: Number, required: true },
  price: { type: Number, required: true },
  amenities: { type: [String], required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  commentsCount: { type: Number, required: true, default: 0 },
  coordinates: { type: coordinatesSchema, required: true }
};

const OfferSchema = new Schema(offerDefinition, { timestamps: true });

export const OfferModel = model('Offer', OfferSchema) as unknown as Model<OfferDB>;

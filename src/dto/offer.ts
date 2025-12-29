import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import type { UserPublicDto } from './user.js';

const CITIES = [
  'Paris',
  'Cologne',
  'Brussels',
  'Amsterdam',
  'Hamburg',
  'Dusseldorf'
] as const;

const HOUSING_TYPES = ['apartment', 'house', 'room', 'hotel'] as const;

const AMENITIES = [
  'Breakfast',
  'Air conditioning',
  'Laptop friendly workspace',
  'Baby seat',
  'Washer',
  'Towels',
  'Fridge'
] as const;

type City = typeof CITIES[number];
type HousingType = typeof HOUSING_TYPES[number];
type Amenity = typeof AMENITIES[number];

export class CoordinatesDto {
  @IsNumber()
    latitude!: number;

  @IsNumber()
    longitude!: number;
}

export class OfferCreateDto {
  @Length(10, 100)
    title!: string;

  @Length(20, 1024)
    description!: string;

  @IsISO8601()
    postDate!: string;

  @IsIn(CITIES as unknown as string[])
    city!: City;

  @IsUrl()
    previewImage!: string;

  @IsArray()
  @ArrayMinSize(6)
  @ArrayMaxSize(6)
  @IsUrl({}, { each: true })
    photos!: string[];

  @IsBoolean()
    isPremium!: boolean;

  @IsBoolean()
    isFavorite!: boolean;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
    rating!: number;

  @IsIn(HOUSING_TYPES as unknown as string[])
    type!: HousingType;

  @IsInt()
  @Min(1)
  @Max(8)
    bedrooms!: number;

  @IsInt()
  @Min(1)
  @Max(10)
    maxAdults!: number;

  @IsInt()
  @Min(100)
  @Max(100000)
    price!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(AMENITIES as unknown as string[], { each: true })
    amenities!: Amenity[];

  @ValidateNested()
  @Type(() => CoordinatesDto)
    coordinates!: CoordinatesDto;
}

export class OfferUpdateDto {
  @IsOptional()
  @Length(10, 100)
    title?: string;

  @IsOptional()
  @Length(20, 1024)
    description?: string;

  @IsOptional()
  @IsISO8601()
    postDate?: string;

  @IsOptional()
  @IsIn(CITIES as unknown as string[])
    city?: City;

  @IsOptional()
  @IsUrl()
    previewImage?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(6)
  @ArrayMaxSize(6)
  @IsUrl({}, { each: true })
    photos?: string[];

  @IsOptional()
  @IsBoolean()
    isPremium?: boolean;

  @IsOptional()
  @IsBoolean()
    isFavorite?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(5)
    rating?: number;

  @IsOptional()
  @IsIn(HOUSING_TYPES as unknown as string[])
    type?: HousingType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
    bedrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
    maxAdults?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(100000)
    price?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(AMENITIES as unknown as string[], { each: true })
    amenities?: Amenity[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
    coordinates?: CoordinatesDto;
}

export interface OfferListItemDto {
  id: string;
  price: number;
  title: string;
  type: HousingType;
  isFavorite: boolean;
  postDate: string;
  city: City;
  previewImage: string;
  isPremium: boolean;
  rating: number;
  commentsCount: number;
}

export interface OfferFullDto extends OfferListItemDto {
  description: string;
  photos: string[];
  bedrooms: number;
  maxAdults: number;
  amenities: Amenity[];
  author: UserPublicDto;
  coordinates: { latitude: number; longitude: number };
}

import 'dotenv/config.js';
import chalk from 'chalk';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import { parseTsvLine } from '../utils/tsv.js';
import { container } from '../container/container.js';
import { TYPES } from '../container/types.js';
import { DatabaseService } from '../db/database.js';
import { IUserRepository, IOfferRepository, WithId } from '../db/repositories/interfaces.js';
import { UserDB } from '../db/models/user.js';
import { OfferDB } from '../db/models/offer.js';

type ParsedAuthor = {
  name?: unknown;
  email?: unknown;
  avatarUrl?: unknown;
  type?: unknown;
};

type ParsedCoords = {
  latitude?: unknown;
  longitude?: unknown;
};

type ParsedOffer = {
  title?: unknown;
  description?: unknown;
  postDate?: unknown;
  city?: unknown;
  previewImage?: unknown;
  photos?: unknown;
  isPremium?: unknown;
  isFavorite?: unknown;
  rating?: unknown;
  type?: unknown;
  bedrooms?: unknown;
  maxAdults?: unknown;
  price?: unknown;
  amenities?: unknown;
  commentsCount?: unknown;
  coordinates?: ParsedCoords;
  author?: ParsedAuthor;
};

const CITIES: OfferDB['city'][] = ['Paris', 'Cologne', 'Brussels', 'Amsterdam', 'Hamburg', 'Dusseldorf'];
const HOUSING_TYPES: OfferDB['type'][] = ['apartment', 'house', 'room', 'hotel'];
const AMENITIES: OfferDB['amenities'][number][] = [
  'Breakfast',
  'Air conditioning',
  'Laptop friendly workspace',
  'Baby seat',
  'Washer',
  'Towels',
  'Fridge'
];

const CITY_COORDS: Record<OfferDB['city'], { latitude: number; longitude: number }> = {
  Paris: { latitude: 48.85661, longitude: 2.351499 },
  Cologne: { latitude: 50.938361, longitude: 6.959974 },
  Brussels: { latitude: 50.846557, longitude: 4.351697 },
  Amsterdam: { latitude: 52.370216, longitude: 4.895168 },
  Hamburg: { latitude: 53.550341, longitude: 10.000654 },
  Dusseldorf: { latitude: 51.225402, longitude: 6.776314 }
};

function isHeader(line: string): boolean {
  const lower = line.trim().toLowerCase();
  return lower.startsWith('title\t') || lower.includes('\ttitle\t') || lower.endsWith('\ttitle');
}

function clampNumber(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function toNumberSafe(v: unknown, def = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  const n = Number(String(v ?? '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : def;
}

function toDateSafe(v: unknown, def = new Date()): Date {
  if (v instanceof Date && !isNaN(v.valueOf())) {
    return v;
  }
  const d = new Date(String(v ?? ''));
  return isNaN(d.valueOf()) ? def : d;
}

function toBoolSafe(v: unknown, def = false): boolean {
  if (typeof v === 'boolean') {
    return v;
  }
  const s = String(v ?? '').toLowerCase().trim();
  if (s === 'true' || s === '1' || s === 'yes') {
    return true;
  }
  if (s === 'false' || s === '0' || s === 'no') {
    return false;
  }
  return def;
}

function toStringSafe(v: unknown, def = ''): string {
  const s = String(v ?? '').trim();
  return s.length ? s : def;
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  const s = String(v ?? '');
  if (!s) {
    return [];
  }
  let sep = ' ';
  if (s.includes(';')) {
    sep = ';';
  } else if (s.includes(',')) {
    sep = ',';
  }
  return s.split(sep).map((x) => x.trim()).filter(Boolean);
}

function normalizeCity(v: string): OfferDB['city'] {
  const city = v.trim();
  if (CITIES.includes(city as OfferDB['city'])) {
    return city as OfferDB['city'];
  }
  return 'Paris';
}

function normalizeType(v: string): OfferDB['type'] {
  const t = v.trim();
  if (HOUSING_TYPES.includes(t as OfferDB['type'])) {
    return t as OfferDB['type'];
  }
  return 'apartment';
}

function normalizeUserType(v: string): UserDB['type'] {
  const t = v.trim();
  if (t === 'pro' || t === 'regular') {
    return t;
  }
  return 'regular';
}

function normalizeTitle(v: string): string {
  let s = v.trim();
  if (s.length < 10) {
    s = `${s} offer`.trim();
  }
  if (s.length < 10) {
    s = 'Untitled offer';
  }
  if (s.length > 100) {
    s = s.slice(0, 100);
  }
  return s;
}

function normalizeDescription(v: string): string {
  let s = v.trim();
  if (s.length < 20) {
    s = `${s} More details will be added soon.`.trim();
  }
  if (s.length < 20) {
    s = 'No description available yet.';
  }
  if (s.length > 1024) {
    s = s.slice(0, 1024);
  }
  return s;
}

function normalizePhotos(list: string[], previewImage: string): string[] {
  const photos = list.filter(Boolean);
  if (!photos.length) {
    photos.push(previewImage);
  }
  while (photos.length < 6) {
    photos.push(photos[photos.length - 1]);
  }
  return photos.slice(0, 6);
}

function normalizeAmenities(list: string[]): OfferDB['amenities'] {
  const set = new Set(AMENITIES);
  const filtered = list.filter((x) => set.has(x as OfferDB['amenities'][number])) as OfferDB['amenities'];
  if (filtered.length) {
    return filtered;
  }
  return ['Breakfast'];
}

function getMongoUri(): string | null {
  const uri = String(process.env.MONGO_URI ?? '').trim();
  if (uri) {
    return uri;
  }
  const host = String(process.env.DB_HOST ?? '').trim();
  if (host) {
    return `mongodb://${host}:27017/six-cities`;
  }
  return null;
}

export async function importTsv(filePath: string): Promise<void> {
  const exists = await fs.access(filePath).then(() => true).catch(() => false);
  if (!exists) {
    console.error(chalk.red(`Файл не найден: ${filePath}`));
    process.exitCode = 1;
    return;
  }

  const mongoUri = getMongoUri();
  if (!mongoUri) {
    console.error(chalk.red('Не задан DB_HOST (или MONGO_URI). Создай .env и укажи DB_HOST=localhost'));
    process.exitCode = 1;
    return;
  }

  const db = container.get<DatabaseService>(TYPES.Database);
  const userRepo = container.get<IUserRepository>(TYPES.UserRepository);
  const offerRepo = container.get<IOfferRepository>(TYPES.OfferRepository);

  console.log(chalk.blueBright(`Подключение к БД: ${mongoUri}`));
  await db.connect(mongoUri);
  console.log(chalk.green('Подключено к MongoDB'));

  const rl = readline.createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  });

  let imported = 0;

  console.log(chalk.blueBright(`Импорт из: ${filePath}\n`));

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('#')) {
      continue;
    }
    if (isHeader(trimmed)) {
      continue;
    }

    const raw = parseTsvLine(trimmed) as ParsedOffer;

    const userEmail = toStringSafe(raw.author?.email);
    if (!userEmail) {
      console.error(chalk.red('Пропущено: пустой email автора'));
      continue;
    }

    const userName = toStringSafe(raw.author?.name, 'Anonymous');
    const userAvatar = toStringSafe(raw.author?.avatarUrl);
    const userType = normalizeUserType(toStringSafe(raw.author?.type, 'regular'));

    const existing = await userRepo.findByEmail(userEmail);
    const ensuredUser: WithId<UserDB> =
      existing ??
      (await userRepo.create({
        name: userName,
        email: userEmail,
        avatarUrl: userAvatar || undefined,
        type: userType
      }));

    const city = normalizeCity(toStringSafe(raw.city, 'Paris'));
    const title = normalizeTitle(toStringSafe(raw.title, 'Untitled offer'));
    const description = normalizeDescription(toStringSafe(raw.description, 'No description'));
    const postDate = toDateSafe(raw.postDate);
    const previewImage = toStringSafe(raw.previewImage, 'http://example.com/preview.jpg');

    const photos = normalizePhotos(toStringArray(raw.photos), previewImage);
    const isPremium = toBoolSafe(raw.isPremium, false);
    const isFavorite = toBoolSafe(raw.isFavorite, false);

    const ratingRaw = toNumberSafe(raw.rating, 1);
    const rating = Math.round(clampNumber(ratingRaw, 1, 5) * 10) / 10;

    const type = normalizeType(toStringSafe(raw.type, 'apartment'));

    const bedrooms = Math.trunc(clampNumber(toNumberSafe(raw.bedrooms, 1), 1, 8));
    const maxAdults = Math.trunc(clampNumber(toNumberSafe(raw.maxAdults, 1), 1, 10));
    const price = Math.trunc(clampNumber(toNumberSafe(raw.price, 100), 100, 100000));

    const amenities = normalizeAmenities(toStringArray(raw.amenities));

    const latRaw = toNumberSafe(raw.coordinates?.latitude, CITY_COORDS[city].latitude);
    const lngRaw = toNumberSafe(raw.coordinates?.longitude, CITY_COORDS[city].longitude);

    const latitude = Number.isFinite(latRaw) ? latRaw : CITY_COORDS[city].latitude;
    const longitude = Number.isFinite(lngRaw) ? lngRaw : CITY_COORDS[city].longitude;

    const commentsCount = Math.max(0, Math.trunc(toNumberSafe(raw.commentsCount, 0)));

    try {
      await offerRepo.create({
        title,
        description,
        postDate,
        city,
        previewImage,
        photos,
        isPremium,
        isFavorite,
        rating,
        type,
        bedrooms,
        maxAdults,
        price,
        amenities,
        author: ensuredUser._id,
        commentsCount,
        coordinates: { latitude, longitude }
      } as Partial<OfferDB>);
      imported += 1;
      console.log(`${chalk.bold(title)} ${chalk.gray(`[${city}]`)} ${chalk.yellow(`€${price}`)} ${chalk.gray(`(${type}, rating ${rating})`)}`);
    } catch (e) {
      console.error(chalk.red((e as Error).message));
    }
  }

  console.log(`\n${chalk.cyan.bold(`Импортировано: ${imported}`)}`);
  await db.disconnect();
  console.log(chalk.gray('Соединение с MongoDB закрыто'));
}

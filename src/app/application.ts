import { inject, injectable } from 'inversify';
import express, { type Express } from 'express';
import cors from 'cors';
import { mkdir } from 'node:fs/promises';
import { StatusCodes } from 'http-status-codes';
import { TYPES } from '../container/types.js';
import { PinoLoggerService } from '../logger/logger.js';
import { ConfigService } from '../config/service.js';
import { DatabaseService } from '../db/database.js';
import { AuthController } from '../controllers/auth.js';
import { OfferController } from '../controllers/offer.js';
import { FavoriteController } from '../controllers/favorite.js';
import { CommentController } from '../controllers/comment.js';
import { ExceptionFilter } from '../errors/exception-filter.js';
import { HttpError } from '../errors/http-error.js';

@injectable()
export class Application {
  private readonly app: Express;

  constructor(
    @inject(TYPES.Logger) private readonly logger: PinoLoggerService,
    @inject(TYPES.Config) private readonly config: ConfigService,
    @inject(TYPES.Database) private readonly database: DatabaseService,
    @inject(TYPES.AuthController) private readonly authController: AuthController,
    @inject(TYPES.OfferController) private readonly offerController: OfferController,
    @inject(TYPES.FavoriteController) private readonly favoriteController: FavoriteController,
    @inject(TYPES.CommentController) private readonly commentController: CommentController,
    @inject(TYPES.ExceptionFilter) private readonly exceptionFilter: ExceptionFilter
  ) {
    this.app = express();
  }

  private registerMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json());

    const uploadDir = this.config.getUploadDir();
    this.app.use('/static', express.static(uploadDir));
  }

  private registerRoutes(): void {
    const apiPrefix = '/api/v1';

    this.app.use(`${apiPrefix}${this.authController.basePath}`, this.authController.router);
    this.app.use(`${apiPrefix}${this.offerController.basePath}`, this.offerController.router);
    this.app.use(`${apiPrefix}${this.favoriteController.basePath}`, this.favoriteController.router);
    this.app.use(`${apiPrefix}${this.commentController.basePath}`, this.commentController.router);

    this.app.use((_req, _res, next) => {
      next(new HttpError(StatusCodes.NOT_FOUND, 'Not found'));
    });
  }

  private registerExceptionFilters(): void {
    this.app.use(this.exceptionFilter.catch.bind(this.exceptionFilter));
  }

  private async initDb(): Promise<void> {
    const host = this.config.getDbHost();
    const uri = `mongodb://${host}:27017/six-cities`;
    await this.database.connect(uri);
  }

  private async ensureUploadDir(): Promise<void> {
    const uploadDir = this.config.getUploadDir();
    await mkdir(uploadDir, { recursive: true });
  }

  async init(): Promise<void> {
    await this.ensureUploadDir();
    await this.initDb();
    this.registerMiddlewares();
    this.registerRoutes();
    this.registerExceptionFilters();

    const port = this.config.getPort();
    this.app.listen(port, () => {
      this.logger.info(`HTTP server listening on port ${port}`);
    });
  }
}

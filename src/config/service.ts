import { injectable } from 'inversify';
import 'dotenv/config.js';
import convict from 'convict';
import { url } from 'convict-format-with-validator';

convict.addFormat(url);

type RawConfig = {
  app: {
    port: number;
    salt: string;
    jwtSecret: string;
  };
  db: {
    host: string;
  };
  upload: {
    dir: string;
  };
};

type ConfigKey = 'app.port' | 'app.salt' | 'app.jwtSecret' | 'db.host' | 'upload.dir';

const REQUIRED_ENVS = ['PORT', 'SALT', 'JWT_SECRET', 'DB_HOST', 'UPLOAD_DIR'] as const;

@injectable()
export class ConfigService {
  private readonly conf = convict<RawConfig>({
    app: {
      port: {
        doc: 'App port',
        format: 'port',
        default: 3000,
        env: 'PORT'
      },
      salt: {
        doc: 'Salt for hashing passwords',
        format: String,
        default: '',
        env: 'SALT'
      },
      jwtSecret: {
        doc: 'Secret for signing JWT',
        format: String,
        default: '',
        env: 'JWT_SECRET'
      }
    },
    db: {
      host: {
        doc: 'DB host',
        format: String,
        default: '',
        env: 'DB_HOST'
      }
    },
    upload: {
      dir: {
        doc: 'Directory for user-uploaded files',
        format: String,
        default: 'upload',
        env: 'UPLOAD_DIR'
      }
    }
  });

  constructor() {
    const missing = REQUIRED_ENVS.filter((key) => {
      const value = process.env[key];
      return !value || !value.trim();
    });

    if (missing.length) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    this.conf.validate({ allowed: 'strict' });
  }

  get<T = unknown>(key: ConfigKey): T {
    return this.conf.get(key) as T;
  }

  getPort(): number {
    return this.conf.get('app.port');
  }

  getDbHost(): string {
    return this.conf.get('db.host');
  }

  getSalt(): string {
    return this.conf.get('app.salt');
  }

  getJwtSecret(): string {
    return this.conf.get('app.jwtSecret');
  }

  getUploadDir(): string {
    return this.conf.get('upload.dir');
  }
}

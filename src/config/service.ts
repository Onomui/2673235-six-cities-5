import { injectable } from 'inversify';
import 'dotenv/config.js';
import convict from 'convict';
import { url } from 'convict-format-with-validator';

convict.addFormat(url);

type RawConfig = {
  app: {
    port: number;
    salt: string;
  };
  db: {
    host: string;
  };
  upload: {
    dir: string;
  };
};

type ConfigKey = 'app.port' | 'app.salt' | 'db.host' | 'upload.dir';

const REQUIRED_ENVS = ['PORT', 'SALT', 'DB_HOST', 'UPLOAD_DIR'] as const;

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
        doc: 'Salt/secret for hashing and tokens',
        format: String,
        default: '',
        env: 'SALT'
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

  getUploadDir(): string {
    return this.conf.get('upload.dir');
  }
}

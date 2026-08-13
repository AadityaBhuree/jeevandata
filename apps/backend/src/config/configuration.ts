export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface AppConfiguration {
  app: {
    name: string;
    port: number;
    nodeEnv: string;
    frontendUrl: string;
    backendUrl: string;
  };
  opentelemetry: {
    enabled: boolean;
    serviceName: string;
    exporterType: string;
    endpoint: string;
    otlpEndpoint: string;
    sampleRate: number;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  qdrant: {
    url: string;
    apiKey: string;
  };
  storage: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBucket: string;
    audioPrefix: string;
    facePrefix: string;
  };
  anthropic: {
    apiKey: string;
    model: string;
  };
  google: {
    apiKey: string;
    model: string;
  };
  openai: {
    apiKey: string;
    whisperApiUrl: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
    expiration: string;
  };
  session: {
    inactivityTimeoutMs: number;
    autoCloseMs: number;
  };
  face: {
    matchThreshold: number;
    embeddingDim: number;
    livenessThreshold: number;
  };
  audio: {
    autoDeleteDays: number;
    format: string;
    sampleRate: number;
  };
  archival: {
    coldAfterDays: number;
  };
  audit: {
    retentionDays: number;
  };
  pms: {
    fhirEndpoint: string;
    customEndpoint: string;
    apiKey: string;
    cacheTtlMs: number;
  };
  rateLimit: RateLimitConfig;
  cors: {
    origins: string[];
  };
  logging: {
    level: string;
    format: string;
  };
}

export const configuration = (): AppConfiguration => ({
  app: {
    name: process.env.APP_NAME ?? 'Jeevandata',
    port: parseInt(process.env.APP_PORT ?? '4000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    backendUrl: process.env.BACKEND_URL ?? 'http://localhost:4000',
  },
  database: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://jeevandata:jeevandata_secret@localhost:5432/jeevandata?schema=public',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://default:redis_secret@localhost:6379',
  },
  qdrant: {
    url: process.env.QDRANT_URL ?? 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY ?? '',
  },
  storage: {
    endpoint: process.env.R2_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.R2_REGION ?? 'auto',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? 'minioadmin',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? 'minioadmin',
    publicBucket: process.env.R2_PUBLIC_BUCKET ?? 'jeevandata-media',
    audioPrefix: process.env.R2_AUDIO_PREFIX ?? 'audio',
    facePrefix: process.env.R2_FACE_PREFIX ?? 'faces',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
  },
  google: {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    whisperApiUrl: process.env.WHISPER_API_URL ?? 'http://localhost:9001/inference',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-this-to-a-strong-random-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-this-to-a-different-random-secret',
    expiration: process.env.JWT_EXPIRATION ?? '24h',
  },
  session: {
    inactivityTimeoutMs: parseInt(process.env.SESSION_INACTIVITY_TIMEOUT_MS ?? '600000', 10),
    autoCloseMs: parseInt(process.env.SESSION_AUTO_CLOSE_MS ?? '600000', 10),
  },
  face: {
    matchThreshold: parseFloat(process.env.FACE_MATCH_THRESHOLD ?? '0.82'),
    embeddingDim: parseInt(process.env.FACE_EMBEDDING_DIM ?? '512', 10),
    livenessThreshold: parseFloat(process.env.LIVENESS_THRESHOLD ?? '0.7'),
  },
  audio: {
    autoDeleteDays: parseInt(process.env.AUDIO_AUTO_DELETE_DAYS ?? '30', 10),
    format: process.env.AUDIO_FORMAT ?? 'opus',
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE ?? '48000', 10),
  },
  archival: {
    coldAfterDays: parseInt(process.env.ARCHIVAL_COLD_AFTER_DAYS ?? '90', 10),
  },
  audit: {
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS ?? '90', 10),
  },
  pms: {
    fhirEndpoint: process.env.PMS_FHIR_ENDPOINT ?? '',
    customEndpoint: process.env.PMS_CUSTOM_ENDPOINT ?? '',
    apiKey: process.env.PMS_API_KEY ?? '',
    cacheTtlMs: parseInt(process.env.PMS_CACHE_TTL_MS ?? '86400000', 10),
  },
  opentelemetry: {
    enabled: process.env.OTEL_ENABLED !== 'false',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'jeevandata-api',
    exporterType: process.env.OTEL_EXPORTER_TYPE ?? 'jaeger',
    endpoint: process.env.OTEL_ENDPOINT ?? 'http://localhost:14268/api/traces',
    otlpEndpoint: process.env.OTEL_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
    sampleRate: parseFloat(process.env.OTEL_SAMPLE_RATE ?? '1.0'),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'debug',
    format: process.env.LOG_FORMAT ?? 'json',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
});

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = (request.headers['x-correlation-id'] as string) ?? randomUUID();

    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('X-Correlation-Id', correlationId);

    next();
  }
}

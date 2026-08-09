import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url } = request;
    const correlationId = (request.headers['x-correlation-id'] as string) ?? 'unknown';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse<Response>();
          const duration = Date.now() - now;
          this.logger.log(
            `${method} ${url} ${response.statusCode} ${duration}ms [${correlationId}]`,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - now;
          this.logger.error(`${method} ${url} ${duration}ms [${correlationId}] - ${error.message}`);
        },
      }),
    );
  }
}

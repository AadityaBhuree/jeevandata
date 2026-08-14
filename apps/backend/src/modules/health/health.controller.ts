import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness probe — always returns 200 if the process is running */
  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Always 200 while the process is running. Excluded from rate limiting.',
  })
  getLiveness() {
    return this.healthService.getLiveness();
  }

  /** Readiness probe — checks all critical dependencies (DB, Redis, Qdrant, Whisper) */
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Checks PostgreSQL, Redis, Qdrant, and the Whisper STT service. Returns 503 when any dependency is unhealthy.',
  })
  async getReadiness() {
    const result = await this.healthService.getReadiness();
    if (result.status === 'unhealthy') {
      throw new HttpException(
        {
          code: 'HEALTH_UNHEALTHY',
          message: 'One or more dependencies are unhealthy',
          details: result as unknown as Record<string, unknown>,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return result;
  }

  /** Overall health summary */
  @Get()
  @ApiOperation({
    summary: 'Overall health summary',
    description: 'Aggregates liveness + dependency readiness into a single summary.',
  })
  async getHealth() {
    const result = await this.healthService.getHealth();
    if (result.status === 'unhealthy') {
      throw new HttpException(
        {
          code: 'HEALTH_UNHEALTHY',
          message: 'One or more dependencies are unhealthy',
          details: result as unknown as Record<string, unknown>,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return result;
  }
}

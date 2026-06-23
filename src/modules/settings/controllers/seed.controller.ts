import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SeedService } from '../services/seed.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('seed')
  async seed() {
    const result = await this.seedService.seed();
    return { seeded: result };
  }
}

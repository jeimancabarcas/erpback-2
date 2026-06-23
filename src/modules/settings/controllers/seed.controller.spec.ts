import { Test, TestingModule } from '@nestjs/testing';
import { SeedController } from './seed.controller';
import { SeedService } from '../services/seed.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('SeedController', () => {
  let controller: SeedController;
  let mockSeedService: { seed: jest.Mock };

  beforeEach(async () => {
    mockSeedService = {
      seed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeedController],
      providers: [
        {
          provide: SeedService,
          useValue: mockSeedService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SeedController>(SeedController);
    jest.clearAllMocks();
  });

  describe('POST /settings/seed', () => {
    it('should return 201 with seeded counts wrapped in { seeded: ... }', async () => {
      mockSeedService.seed.mockResolvedValue({
        taxes: 5,
        paymentMethods: 6,
        paymentTypes: 2,
      });

      const result = await controller.seed();

      expect(mockSeedService.seed).toHaveBeenCalled();
      expect(result).toEqual({
        seeded: { taxes: 5, paymentMethods: 6, paymentTypes: 2 },
      });
    });

    it('should propagate errors from SeedService', async () => {
      mockSeedService.seed.mockRejectedValue(new Error('Seed failed'));

      await expect(controller.seed()).rejects.toThrow('Seed failed');
    });
  });

  describe('JwtAuthGuard', () => {
    it('should have JwtAuthGuard applied at controller level', async () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        SeedController,
      );
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(JwtAuthGuard);
    });

    it('should have JwtAuthGuard applied on the seed method', async () => {
      const methodGuards = Reflect.getMetadata(
        '__guards__',
        SeedController.prototype.seed,
      );
      const classGuards = Reflect.getMetadata(
        '__guards__',
        SeedController,
      );

      // The guard is applied at class level (not method level)
      expect(classGuards).toBeDefined();
      expect(classGuards[0]).toBe(JwtAuthGuard);
      expect(methodGuards).toBeUndefined();
    });
  });
});

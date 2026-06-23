import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TaxesService } from './taxes.service';
import { Tax } from '../entities/tax.entity';
import { QueryTaxDto } from '../dto/query-tax.dto';

describe('TaxesService', () => {
  let service: TaxesService;

  const mockRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxesService,
        {
          provide: getRepositoryToken(Tax),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TaxesService>(TaxesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated results sorted by sortOrder ASC then name ASC', async () => {
      const queryDto: QueryTaxDto = { page: 1, limit: 10 };
      const taxes = [{ id: '1', name: 'IVA 19%' }];

      mockRepository.findAndCount.mockResolvedValue([taxes, 1]);

      const result = await service.findAll(queryDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { sortOrder: 'ASC', name: 'ASC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        data: taxes,
        meta: { total: 1, page: 1, lastPage: 1, limit: 10 },
      });
    });

    it('should apply isActive filter when provided', async () => {
      const queryDto: QueryTaxDto = { page: 1, limit: 10, isActive: true };

      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(queryDto);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sortOrder: 'ASC', name: 'ASC' },
        take: 10,
        skip: 0,
      });
    });
  });

  describe('findOne', () => {
    it('should return a tax if found', async () => {
      const tax = { id: 'uuid-1', name: 'IVA 19%' };
      mockRepository.findOne.mockResolvedValue(tax);

      const result = await service.findOne('uuid-1');

      expect(result).toEqual(tax);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('uuid-1')).rejects.toThrow(NotFoundException);
    });
  });
});

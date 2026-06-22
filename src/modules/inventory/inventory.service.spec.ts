import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { InventoryBatch } from './entities/inventory-batch.entity';
import { InventoryCategory } from './entities/inventory-category.entity';
import { Repository } from 'typeorm';
import { validate } from 'class-validator';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceItem } from '../sales/entities/invoice-item.entity';

describe('InventoryService', () => {
  let service: InventoryService;
  let productRepo: Repository<Product>;
  let batchRepo: Repository<InventoryBatch>;

  const mockProductRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    manager: {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    },
  };

  const mockBatchRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockCategoryRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockInvoiceItemRepository = {
    find: jest.fn(),
  };

  const mockEntityManager = {
    getRepository: jest.fn().mockImplementation((entity) => {
      if (entity === Product) return mockProductRepository;
      if (entity === InventoryBatch) return mockBatchRepository;
      if (entity === InvoiceItem) return mockInvoiceItemRepository;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(InventoryBatch),
          useValue: mockBatchRepository,
        },
        {
          provide: getRepositoryToken(InventoryCategory),
          useValue: mockCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    productRepo = module.get<Repository<Product>>(getRepositoryToken(Product));
    batchRepo = module.get<Repository<InventoryBatch>>(
      getRepositoryToken(InventoryBatch),
    );

    jest.clearAllMocks();
    // Default transaction mock to execute the callback with the mock manager
    mockProductRepository.manager.transaction.mockImplementation((cb) =>
      cb(mockEntityManager),
    );
    mockProductRepository.manager.getRepository.mockImplementation((entity) =>
      mockEntityManager.getRepository(entity),
    );
    mockBatchRepository.create.mockImplementation((dto) => dto);
    mockProductRepository.create.mockImplementation((dto) => dto);
  });

  describe('UpdateProductDto', () => {
    it('should pass validation when adjustmentReason is valid or omitted', async () => {
      const dto = new UpdateProductDto();
      dto.adjustmentReason = 'Auditoría';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);

      const dtoOmitted = new UpdateProductDto();
      const errorsOmitted = await validate(dtoOmitted);
      expect(errorsOmitted.length).toBe(0);
    });

    it('should fail validation when adjustmentReason is empty or not a string', async () => {
      const dtoEmpty = new UpdateProductDto();
      dtoEmpty.adjustmentReason = '';
      const errorsEmpty = await validate(dtoEmpty);
      expect(errorsEmpty.length).toBeGreaterThan(0);
      expect(errorsEmpty[0].constraints).toHaveProperty('isNotEmpty');

      const dtoInvalidType = new UpdateProductDto();
      (dtoInvalidType as any).adjustmentReason = 123;
      const errorsInvalidType = await validate(dtoInvalidType);
      expect(errorsInvalidType.length).toBeGreaterThan(0);
      expect(errorsInvalidType[0].constraints).toHaveProperty('isString');
    });
  });

  describe('createProduct', () => {
    it('should create a product and also create an initial batch if currentStock > 0', async () => {
      const createDto = {
        name: 'Test Product',
        sku: 'TEST-SKU',
        currentStock: 10,
        minStock: 2,
        maxStock: 50,
        sellingPrice: 100,
      };

      const mockProduct = {
        id: 'prod-uuid',
        ...createDto,
        averagePurchasePrice: 0,
      } as Product;

      mockProductRepository.findOne.mockResolvedValue(null);
      mockProductRepository.create.mockReturnValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(mockProduct);
      mockBatchRepository.create.mockReturnValue({
        productId: 'prod-uuid',
        initialQuantity: 10,
        remainingQuantity: 10,
        purchasePrice: 0,
        adjustmentReason: 'Stock Inicial',
      });

      const result = await service.createProduct(createDto);

      expect(productRepo.findOne).toHaveBeenCalled();
      expect(productRepo.create).toHaveBeenCalledWith(createDto);
      expect(productRepo.save).toHaveBeenCalledWith(mockProduct);
      expect(batchRepo.create).toHaveBeenCalledWith({
        productId: 'prod-uuid',
        initialQuantity: 10,
        remainingQuantity: 10,
        purchasePrice: 0,
        adjustmentReason: 'Stock Inicial',
      });
      expect(batchRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should not create an initial batch if currentStock is 0', async () => {
      const createDto = {
        name: 'Test Product Zero',
        sku: 'TEST-SKU-ZERO',
        currentStock: 0,
        minStock: 2,
        maxStock: 50,
        sellingPrice: 100,
      };

      const mockProduct = {
        id: 'prod-uuid-zero',
        ...createDto,
        averagePurchasePrice: 0,
      } as Product;

      mockProductRepository.findOne.mockResolvedValue(null);
      mockProductRepository.create.mockReturnValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(mockProduct);

      const result = await service.createProduct(createDto);

      expect(batchRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should create initial batch with associated user when user is passed', async () => {
      const createDto = {
        name: 'Test Product User',
        sku: 'TEST-SKU-USER',
        currentStock: 10,
        minStock: 2,
        maxStock: 50,
        sellingPrice: 100,
      };

      const mockProduct = {
        id: 'prod-uuid-user',
        ...createDto,
        averagePurchasePrice: 0,
      } as Product;

      const mockUser = { id: 'user-uuid', email: 'test@example.com' } as any;

      mockProductRepository.findOne.mockResolvedValue(null);
      mockProductRepository.create.mockReturnValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(mockProduct);
      mockBatchRepository.create.mockReturnValue({
        productId: 'prod-uuid-user',
        initialQuantity: 10,
        remainingQuantity: 10,
        purchasePrice: 0,
        adjustmentReason: 'Stock Inicial',
        user: mockUser,
      });

      const result = await service.createProduct(createDto, mockUser);

      expect(batchRepo.create).toHaveBeenCalledWith({
        productId: 'prod-uuid-user',
        initialQuantity: 10,
        remainingQuantity: 10,
        purchasePrice: 0,
        adjustmentReason: 'Stock Inicial',
        user: mockUser,
      });
      expect(result).toEqual(mockProduct);
    });
  });

  describe('updateProduct stock adjustments', () => {
    const productId = 'prod-123';
    const originalProduct = {
      id: productId,
      name: 'Product 123',
      sku: 'SKU-123',
      currentStock: 10,
      averagePurchasePrice: 15.0,
      sellingPrice: 25.0,
    } as Product;

    it('should handle positive stock adjustment and create costed batch with reason', async () => {
      const updateDto: UpdateProductDto = {
        currentStock: 15, // +5 diff
        adjustmentReason: 'Auditoría',
      };

      const lockedProduct = { ...originalProduct };
      mockProductRepository.findOne.mockResolvedValue(lockedProduct);
      mockBatchRepository.find.mockResolvedValue([
        { remainingQuantity: 10, purchasePrice: 15.0 },
        { remainingQuantity: 5, purchasePrice: 15.0 },
      ]);
      mockProductRepository.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.updateProduct(productId, updateDto);

      expect(mockProductRepository.manager.transaction).toHaveBeenCalled();
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      });

      expect(mockBatchRepository.create).toHaveBeenCalledWith({
        productId: productId,
        initialQuantity: 5,
        remainingQuantity: 5,
        purchasePrice: 15.0,
        adjustmentReason: 'Auditoría',
      });
      expect(mockBatchRepository.save).toHaveBeenCalled();

      expect(result.currentStock).toBe(15);
      expect(mockProductRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: productId,
          currentStock: 15,
        }),
      );
    });

    it('should handle negative stock adjustment, consume stock FIFO-style and save tracking batch', async () => {
      const updateDto: UpdateProductDto = {
        currentStock: 6, // -4 diff
        adjustmentReason: 'Pérdida',
      };

      const lockedProduct = { ...originalProduct };
      mockProductRepository.findOne.mockResolvedValue(lockedProduct);

      const activeBatches = [
        {
          id: 'batch-1',
          productId,
          remainingQuantity: 10,
          purchasePrice: 15.0,
          save: jest.fn(),
        },
      ];
      mockBatchRepository.find.mockResolvedValue(activeBatches);
      mockProductRepository.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.updateProduct(productId, updateDto);

      expect(activeBatches[0].remainingQuantity).toBe(6); // 10 - 4 consumed
      expect(mockBatchRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'batch-1',
          remainingQuantity: 6,
        }),
      );

      expect(mockBatchRepository.create).toHaveBeenCalledWith({
        productId,
        initialQuantity: -4,
        remainingQuantity: 0,
        purchasePrice: 15.0,
        adjustmentReason: 'Pérdida',
      });
      expect(mockBatchRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          initialQuantity: -4,
          remainingQuantity: 0,
          adjustmentReason: 'Pérdida',
        }),
      );

      expect(result.currentStock).toBe(6);
    });

    it('should throw BadRequestException if stock is insufficient for negative adjustment', async () => {
      const lowStockProduct = { ...originalProduct, currentStock: 3 };
      mockProductRepository.findOne.mockResolvedValue(lowStockProduct);

      const negativeStockDto: UpdateProductDto = {
        currentStock: -2,
        adjustmentReason: 'Merma',
      };

      await expect(
        service.updateProduct(productId, negativeStockDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should assign user to positive adjustment batch', async () => {
      const updateDto: UpdateProductDto = {
        currentStock: 15,
        adjustmentReason: 'Auditoría',
      };
      const mockUser = { id: 'user-uuid', email: 'test@example.com' } as any;
      const lockedProduct = { ...originalProduct };
      mockProductRepository.findOne.mockResolvedValue(lockedProduct);
      mockBatchRepository.find.mockResolvedValue([
        { remainingQuantity: 10, purchasePrice: 15.0 },
      ]);
      mockProductRepository.save.mockImplementation((p) => Promise.resolve(p));

      await service.updateProduct(productId, updateDto, mockUser);

      expect(mockBatchRepository.create).toHaveBeenCalledWith({
        productId: productId,
        initialQuantity: 5,
        remainingQuantity: 5,
        purchasePrice: 15.0,
        adjustmentReason: 'Auditoría',
        user: mockUser,
      });
    });

    it('should assign user to negative adjustment tracking batch', async () => {
      const updateDto: UpdateProductDto = {
        currentStock: 6,
        adjustmentReason: 'Pérdida',
      };
      const mockUser = { id: 'user-uuid', email: 'test@example.com' } as any;
      const lockedProduct = { ...originalProduct };
      mockProductRepository.findOne.mockResolvedValue(lockedProduct);
      const activeBatches = [
        {
          id: 'batch-1',
          productId,
          remainingQuantity: 10,
          purchasePrice: 15.0,
          save: jest.fn(),
        },
      ];
      mockBatchRepository.find.mockResolvedValue(activeBatches);
      mockProductRepository.save.mockImplementation((p) => Promise.resolve(p));

      await service.updateProduct(productId, updateDto, mockUser);

      expect(mockBatchRepository.create).toHaveBeenCalledWith({
        productId,
        initialQuantity: -4,
        remainingQuantity: 0,
        purchasePrice: 15.0,
        adjustmentReason: 'Pérdida',
        user: mockUser,
      });
    });
  });

  describe('getMovements', () => {
    it('should compile manual positive and negative adjustments with origin/destination set to "Ajuste de inventario"', async () => {
      const mockBatches = [
        {
          id: 'b1111111-uuid',
          createdAt: new Date('2026-06-20T12:00:00Z'),
          initialQuantity: 10,
          purchaseOrderId: null, // manual adjustment (or initial stock)
          product: { name: 'Test Product' },
        },
        {
          id: 'b2222222-uuid',
          createdAt: new Date('2026-06-20T12:10:00Z'),
          initialQuantity: -5, // negative manual adjustment
          purchaseOrderId: null,
          product: { name: 'Test Product' },
        },
        {
          id: 'b3333333-uuid',
          createdAt: new Date('2026-06-20T12:20:00Z'),
          initialQuantity: 8,
          purchaseOrderId: 'po-uuid-1', // regular purchase
          product: { name: 'Test Product' },
        },
      ] as any[];

      mockBatchRepository.find.mockResolvedValue(mockBatches);
      mockInvoiceItemRepository.find.mockResolvedValue([]); // no invoices

      const result = await service.getMovements({});

      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);

      const manualPos = result.data.find((m) => m.id === 'IN-B1111111');
      expect(manualPos).toBeDefined();
      expect(manualPos.type).toBe('In');
      expect(manualPos.quantity).toBe(10);
      expect(manualPos.origin).toBe('Ajuste de inventario');
      expect(manualPos.destination).toBe('Ajuste de inventario');

      const manualNeg = result.data.find((m) => m.id === 'OUT-B2222222');
      expect(manualNeg).toBeDefined();
      expect(manualNeg.type).toBe('Out');
      expect(manualNeg.quantity).toBe(5);
      expect(manualNeg.origin).toBe('Ajuste de inventario');
      expect(manualNeg.destination).toBe('Ajuste de inventario');

      const purchase = result.data.find((m) => m.id === 'IN-B3333333');
      expect(purchase).toBeDefined();
      expect(purchase.type).toBe('In');
      expect(purchase.quantity).toBe(8);
      expect(purchase.origin).toBe('Proveedor (Compra)');
      expect(purchase.destination).toBe('Almacén Principal');
    });

    it('should retrieve movements with operator email or Sistema fallback', async () => {
      const mockBatches = [
        {
          id: 'b1111111-uuid',
          createdAt: new Date('2026-06-20T12:00:00Z'),
          initialQuantity: 10,
          purchaseOrderId: null,
          product: { name: 'Test Product' },
          user: { email: 'operator@example.com' },
        },
        {
          id: 'b2222222-uuid',
          createdAt: new Date('2026-06-20T12:10:00Z'),
          initialQuantity: -5,
          purchaseOrderId: null,
          product: { name: 'Test Product' },
          user: null, // should fall back to 'Sistema'
        },
        {
          id: 'b3333333-uuid',
          createdAt: new Date('2026-06-20T12:20:00Z'),
          initialQuantity: 8,
          purchaseOrderId: 'po-uuid-1',
          product: { name: 'Test Product' },
          user: null,
        },
      ] as any[];

      mockBatchRepository.find.mockResolvedValue(mockBatches);
      mockInvoiceItemRepository.find.mockResolvedValue([
        {
          id: 'inv-item-1',
          quantity: 2,
          product: { name: 'Test Product' },
          invoice: { date: new Date('2026-06-20T12:30:00Z') },
        },
      ]);

      const result = await service.getMovements({});

      expect(batchRepo.find).toHaveBeenCalledWith({
        relations: ['product', 'user'],
      });

      const manualPos = result.data.find((m) => m.id === 'IN-B1111111');
      expect(manualPos.operator).toBe('operator@example.com');

      const manualNeg = result.data.find((m) => m.id === 'OUT-B2222222');
      expect(manualNeg.operator).toBe('Sistema');

      const purchase = result.data.find((m) => m.id === 'IN-B3333333');
      expect(purchase.operator).toBe('Sistema');

      const sale = result.data.find((m) => m.id === 'OUT-INV-ITEM');
      expect(sale.operator).toBe('Sistema');
    });
  });

  describe('InventoryBatch Entity properties', () => {
    it('should support setting user and userId', () => {
      const batch = new InventoryBatch();
      batch.userId = 'user-uuid';
      batch.user = { id: 'user-uuid', email: 'test@example.com' } as any;
      expect(batch.userId).toBe('user-uuid');
      expect(batch.user.email).toBe('test@example.com');
    });
  });
});

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
import { InventoryMovement, MovementType } from './entities/inventory-movement.entity';

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

  const mockMovementRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
  };

  const mockEntityManager = {
    getRepository: jest.fn().mockImplementation((entity) => {
      if (entity === Product) return mockProductRepository;
      if (entity === InventoryBatch) return mockBatchRepository;
      if (entity === InventoryMovement) return mockMovementRepository;
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
        {
          provide: getRepositoryToken(InventoryMovement),
          useValue: mockMovementRepository,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    productRepo = module.get<Repository<Product>>(getRepositoryToken(Product));
    batchRepo = module.get<Repository<InventoryBatch>>(
      getRepositoryToken(InventoryBatch),
    );

    jest.resetAllMocks();
    // Default transaction mock to execute the callback with the mock manager
    mockProductRepository.manager.transaction.mockImplementation((cb) =>
      cb(mockEntityManager),
    );
    mockProductRepository.manager.getRepository.mockImplementation((entity) =>
      mockEntityManager.getRepository(entity),
    );
    mockEntityManager.getRepository.mockImplementation((entity) => {
      if (entity === Product) return mockProductRepository;
      if (entity === InventoryBatch) return mockBatchRepository;
      if (entity === InventoryMovement) return mockMovementRepository;
    });
    mockBatchRepository.create.mockImplementation((dto) => dto);
    mockProductRepository.create.mockImplementation((dto) => dto);
    mockMovementRepository.create.mockImplementation((dto) => dto);
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

    it('should record an INITIAL_STOCK movement when currentStock > 0', async () => {
      const createDto = {
        name: 'Test Product Movement',
        sku: 'TEST-SKU-MOVEMENT',
        currentStock: 10,
        minStock: 2,
        maxStock: 50,
        sellingPrice: 100,
      };

      const mockProduct = {
        id: 'prod-uuid-movement',
        ...createDto,
        averagePurchasePrice: 0,
      } as Product;

      mockProductRepository.findOne.mockResolvedValue(null);
      mockProductRepository.create.mockReturnValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(mockProduct);

      await service.createProduct(createDto);

      expect(mockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-uuid-movement',
          type: MovementType.IN,
          quantity: 10,
          origin: 'Stock Inicial',
          destination: 'Almacén Principal',
          referenceType: 'INITIAL_STOCK',
        }),
      );
      expect(mockMovementRepository.save).toHaveBeenCalled();
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

    it('should record a MANUAL_ADJUSTMENT In movement for positive stock diff', async () => {
      const updateDto: UpdateProductDto = {
        currentStock: 15,
        adjustmentReason: 'Auditoría',
      };

      const lockedProduct = { ...originalProduct };
      mockProductRepository.findOne.mockResolvedValue(lockedProduct);
      mockBatchRepository.find.mockResolvedValue([
        { remainingQuantity: 10, purchasePrice: 15.0 },
      ]);
      mockProductRepository.save.mockImplementation((p) => Promise.resolve(p));

      await service.updateProduct(productId, updateDto);

      expect(mockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId,
          type: MovementType.IN,
          quantity: 5,
          origin: 'Ajuste de inventario',
          destination: 'Ajuste de inventario',
          referenceType: 'MANUAL_ADJUSTMENT',
        }),
      );
      expect(mockMovementRepository.save).toHaveBeenCalled();
    });

    it('should record a MANUAL_ADJUSTMENT Out movement for negative stock diff', async () => {
      const updateDto: UpdateProductDto = {
        currentStock: 6,
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

      await service.updateProduct(productId, updateDto);

      expect(mockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId,
          type: MovementType.OUT,
          quantity: 4,
          origin: 'Ajuste de inventario',
          destination: 'Ajuste de inventario',
          referenceType: 'MANUAL_ADJUSTMENT',
        }),
      );
      expect(mockMovementRepository.save).toHaveBeenCalled();
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

  describe('updateStock — movement recording', () => {
    it('should record a PURCHASE_ORDER movement when purchaseOrderId is provided', async () => {
      const productId = 'prod-uuid-stock';
      const mockProduct = {
        id: productId,
        name: 'Test Product',
        currentStock: 5,
        averagePurchasePrice: 10,
      } as Product;

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockBatchRepository.create.mockReturnValue({});
      mockBatchRepository.save.mockResolvedValue({});
      mockBatchRepository.find.mockResolvedValue([]);
      mockProductRepository.save.mockResolvedValue(mockProduct);

      await service.updateStock(productId, 10, 15.5, 'po-uuid');

      expect(mockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId,
          type: MovementType.IN,
          quantity: 10,
          origin: 'Proveedor (Compra)',
          destination: 'Almacén Principal',
          referenceType: 'PURCHASE_ORDER',
          referenceId: 'po-uuid',
        }),
      );
      expect(mockMovementRepository.save).toHaveBeenCalled();
    });

    it('should record a MANUAL_ADJUSTMENT movement when purchaseOrderId is not provided', async () => {
      const productId = 'prod-uuid-manual';
      const mockProduct = {
        id: productId,
        name: 'Test Product',
        currentStock: 5,
        averagePurchasePrice: 10,
      } as Product;

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockBatchRepository.create.mockReturnValue({});
      mockBatchRepository.save.mockResolvedValue({});
      mockBatchRepository.find.mockResolvedValue([]);
      mockProductRepository.save.mockResolvedValue(mockProduct);

      await service.updateStock(productId, 5, 12.0);

      expect(mockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId,
          type: MovementType.IN,
          quantity: 5,
          origin: 'Ajuste de inventario',
          destination: 'Ajuste de inventario',
          referenceType: 'MANUAL_ADJUSTMENT',
        }),
      );
      expect(mockMovementRepository.save).toHaveBeenCalled();
    });
  });

  describe('getMovements', () => {
    it('should query movements from audit table with correct response shape', async () => {
      const mockMovements = [
        {
          id: 'mvmt-uuid-1',
          createdAt: new Date('2026-07-01T10:00:00Z'),
          type: MovementType.IN,
          quantity: 10,
          origin: 'Proveedor (Compra)',
          destination: 'Almacén Principal',
          referenceType: 'PURCHASE_ORDER',
          referenceId: 'po-uuid',
          product: { name: 'Test Product' },
          user: { email: 'operator@test.com' },
          userId: 'user-uuid',
        },
      ] as any[];

      mockMovementRepository.findAndCount.mockResolvedValue([
        mockMovements,
        1,
      ]);

      const result = await service.getMovements({});

      expect(mockMovementRepository.findAndCount).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].product).toBe('Test Product');
      expect(result.data[0].type).toBe('In');
      expect(result.data[0].quantity).toBe(10);
      expect(result.data[0].origin).toBe('Proveedor (Compra)');
      expect(result.data[0].destination).toBe('Almacén Principal');
      expect(result.data[0].operator).toBe('operator@test.com');
      expect(result.data[0].operatorId).toBe('user-uuid');
    });

    it('should filter by type when query param is provided', async () => {
      const outMovements = [
        {
          id: 'mvmt-out-uuid',
          createdAt: new Date('2026-07-01T10:00:00Z'),
          type: MovementType.OUT,
          quantity: 5,
          origin: 'Almacén Principal',
          destination: 'Cliente Final',
          referenceType: 'SALES_INVOICE',
          product: { name: 'Test Product' },
          user: null,
          userId: null,
        },
      ] as any[];

      mockMovementRepository.findAndCount.mockResolvedValue([
        outMovements,
        1,
      ]);

      const result = await service.getMovements({ type: 'Out' });

      expect(mockMovementRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: MovementType.OUT }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('Out');
    });

    it('should paginate results correctly', async () => {
      const allMovements = Array.from({ length: 25 }, (_, i) => ({
        id: `mvmt-${i}`,
        createdAt: new Date(`2026-07-0${(i % 9) + 1}T10:00:00Z`),
        type: i % 2 === 0 ? MovementType.IN : MovementType.OUT,
        quantity: i + 1,
        origin: 'Origen',
        destination: 'Destino',
        referenceType: 'MANUAL_ADJUSTMENT',
        product: { name: `Product ${i}` },
        user: null,
        userId: null,
      }));

      mockMovementRepository.count.mockResolvedValue(1);
      mockMovementRepository.findAndCount.mockResolvedValue([
        allMovements.slice(0, 10),
        25,
      ]);

      const result = await service.getMovements({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.page).toBe(1);
      expect(result.meta.lastPage).toBe(3);
      expect(result.meta.limit).toBe(10);
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

  // ---------------------------------------------------------------------------
  // restoreStock
  // ---------------------------------------------------------------------------
  describe('consumeStock — movement recording', () => {
    const productId = 'prod-consume-mvmt';

    it('should record a SALES_INVOICE Out movement when context is provided', async () => {
      const product = {
        id: productId,
        currentStock: 20,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      const batch = {
        id: 'batch-si',
        productId,
        initialQuantity: 20,
        remainingQuantity: 20,
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
        save: jest.fn(),
      };

      mockProductRepository.findOne.mockResolvedValue(product);
      mockBatchRepository.find.mockResolvedValue([batch]);
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );

      const cost = await service.consumeStock(productId, 5, undefined, {
        referenceType: 'SALES_INVOICE',
        referenceId: 'inv-uuid',
      });

      expect(cost).toBeGreaterThan(0);
      expect(mockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId,
          type: MovementType.OUT,
          quantity: 5,
          origin: 'Almacén Principal',
          destination: 'Cliente Final',
          referenceType: 'SALES_INVOICE',
          referenceId: 'inv-uuid',
        }),
      );
      expect(mockMovementRepository.save).toHaveBeenCalled();
    });

    it('should ALWAYS record a movement when consumeStock is called without context (UNKNOWN)', async () => {
      const product = {
        id: productId,
        currentStock: 20,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      const batch = {
        id: 'batch-si-noctx',
        productId,
        initialQuantity: 20,
        remainingQuantity: 20,
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
        save: jest.fn(),
      };

      mockProductRepository.findOne.mockResolvedValue(product);
      mockBatchRepository.find.mockResolvedValue([batch]);
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );
      // Spy on logger
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      await service.consumeStock(productId, 5);

      expect(mockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId,
          type: MovementType.OUT,
          quantity: 5,
          referenceType: 'UNKNOWN',
        }),
      );
      expect(mockMovementRepository.save).toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('consumeStock called without MovementContext'),
      );
      loggerWarnSpy.mockRestore();
    });
  });

  describe('InventoryMovement Entity', () => {
    it('should support MovementType enum values (In and Out)', () => {
      expect(MovementType.IN).toBe('In');
      expect(MovementType.OUT).toBe('Out');
    });

    it('should support creating an In movement with all fields', () => {
      const movement = new InventoryMovement();
      movement.productId = 'prod-uuid';
      movement.type = MovementType.IN;
      movement.quantity = 10;
      movement.origin = 'Proveedor (Compra)';
      movement.destination = 'Almacén Principal';
      movement.referenceType = 'PURCHASE_ORDER';
      movement.referenceId = 'po-uuid';
      movement.metadata = { purchaseOrderId: 'po-uuid' };

      expect(movement.productId).toBe('prod-uuid');
      expect(movement.type).toBe('In');
      expect(movement.quantity).toBe(10);
      expect(movement.origin).toBe('Proveedor (Compra)');
      expect(movement.destination).toBe('Almacén Principal');
      expect(movement.referenceType).toBe('PURCHASE_ORDER');
      expect(movement.referenceId).toBe('po-uuid');
      expect(movement.metadata).toEqual({ purchaseOrderId: 'po-uuid' });
      expect(movement.createdAt).toBeUndefined(); // not saved yet
    });

    it('should support creating an Out movement with userId and nullables', () => {
      const movement = new InventoryMovement();
      movement.productId = 'prod-uuid';
      movement.type = MovementType.OUT;
      movement.quantity = 5;
      movement.origin = 'Almacén Principal';
      movement.destination = 'Cliente Final';
      movement.referenceType = 'SALES_INVOICE';
      movement.userId = 'user-uuid';

      expect(movement.type).toBe('Out');
      expect(movement.userId).toBe('user-uuid');
      // Before save, nullable columns are undefined in TypeORM
      expect(movement.referenceId).toBeUndefined();
      expect(movement.metadata).toBeUndefined();
    });
  });

  describe('restoreStock', () => {
    const productId = 'prod-restore-1';

    it('should restore units to a single consumed batch and update stock', async () => {
      const product = {
        id: productId,
        currentStock: 7,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      const batch = {
        id: 'batch-1',
        productId,
        initialQuantity: 10,
        remainingQuantity: 7, // consumed 3
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
      } as InventoryBatch;

      mockProductRepository.findOne.mockResolvedValue(product);
      // Use a wrapper to track mutations on the batch reference
      let currentBatch = { ...batch };
      mockBatchRepository.find.mockImplementation(() => {
        return Promise.resolve([currentBatch]);
      });
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );
      mockBatchRepository.save.mockImplementation((b: any) => {
        currentBatch = b;
        return Promise.resolve(b);
      });

      const { totalCost, restoredQuantity } = await service.restoreStock(productId, 2);

      // Batch should have 2 units restored: 7 + 2 = 9
      expect(currentBatch.remainingQuantity).toBe(9);
      // Product stock should increase by 2: 7 + 2 = 9
      expect(product.currentStock).toBe(9);
      // Cost: 2 units * $10 = $20
      expect(totalCost).toBe(20);
      expect(restoredQuantity).toBe(2);
    });

    it('should restore across multiple batches using LIFO order (most recent consumption first)', async () => {
      const product = {
        id: productId,
        currentStock: 7,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      // Batch A: older batch, consumed 3 of 10 (remaining=7)
      // Batch B: newer batch, consumed 5 of 10 (remaining=5)
      // LIFO restore starts with Batch B (most recently consumed)
      const batchA = {
        id: 'batch-a',
        productId,
        initialQuantity: 10,
        remainingQuantity: 7,
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
      } as InventoryBatch;

      const batchB = {
        id: 'batch-b',
        productId,
        initialQuantity: 10,
        remainingQuantity: 5,
        purchasePrice: 12,
        createdAt: new Date('2026-06-20T11:00:00Z'),
      } as InventoryBatch;

      mockProductRepository.findOne.mockResolvedValue(product);
      // trackBatches reflects runtime mutations
      const trackBatches = [batchB, batchA];
      mockBatchRepository.find.mockImplementation(() =>
        Promise.resolve(trackBatches),
      );
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );
      mockBatchRepository.save.mockImplementation((b: any) => {
        // Update the tracked reference so find always returns current state
        const idx = trackBatches.findIndex((tb) => tb.id === b.id);
        if (idx !== -1) trackBatches[idx] = b;
        return Promise.resolve(b);
      });

      const { totalCost, restoredQuantity } = await service.restoreStock(productId, 4);

      // Batch B (newest) gets all 4 restored: 5 + 4 = 9
      expect(batchB.remainingQuantity).toBe(9);
      // Batch A unchanged: nothing left to restore
      expect(batchA.remainingQuantity).toBe(7);
      // Product stock: 7 + 4 = 11
      expect(product.currentStock).toBe(11);
      // Cost: 4 * $12 = $48 (all from batch B at $12/unit)
      expect(totalCost).toBe(48);
      expect(restoredQuantity).toBe(4);
    });

    it('should restore full consumed quantity across a single batch', async () => {
      const product = {
        id: productId,
        currentStock: 7,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      const batch = {
        id: 'batch-full',
        productId,
        initialQuantity: 10,
        remainingQuantity: 7, // consumed 3
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
      } as InventoryBatch;

      let currentBatch = { ...batch };
      mockProductRepository.findOne.mockResolvedValue(product);
      mockBatchRepository.find.mockImplementation(() =>
        Promise.resolve([currentBatch]),
      );
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );
      mockBatchRepository.save.mockImplementation((b: any) => {
        currentBatch = b;
        return Promise.resolve(b);
      });

      const { totalCost, restoredQuantity } = await service.restoreStock(productId, 3);

      expect(currentBatch.remainingQuantity).toBe(10); // fully restored to initial
      expect(product.currentStock).toBe(10); // 7 + 3
      expect(totalCost).toBe(30); // 3 * $10
      expect(restoredQuantity).toBe(3);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.restoreStock('nonexistent', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should record a CREDIT_NOTE In movement when context is provided', async () => {
      const product = {
        id: productId,
        currentStock: 7,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      const batch = {
        id: 'batch-cn',
        productId,
        initialQuantity: 10,
        remainingQuantity: 7,
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
      } as InventoryBatch;

      mockProductRepository.findOne.mockResolvedValue(product);
      let currentBatch = { ...batch };
      mockBatchRepository.find.mockImplementation(() =>
        Promise.resolve([currentBatch]),
      );
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );
      mockBatchRepository.save.mockImplementation((b: any) => {
        currentBatch = b;
        return Promise.resolve(b);
      });

      await service.restoreStock(productId, 2, undefined, {
        referenceType: 'CREDIT_NOTE',
        referenceId: 'cn-uuid',
      });

      expect(mockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId,
          type: MovementType.IN,
          quantity: 2,
          origin: 'Cliente Final (Devolución)',
          destination: 'Almacén Principal',
          referenceType: 'CREDIT_NOTE',
          referenceId: 'cn-uuid',
        }),
      );
      expect(mockMovementRepository.save).toHaveBeenCalled();
    });

    it('should ALWAYS record a movement when restoreStock is called without context (UNKNOWN)', async () => {
      const product = {
        id: productId,
        currentStock: 7,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      const batch = {
        id: 'batch-noctx',
        productId,
        initialQuantity: 10,
        remainingQuantity: 7,
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
      } as InventoryBatch;

      mockProductRepository.findOne.mockResolvedValue(product);
      let currentBatch = { ...batch };
      mockBatchRepository.find.mockImplementation(() =>
        Promise.resolve([currentBatch]),
      );
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );
      mockBatchRepository.save.mockImplementation((b: any) => {
        currentBatch = b;
        return Promise.resolve(b);
      });
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      await service.restoreStock(productId, 2);

      expect(mockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productId,
          type: MovementType.IN,
          quantity: 2,
          referenceType: 'UNKNOWN',
        }),
      );
      expect(mockMovementRepository.save).toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('restoreStock called without MovementContext'),
      );
      loggerWarnSpy.mockRestore();
    });

    it('should participate in a transaction when manager is provided', async () => {
      const product = {
        id: productId,
        currentStock: 7,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      let currentBatch = {
        id: 'batch-tx',
        productId,
        initialQuantity: 10,
        remainingQuantity: 7,
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
      } as InventoryBatch;

      mockProductRepository.findOne.mockResolvedValue(product);
      mockBatchRepository.find.mockImplementation(() =>
        Promise.resolve([currentBatch]),
      );
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );
      mockBatchRepository.save.mockImplementation((b: any) => {
        currentBatch = b;
        return Promise.resolve(b);
      });

      const { totalCost, restoredQuantity } = await service.restoreStock(
        productId,
        2,
        mockEntityManager as any,
      );

      // Manager.getRepository was called for both Product and InventoryBatch
      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(Product);
      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(
        InventoryBatch,
      );
      expect(totalCost).toBe(20);
      expect(restoredQuantity).toBe(2);
    });

    it('should not exceed initialQuantity when restoring to a batch (cap enforcement)', async () => {
      const product = {
        id: productId,
        currentStock: 7,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      // Batch consumed 3 units (initial=10, remaining=7) → max restore = 3
      let currentBatch = {
        id: 'batch-cap',
        productId,
        initialQuantity: 10,
        remainingQuantity: 7,
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
      } as InventoryBatch;

      mockProductRepository.findOne.mockResolvedValue(product);
      mockBatchRepository.find.mockImplementation(() =>
        Promise.resolve([currentBatch]),
      );
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );
      mockBatchRepository.save.mockImplementation((b: any) => {
        currentBatch = b;
        return Promise.resolve(b);
      });

      // Request restore 5 — batch capped at initialQuantity (3 restored to batch),
      // but product stock always gets the full quantity (5) since the credit note
      // reverses the full invoice consumption regardless of batch state.
      const { totalCost, restoredQuantity } = await service.restoreStock(productId, 5);

      expect(currentBatch.remainingQuantity).toBe(10); // capped at initialQuantity
      expect(product.currentStock).toBe(12); // 7 + 5 (full quantity, not capped by batch)
      expect(totalCost).toBe(30); // 3 units * $10 (batch-level cost)
      expect(restoredQuantity).toBe(5);
    });

    it('should still restore stock quantity even when no batches have been consumed', async () => {
      const product = {
        id: productId,
        currentStock: 10,
        averagePurchasePrice: 15,
        name: 'Test Product',
      } as Product;

      // Batch where remaining === initial (no consumption)
      const batch = {
        id: 'batch-no-consume',
        productId,
        initialQuantity: 10,
        remainingQuantity: 10, // NOT consumed
        purchasePrice: 10,
        createdAt: new Date('2026-06-20T10:00:00Z'),
      } as InventoryBatch;

      mockProductRepository.findOne.mockResolvedValue(product);
      mockBatchRepository.find.mockResolvedValue([batch]);
      mockProductRepository.save.mockImplementation((p: any) =>
        Promise.resolve(p),
      );
      mockBatchRepository.save.mockImplementation((b: any) =>
        Promise.resolve(b),
      );

      const { totalCost, restoredQuantity } = await service.restoreStock(
        productId,
        5,
      );

      // Batch-cost tracking returns 0 (no consumed batches to trace)
      expect(totalCost).toBe(0);
      // But product stock always increases by the full credit note quantity
      expect(restoredQuantity).toBe(5);
      expect(product.currentStock).toBe(15); // 10 + 5
    });
  });
});

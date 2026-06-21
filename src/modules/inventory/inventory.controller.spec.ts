import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: InventoryService;

  const mockInventoryService = {
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
    service = module.get<InventoryService>(InventoryService);
  });

  it('should pass req.user to service.createProduct', async () => {
    const mockUser = { id: 'user-uuid', email: 'test@example.com' };
    const createDto = { name: 'Prod', sku: 'SKU', currentStock: 10, minStock: 1, maxStock: 20, sellingPrice: 100 };
    mockInventoryService.createProduct.mockResolvedValue({ id: 'prod-uuid', ...createDto });

    const req = { user: mockUser };
    const result = await controller.createProduct(createDto, req);

    expect(service.createProduct).toHaveBeenCalledWith(createDto, mockUser);
    expect(result).toBeDefined();
  });

  it('should pass req.user to service.updateProduct', async () => {
    const mockUser = { id: 'user-uuid', email: 'test@example.com' };
    const updateDto = { currentStock: 15, adjustmentReason: 'Auditoría' };
    mockInventoryService.updateProduct.mockResolvedValue({ id: 'prod-uuid', currentStock: 15 });

    const req = { user: mockUser };
    const result = await controller.updateProduct('prod-uuid', updateDto, req);

    expect(service.updateProduct).toHaveBeenCalledWith('prod-uuid', updateDto, mockUser);
    expect(result).toBeDefined();
  });
});

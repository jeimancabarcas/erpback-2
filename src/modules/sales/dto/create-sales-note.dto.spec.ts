import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateSalesNoteItemDto } from './create-sales-note.dto';

describe('CreateSalesNoteItemDto', () => {
  it('should validate a valid item with required fields only', async () => {
    const dto = new CreateSalesNoteItemDto();
    dto.codeReference = 'REF-001';
    dto.quantity = 2;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept productId as optional', async () => {
    const dto = new CreateSalesNoteItemDto();
    dto.codeReference = 'REF-001';
    dto.quantity = 1;
    dto.productId = 'prod-uuid-123';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.productId).toBe('prod-uuid-123');
  });

  it('should accept scenarioType as optional string', async () => {
    const dto = new CreateSalesNoteItemDto();
    dto.codeReference = 'REF-001';
    dto.quantity = 1;
    dto.scenarioType = 'partial_return';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.scenarioType).toBe('partial_return');
  });

  it('should allow productId to be undefined', async () => {
    const dto = new CreateSalesNoteItemDto();
    dto.codeReference = 'REF-001';
    dto.quantity = 1;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.productId).toBeUndefined();
  });

  it('should allow scenarioType to be undefined', async () => {
    const dto = new CreateSalesNoteItemDto();
    dto.codeReference = 'REF-001';
    dto.quantity = 1;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.scenarioType).toBeUndefined();
  });
});

import { validate } from 'class-validator';
import { CreateSupplierDto } from './create-supplier.dto';

describe('CreateSupplierDto', () => {
  it('should pass validation with valid data including all optional fields', async () => {
    const dto = new CreateSupplierDto();
    dto.nit = '900123456-7';
    dto.name = 'Proveedor Test';
    dto.address = 'Calle 123';
    dto.phone = '3001234567';
    dto.dv = '7';
    dto.municipalityCode = '11001';
    dto.legalOrganizationCode = '01';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass validation without dv, municipalityCode, legalOrganizationCode', async () => {
    const dto = new CreateSupplierDto();
    dto.nit = '900123456-7';
    dto.name = 'Proveedor Test';
    dto.address = 'Calle 123';
    dto.phone = '3001234567';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation when nit is missing', async () => {
    const dto = new CreateSupplierDto();
    dto.name = 'Proveedor Test';
    dto.address = 'Calle 123';
    dto.phone = '3001234567';

    const errors = await validate(dto);
    const nitErrors = errors.filter((e) => e.property === 'nit');
    expect(nitErrors.length).toBeGreaterThan(0);
  });

  it('should fail validation when name is missing', async () => {
    const dto = new CreateSupplierDto();
    dto.nit = '900123456-7';
    dto.address = 'Calle 123';
    dto.phone = '3001234567';

    const errors = await validate(dto);
    const nameErrors = errors.filter((e) => e.property === 'name');
    expect(nameErrors.length).toBeGreaterThan(0);
  });
});

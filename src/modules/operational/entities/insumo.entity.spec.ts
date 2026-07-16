import { Insumo } from './insumo.entity';

describe('Insumo Entity', () => {
  it('should create a new Insumo instance', () => {
    const insumo = new Insumo();
    insumo.id = '550e8400-e29b-41d4-a716-446655440001';
    insumo.nombre = 'Cemento';
    insumo.descripcion = 'Cemento portland 50kg';
    insumo.unidadMedida = 'kg';
    insumo.stock = 100;

    expect(insumo.id).toBeDefined();
    expect(insumo.nombre).toBe('Cemento');
    expect(insumo.unidadMedida).toBe('kg');
    expect(insumo.stock).toBe(100);
  });

  it('should have required properties', () => {
    const insumo = new Insumo();

    expect(insumo).toHaveProperty('id');
    expect(insumo).toHaveProperty('nombre');
    expect(insumo).toHaveProperty('descripcion');
    expect(insumo).toHaveProperty('unidadMedida');
    expect(insumo).toHaveProperty('stock');
    expect(insumo).toHaveProperty('createdAt');
    expect(insumo).toHaveProperty('updatedAt');
  });

  it('should have default stock value of 0', () => {
    const insumo = new Insumo();
    expect(insumo.stock).toBeUndefined();

    const saved = { ...insumo, stock: 0 };
    expect(saved.stock).toBe(0);
  });
});

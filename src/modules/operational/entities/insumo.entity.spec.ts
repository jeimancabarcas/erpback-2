import { Insumo } from './insumo.entity';

describe('Insumo Entity', () => {
  it('should create a new Insumo instance', () => {
    const insumo = new Insumo();
    insumo.id = '550e8400-e29b-41d4-a716-446655440001';
    insumo.nombre = 'Cemento';
    insumo.descripcion = 'Cemento portland 50kg';

    expect(insumo.id).toBeDefined();
    expect(insumo.nombre).toBe('Cemento');
  });

  it('should have required properties', () => {
    const insumo = new Insumo();

    expect(insumo).toHaveProperty('id');
    expect(insumo).toHaveProperty('nombre');
    expect(insumo).toHaveProperty('descripcion');
    expect(insumo).toHaveProperty('createdAt');
    expect(insumo).toHaveProperty('updatedAt');
  });
});

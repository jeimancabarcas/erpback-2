import { Servicio } from './servicio.entity';

describe('Servicio Entity', () => {
  it('should create a new Servicio instance', () => {
    const servicio = new Servicio();
    servicio.id = '550e8400-e29b-41d4-a716-446655440002';
    servicio.nombre = 'Plomería';
    servicio.descripcion = 'Servicio de plomería general';
    servicio.precioBase = 150.0;

    expect(servicio.id).toBeDefined();
    expect(servicio.nombre).toBe('Plomería');
    expect(servicio.precioBase).toBe(150.0);
  });

  it('should have required properties', () => {
    const servicio = new Servicio();

    expect(servicio).toHaveProperty('id');
    expect(servicio).toHaveProperty('nombre');
    expect(servicio).toHaveProperty('descripcion');
    expect(servicio).toHaveProperty('precioBase');
    expect(servicio).toHaveProperty('createdAt');
    expect(servicio).toHaveProperty('updatedAt');
  });
});

import { Actividad } from './actividad.entity';

describe('Actividad Entity', () => {
  it('should create a new Actividad instance', () => {
    const actividad = new Actividad();
    actividad.id = '550e8400-e29b-41d4-a716-446655440000';
    actividad.nombre = 'Prueba';
    actividad.descripcion = 'Descripción de prueba';

    expect(actividad.id).toBeDefined();
    expect(actividad.nombre).toBe('Prueba');
    expect(actividad.descripcion).toBe('Descripción de prueba');
  });

  it('should have required properties', () => {
    const actividad = new Actividad();

    expect(actividad).toHaveProperty('id');
    expect(actividad).toHaveProperty('nombre');
    expect(actividad).toHaveProperty('descripcion');
    expect(actividad).toHaveProperty('createdAt');
    expect(actividad).toHaveProperty('updatedAt');
  });
});

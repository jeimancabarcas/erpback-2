import { ServicioActividad } from './servicio-actividad.entity';
import { Servicio } from './servicio.entity';
import { Actividad } from './actividad.entity';

describe('ServicioActividad Entity', () => {
  it('should create a new ServicioActividad instance', () => {
    const pivot = new ServicioActividad();
    pivot.id = '550e8400-e29b-41d4-a716-446655440003';

    expect(pivot.id).toBeDefined();
    expect(pivot.servicio).toBeUndefined();
    expect(pivot.actividad).toBeUndefined();
  });

  it('should have required properties', () => {
    const pivot = new ServicioActividad();

    expect(pivot).toHaveProperty('id');
    expect(pivot).toHaveProperty('servicio');
    expect(pivot).toHaveProperty('actividad');
  });

  it('should support Servicio relation', () => {
    const servicio = new Servicio();
    servicio.id = '550e8400-e29b-41d4-a716-446655440002';
    servicio.nombre = 'Plomería';

    const pivot = new ServicioActividad();
    pivot.servicio = servicio;

    expect(pivot.servicio).toBe(servicio);
  });

  it('should support Actividad relation', () => {
    const actividad = new Actividad();
    actividad.id = '550e8400-e29b-41d4-a716-446655440000';
    actividad.nombre = 'Instalación de tubería';

    const pivot = new ServicioActividad();
    pivot.actividad = actividad;

    expect(pivot.actividad).toBe(actividad);
  });
});

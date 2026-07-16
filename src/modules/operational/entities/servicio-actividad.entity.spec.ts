import { ServicioActividad } from './servicio-actividad.entity';
import { Servicio } from './servicio.entity';
import { Actividad } from './actividad.entity';

describe('ServicioActividad Entity', () => {
  it('should create a new ServicioActividad instance', () => {
    const pivot = new ServicioActividad();
    pivot.id = '550e8400-e29b-41d4-a716-446655440003';
    pivot.servicioId = '550e8400-e29b-41d4-a716-446655440002';
    pivot.actividadId = '550e8400-e29b-41d4-a716-446655440000';
    pivot.cantidad = 2;
    pivot.precio = 75.0;

    expect(pivot.id).toBeDefined();
    expect(pivot.servicioId).toBeDefined();
    expect(pivot.actividadId).toBeDefined();
    expect(pivot.cantidad).toBe(2);
    expect(pivot.precio).toBe(75.0);
  });

  it('should have required properties', () => {
    const pivot = new ServicioActividad();

    expect(pivot).toHaveProperty('id');
    expect(pivot).toHaveProperty('servicio');
    expect(pivot).toHaveProperty('servicioId');
    expect(pivot).toHaveProperty('actividad');
    expect(pivot).toHaveProperty('actividadId');
    expect(pivot).toHaveProperty('cantidad');
    expect(pivot).toHaveProperty('precio');
    expect(pivot).toHaveProperty('createdAt');
    expect(pivot).toHaveProperty('updatedAt');
  });

  it('should support Servicio relation', () => {
    const servicio = new Servicio();
    servicio.id = '550e8400-e29b-41d4-a716-446655440002';
    servicio.nombre = 'Plomería';

    const pivot = new ServicioActividad();
    pivot.servicio = servicio;
    pivot.servicioId = '550e8400-e29b-41d4-a716-446655440002';

    expect(pivot.servicio).toBe(servicio);
    expect(pivot.servicioId).toBe('550e8400-e29b-41d4-a716-446655440002');
  });

  it('should support Actividad relation', () => {
    const actividad = new Actividad();
    actividad.id = '550e8400-e29b-41d4-a716-446655440000';
    actividad.nombre = 'Instalación de tubería';

    const pivot = new ServicioActividad();
    pivot.actividad = actividad;
    pivot.actividadId = '550e8400-e29b-41d4-a716-446655440000';

    expect(pivot.actividad).toBe(actividad);
    expect(pivot.actividadId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

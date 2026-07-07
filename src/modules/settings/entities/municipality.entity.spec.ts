import { Municipality } from './municipality.entity';

describe('Municipality Entity', () => {
  it('should create a Municipality instance', () => {
    const municipality = new Municipality();
    expect(municipality).toBeDefined();
  });

  it('should have code, name and department properties', () => {
    const municipality = new Municipality();
    municipality.code = '11001';
    municipality.name = 'Bogotá D.C.';
    municipality.department = 'Bogotá D.C.';

    expect(municipality.code).toBe('11001');
    expect(municipality.name).toBe('Bogotá D.C.');
    expect(municipality.department).toBe('Bogotá D.C.');
  });

  it('should have a unique code as primary key', () => {
    const municipality = new Municipality();
    municipality.code = '05001';
    municipality.name = 'Medellín';
    municipality.department = 'Antioquia';
    expect(municipality.code).toBe('05001');
    expect(municipality.department).toBe('Antioquia');
  });
});

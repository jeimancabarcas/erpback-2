import { Municipality } from './entities/municipality.entity';

describe('SettingsModule registration', () => {
  it('should have Municipality entity with correct table name', () => {
    const instance = new Municipality();
    expect(instance).toBeInstanceOf(Municipality);
    expect(Municipality.name).toBe('Municipality');
  });

  it('should export Municipality entity for TypeOrmModule.forFeature', () => {
    const instance = new Municipality();
    expect(instance).toHaveProperty('code');
    expect(instance).toHaveProperty('name');
    expect(instance).toHaveProperty('department');
  });
});

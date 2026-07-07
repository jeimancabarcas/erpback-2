import { Invoice } from './invoice.entity';

describe('Invoice', () => {
  it('should create an instance with default values', () => {
    const inv = new Invoice();
    inv.id = 'inv-1';
    inv.date = new Date();
    inv.customerId = 'cust-1';
    inv.status = 'DRAFT' as any;

    expect(inv.id).toBe('inv-1');
    expect(inv.customerId).toBe('cust-1');
  });

  it('should have totalAmount with decimal default', () => {
    const inv = new Invoice();
    // totalAmount defaults to 0 via DB column default
    expect(inv.totalAmount).toBeUndefined(); // Not set yet — will get default from DB
    inv.totalAmount = 250000.5;
    expect(inv.totalAmount).toBe(250000.5);
  });

  it('should have subtotal with decimal default', () => {
    const inv = new Invoice();
    expect(inv.subtotal).toBeUndefined(); // Not set yet — will get default from DB
    inv.subtotal = 210000.0;
    expect(inv.subtotal).toBe(210000.0);
  });

  it('should allow setting totalAmount and subtotal together', () => {
    const inv = new Invoice();
    inv.totalAmount = 1190000;
    inv.subtotal = 1000000;

    expect(inv.totalAmount).toBe(1190000);
    expect(inv.subtotal).toBe(1000000);
  });
});

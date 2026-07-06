import { InvoiceItemTax } from './invoice-item-tax.entity';
import { InvoiceItem } from './invoice-item.entity';

describe('InvoiceItemTax', () => {
  it('should create an instance with basic fields', () => {
    const tax = new InvoiceItemTax();
    tax.id = 'tax-id-1';
    tax.invoiceItemId = 'item-id-1';
    tax.taxId = 'tax-uuid-1';

    expect(tax.id).toBe('tax-id-1');
    expect(tax.invoiceItemId).toBe('item-id-1');
    expect(tax.taxId).toBe('tax-uuid-1');
  });

  it('should have taxAmount with decimal default', () => {
    const tax = new InvoiceItemTax();
    expect(tax.taxAmount).toBeUndefined(); // Will get default from DB
    tax.taxAmount = 19000;
    expect(tax.taxAmount).toBe(19000);
  });

  it('should allow setting taxAmount with decimal precision', () => {
    const tax = new InvoiceItemTax();
    tax.taxAmount = 99.99;
    expect(Number(tax.taxAmount.toFixed(2))).toBe(99.99);
  });

  it('should have a ManyToOne relation to InvoiceItem', () => {
    const tax = new InvoiceItemTax();
    const item = new InvoiceItem();
    tax.invoiceItem = item;
    tax.invoiceItemId = 'item-id';

    expect(tax.invoiceItem).toBeDefined();
    expect(tax.invoiceItemId).toBe('item-id');
  });
});

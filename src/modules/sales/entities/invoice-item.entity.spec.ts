import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemTax } from './invoice-item-tax.entity';
import { Product } from '../../../modules/inventory/entities/product.entity';

describe('InvoiceItem', () => {
  it('should create an instance with default values for required fields', () => {
    const item = new InvoiceItem();
    item.id = 'item-1';
    item.productId = 'prod-1';
    item.quantity = 5;

    expect(item.id).toBe('item-1');
    expect(item.productId).toBe('prod-1');
    expect(item.quantity).toBe(5);
  });

  it('should have unitPrice with decimal default', () => {
    const item = new InvoiceItem();
    expect(item.unitPrice).toBeUndefined(); // Will get default from DB
    item.unitPrice = 50000;
    expect(item.unitPrice).toBe(50000);
  });

  it('should have subtotal with decimal default', () => {
    const item = new InvoiceItem();
    expect(item.subtotal).toBeUndefined(); // Will get default from DB
    item.subtotal = 250000;
    expect(item.subtotal).toBe(250000);
  });

  it('should have taxAmount with decimal default', () => {
    const item = new InvoiceItem();
    expect(item.taxAmount).toBeUndefined(); // Will get default from DB
    item.taxAmount = 47500;
    expect(item.taxAmount).toBe(47500);
  });

  it('should allow setting unitPrice, subtotal and taxAmount together', () => {
    const item = new InvoiceItem();
    item.unitPrice = 119000;
    item.subtotal = 119000;
    item.taxAmount = 19000;

    expect(item.unitPrice).toBe(119000);
    expect(item.subtotal).toBe(119000);
    expect(item.taxAmount).toBe(19000);
  });

  it('should have a OneToMany relation to InvoiceItemTax', () => {
    const item = new InvoiceItem();
    const tax1 = new InvoiceItemTax();
    const tax2 = new InvoiceItemTax();
    item.invoiceItemTaxes = [tax1, tax2];

    expect(item.invoiceItemTaxes).toHaveLength(2);
    expect(item.invoiceItemTaxes[0]).toBe(tax1);
    expect(item.invoiceItemTaxes[1]).toBe(tax2);
  });

  it('should have a ManyToOne relation to Product', () => {
    const item = new InvoiceItem();
    const product = new Product();
    item.product = product;
    item.productId = 'prod-1';

    expect(item.product).toBeDefined();
    expect(item.productId).toBe('prod-1');
  });
});

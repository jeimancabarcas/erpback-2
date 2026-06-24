import { DebitNoteItem } from './debit-note-item.entity';
import { DebitNoteItemTax } from './debit-note-item-tax.entity';
import { Product } from '../../../modules/inventory/entities/product.entity';

describe('DebitNoteItem', () => {
  it('should create an instance with default values for new fields', () => {
    const item = new DebitNoteItem();
    item.id = 'item-1';
    item.codeReference = 'REF-001';
    item.name = 'Test Product';
    item.quantity = 2;
    item.unitPrice = 50000;
    item.subtotal = 100000;

    // New fields should have defaults or be nullable
    expect(item.taxAmount).toBeUndefined(); // Will get default from DB
    expect(item.productId).toBeUndefined(); // Nullable
    expect(item.purchasePrice).toBeUndefined(); // Nullable
  });

  it('should allow setting productId as nullable', () => {
    const item = new DebitNoteItem();
    expect(item.productId).toBeUndefined();

    item.productId = 'prod-123';
    expect(item.productId).toBe('prod-123');

    item.productId = null as any;
    expect(item.productId).toBeNull();
  });

  it('should allow setting purchasePrice as nullable', () => {
    const item = new DebitNoteItem();
    expect(item.purchasePrice).toBeUndefined();

    item.purchasePrice = 45000;
    expect(item.purchasePrice).toBe(45000);

    item.purchasePrice = null as any;
    expect(item.purchasePrice).toBeNull();
  });

  it('should have a OneToMany relation to DebitNoteItemTax', () => {
    const item = new DebitNoteItem();
    const tax1 = new DebitNoteItemTax();
    const tax2 = new DebitNoteItemTax();
    item.noteItemTaxes = [tax1, tax2];

    expect(item.noteItemTaxes).toHaveLength(2);
    expect(item.noteItemTaxes[0]).toBe(tax1);
    expect(item.noteItemTaxes[1]).toBe(tax2);
  });

  it('should have a ManyToOne relation to Product', () => {
    const item = new DebitNoteItem();
    const product = new Product();
    item.product = product;
    item.productId = 'prod-1';

    expect(item.product).toBeDefined();
    expect(item.productId).toBe('prod-1');
  });
});

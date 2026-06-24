import { CreditNoteItemTax } from './credit-note-item-tax.entity';
import { CreditNoteItem } from './credit-note-item.entity';

describe('CreditNoteItemTax', () => {
  it('should create an instance with all fields', () => {
    const tax = new CreditNoteItemTax();
    tax.id = 'tax-id-1';
    tax.creditNoteItemId = 'cn-item-id-1';
    tax.taxId = 'tax-uuid-1';
    tax.taxCode = '01';
    tax.taxName = 'IVA';
    tax.taxRate = 19.0;
    tax.taxAmount = 19000;

    expect(tax.id).toBe('tax-id-1');
    expect(tax.creditNoteItemId).toBe('cn-item-id-1');
    expect(tax.taxId).toBe('tax-uuid-1');
    expect(tax.taxCode).toBe('01');
    expect(tax.taxName).toBe('IVA');
    expect(tax.taxRate).toBe(19.0);
    expect(tax.taxAmount).toBe(19000);
  });

  it('should have a ManyToOne relation to CreditNoteItem', () => {
    const tax = new CreditNoteItemTax();
    const item = new CreditNoteItem();
    tax.creditNoteItem = item;
    tax.creditNoteItemId = 'item-id';

    expect(tax.creditNoteItem).toBeDefined();
    expect(tax.creditNoteItemId).toBe('item-id');
  });

  it('should allow decimal precision for taxRate and taxAmount', () => {
    const tax = new CreditNoteItemTax();
    tax.taxRate = 0.5;
    tax.taxAmount = 99.99;

    expect(Number(tax.taxRate.toFixed(2))).toBe(0.5);
    expect(Number(tax.taxAmount.toFixed(2))).toBe(99.99);
  });
});

import { DebitNoteItemTax } from './debit-note-item-tax.entity';
import { DebitNoteItem } from './debit-note-item.entity';

describe('DebitNoteItemTax', () => {
  it('should create an instance with all fields', () => {
    const tax = new DebitNoteItemTax();
    tax.id = 'tax-id-1';
    tax.debitNoteItemId = 'dn-item-id-1';
    tax.taxId = 'tax-uuid-1';
    tax.taxCode = '01';
    tax.taxName = 'IVA';
    tax.taxRate = 19.0;
    tax.taxAmount = 19000;

    expect(tax.id).toBe('tax-id-1');
    expect(tax.debitNoteItemId).toBe('dn-item-id-1');
    expect(tax.taxId).toBe('tax-uuid-1');
    expect(tax.taxCode).toBe('01');
    expect(tax.taxName).toBe('IVA');
    expect(tax.taxRate).toBe(19.0);
    expect(tax.taxAmount).toBe(19000);
  });

  it('should have a ManyToOne relation to DebitNoteItem', () => {
    const tax = new DebitNoteItemTax();
    const item = new DebitNoteItem();
    tax.debitNoteItem = item;
    tax.debitNoteItemId = 'item-id';

    expect(tax.debitNoteItem).toBeDefined();
    expect(tax.debitNoteItemId).toBe('item-id');
  });

  it('should allow decimal precision for taxRate and taxAmount', () => {
    const tax = new DebitNoteItemTax();
    tax.taxRate = 1.75;
    tax.taxAmount = 500.5;

    expect(Number(tax.taxRate.toFixed(2))).toBe(1.75);
    expect(Number(tax.taxAmount.toFixed(2))).toBe(500.5);
  });
});

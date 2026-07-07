import { PurchaseOrderAdjustmentNote } from './purchase-order-adjustment-note.entity';
import { PurchaseOrderAdjustmentNoteItem } from './purchase-order-adjustment-note-item.entity';
import { PurchaseOrderAdjustmentNoteItemTax } from './purchase-order-adjustment-note-item-tax.entity';
import { PurchaseOrder } from './purchase-order.entity';

describe('Adjustment Note Entities (T3/T4/T5)', () => {
  describe('PurchaseOrderAdjustmentNote', () => {
    it('should have an id property (uuid PK)', () => {
      const entity = new PurchaseOrderAdjustmentNote();
      expect(entity).toHaveProperty('id');
    });

    it('should have referenceCode with unique constraint', () => {
      const entity = new PurchaseOrderAdjustmentNote();
      entity.referenceCode = 'NA-001';
      expect(entity.referenceCode).toBe('NA-001');
    });

    it('should have correctionConceptCode field', () => {
      const entity = new PurchaseOrderAdjustmentNote();
      entity.correctionConceptCode = '2';
      expect(entity.correctionConceptCode).toBe('2');
    });

    it('should have purchaseOrderId FK field', () => {
      const entity = new PurchaseOrderAdjustmentNote();
      entity.purchaseOrderId = 'order-uuid';
      expect(entity.purchaseOrderId).toBe('order-uuid');
    });

    it('should have supportDocumentId FK field (nullable)', () => {
      const entity = new PurchaseOrderAdjustmentNote();
      expect(entity).toHaveProperty('supportDocumentId');
      entity.supportDocumentId = 'doc-uuid';
      expect(entity.supportDocumentId).toBe('doc-uuid');
    });

    it('should have items collection', () => {
      const entity = new PurchaseOrderAdjustmentNote();
      expect(entity).toHaveProperty('items');
    });
  });

  describe('PurchaseOrderAdjustmentNoteItem', () => {
    it('should have an id property', () => {
      const entity = new PurchaseOrderAdjustmentNoteItem();
      expect(entity).toHaveProperty('id');
    });

    it('should have basic item fields', () => {
      const entity = new PurchaseOrderAdjustmentNoteItem();
      entity.codeReference = 'PROD-001';
      entity.name = 'Producto Test';
      entity.quantity = 10;
      entity.unitPrice = 5000;
      entity.subtotal = 50000;
      expect(entity.codeReference).toBe('PROD-001');
      expect(entity.name).toBe('Producto Test');
      expect(entity.quantity).toBe(10);
      expect(entity.unitPrice).toBe(5000);
    });

    it('should have consumed field (default false in DB)', () => {
      const entity = new PurchaseOrderAdjustmentNoteItem();
      expect(entity).toHaveProperty('consumed');
      entity.consumed = true;
      expect(entity.consumed).toBe(true);
    });

    it('should have adjustmentNoteId FK', () => {
      const entity = new PurchaseOrderAdjustmentNoteItem();
      entity.adjustmentNoteId = 'note-uuid';
      expect(entity.adjustmentNoteId).toBe('note-uuid');
    });
  });

  describe('PurchaseOrderAdjustmentNoteItemTax', () => {
    it('should have an id property', () => {
      const entity = new PurchaseOrderAdjustmentNoteItemTax();
      expect(entity).toHaveProperty('id');
    });

    it('should have tax fields', () => {
      const entity = new PurchaseOrderAdjustmentNoteItemTax();
      entity.taxCode = '01';
      entity.taxName = 'IVA';
      entity.taxRate = 19;
      entity.taxAmount = 19000;
      expect(entity.taxCode).toBe('01');
      expect(entity.taxName).toBe('IVA');
      expect(entity.taxRate).toBe(19);
      expect(entity.taxAmount).toBe(19000);
    });

    it('should have adjustmentNoteItemId FK', () => {
      const entity = new PurchaseOrderAdjustmentNoteItemTax();
      entity.adjustmentNoteItemId = 'item-uuid';
      expect(entity.adjustmentNoteItemId).toBe('item-uuid');
    });
  });

  describe('PurchaseOrder — adjustmentNotes relation (T5)', () => {
    it('should have adjustmentNotes property from PurchaseOrder entity', () => {
      const order = new PurchaseOrder();
      expect(order).toHaveProperty('adjustmentNotes');
      expect(order.adjustmentNotes).toBeUndefined(); // undefined until set
    });

    it('should allow setting adjustmentNotes', () => {
      const order = new PurchaseOrder();
      const notes: PurchaseOrderAdjustmentNote[] = [];
      order.adjustmentNotes = notes;
      expect(order.adjustmentNotes).toBe(notes);
    });
  });
});

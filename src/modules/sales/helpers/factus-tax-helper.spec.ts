import { computeFactusItemTaxes } from './factus-tax-helper';
import { Tax } from '../../settings/entities/tax.entity';

describe('computeFactusItemTaxes', () => {
  // -----------------------------------------------------------------------
  // Helper: create a mock tax
  // -----------------------------------------------------------------------
  function makeTax(overrides: Partial<Tax> = {}): Tax {
    return {
      id: 'tax-1',
      name: 'IVA 19%',
      code: '01',
      percentage: 19.0,
      type: 'percentage' as any,
      isPurchase: true,
      isSell: true,
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // -----------------------------------------------------------------------
  // Single tax: 19% IVA
  // -----------------------------------------------------------------------
  describe('single tax (19% IVA)', () => {
    it('computes priceBeforeTax and factusTaxes for 19% IVA product', () => {
      const product = { taxes: [makeTax()] };
      const result = computeFactusItemTaxes(product, 119000);

      expect(result.priceBeforeTax).toBe(100000);
      expect(result.factusTaxes).toHaveLength(1);
      expect(result.factusTaxes[0]).toEqual({
        code: '01',
        rate: '19.00',
        isExcluded: false,
      });
    });

    it('handles unitPrice that does not divide evenly (rounding)', () => {
      const product = { taxes: [makeTax()] };
      const result = computeFactusItemTaxes(product, 1000);

      // 1000 / 1.19 = 840.336... → toFixed(2) = 840.34
      expect(result.priceBeforeTax).toBe(840.34);
      expect(result.factusTaxes).toHaveLength(1);
      expect(result.factusTaxes[0].rate).toBe('19.00');
    });
  });

  // -----------------------------------------------------------------------
  // Exempt product (no taxes)
  // -----------------------------------------------------------------------
  describe('exempt product (no taxes)', () => {
    it('returns unitPrice as priceBeforeTax and empty taxes array', () => {
      const product = { taxes: [] };
      const result = computeFactusItemTaxes(product, 50000);

      expect(result.priceBeforeTax).toBe(50000);
      expect(result.factusTaxes).toEqual([]);
    });

    it('returns unitPrice as priceBeforeTax when product is null', () => {
      const result = computeFactusItemTaxes(null, 50000);

      expect(result.priceBeforeTax).toBe(50000);
      expect(result.factusTaxes).toEqual([]);
    });

    it('returns unitPrice as priceBeforeTax when product has no taxes property', () => {
      const result = computeFactusItemTaxes({}, 50000);

      expect(result.priceBeforeTax).toBe(50000);
      expect(result.factusTaxes).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Multiple taxes
  // -----------------------------------------------------------------------
  describe('multiple taxes per product', () => {
    it('computes combined tax rate with IVA 19% + INC 8%', () => {
      const product = {
        taxes: [
          makeTax({ code: '01', percentage: 19.0 }),
          makeTax({ code: '04', name: 'INC 8%', percentage: 8.0 }),
        ],
      };
      const result = computeFactusItemTaxes(product, 127000);

      // 127000 / (1 + 0.27) = 127000 / 1.27 = 100000
      expect(result.priceBeforeTax).toBe(100000);
      expect(result.factusTaxes).toHaveLength(2);
      expect(result.factusTaxes).toEqual([
        { code: '01', rate: '19.00', isExcluded: false },
        { code: '04', rate: '8.00', isExcluded: false },
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // 0% tax rate
  // -----------------------------------------------------------------------
  describe('zero-percentage tax', () => {
    it('treats 0% tax as zero rate but still includes it in taxes array', () => {
      const product = {
        taxes: [makeTax({ code: '03', name: 'IVA Exento', percentage: 0.0 })],
      };
      const result = computeFactusItemTaxes(product, 50000);

      // totalTaxRate = 0 → priceBeforeTax = unitPrice
      expect(result.priceBeforeTax).toBe(50000);
      expect(result.factusTaxes).toHaveLength(1);
      expect(result.factusTaxes[0]).toEqual({
        code: '03',
        rate: '0.00',
        isExcluded: false,
      });
    });
  });

  // -----------------------------------------------------------------------
  // InvoiceItem-style input (has unitPrice accessor)
  // -----------------------------------------------------------------------
  describe('InvoiceItem-style input', () => {
    it('accepts an InvoiceItem-like object with unitPrice', () => {
      const invoiceItem = {
        unitPrice: 238000,
        product: {
          taxes: [makeTax({ percentage: 19.0 })],
        },
      };
      const result = computeFactusItemTaxes(
        invoiceItem.product,
        Number(invoiceItem.unitPrice),
      );

      expect(result.priceBeforeTax).toBe(200000);
      expect(result.factusTaxes).toHaveLength(1);
    });
  });
});

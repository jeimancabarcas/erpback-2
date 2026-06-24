import { calculateProportionalTax } from './tax-recalculator';
import { InvoiceItemTax } from '../entities/invoice-item-tax.entity';

// ---------------------------------------------------------------------------
// Helper to create InvoiceItemTax fixtures
// ---------------------------------------------------------------------------
function makeTax(overrides: Partial<InvoiceItemTax> = {}): InvoiceItemTax {
  return {
    id: 'tax-id',
    invoiceItemId: 'inv-item-id',
    invoiceItem: undefined as any,
    taxId: 'tax-uuid',
    taxCode: '01',
    taxName: 'IVA',
    taxRate: 19,
    taxAmount: 19.0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Quantity-proportional tax calculation
// ---------------------------------------------------------------------------
describe('calculateProportionalTax (qty mode)', () => {
  it('should return proportional tax amount based on quantity ratio', () => {
    const taxes = [makeTax({ taxAmount: 19.0 })];
    const result = calculateProportionalTax(taxes, {
      type: 'qty',
      noteValue: 3,
      invoiceValue: 10,
    });

    expect(result.totalTaxAmount).toBe(5.7);
    expect(result.itemTaxes).toHaveLength(1);
    expect(result.itemTaxes[0].amount).toBe(5.7);
    expect(result.itemTaxes[0].taxCode).toBe('01');
  });
});

// ---------------------------------------------------------------------------
// Price-proportional tax calculation
// ---------------------------------------------------------------------------
describe('calculateProportionalTax (price mode)', () => {
  it('should return proportional tax based on price ratio', () => {
    const taxes = [makeTax({ taxAmount: 19.0, taxCode: '01' })];
    const result = calculateProportionalTax(taxes, {
      type: 'price',
      noteValue: 80,
      invoiceValue: 100,
    });

    expect(result.totalTaxAmount).toBe(15.2);
    expect(result.itemTaxes).toHaveLength(1);
    expect(result.itemTaxes[0].amount).toBe(15.2);
  });
});

// ---------------------------------------------------------------------------
// Banker's rounding (half-to-even)
// ---------------------------------------------------------------------------
describe('calculateProportionalTax rounding', () => {
  it("should round 1.005 down to 1.00 using banker's rounding (half-to-even)", () => {
    const taxes = [makeTax({ taxAmount: 1.005, taxCode: '01' })];
    const result = calculateProportionalTax(taxes, {
      type: 'qty',
      noteValue: 1,
      invoiceValue: 1,
    });

    expect(result.totalTaxAmount).toBe(1.0);
  });

  it("should round 2.005 down to 2.00 using banker's rounding (half-to-even — even target)", () => {
    const taxes = [makeTax({ taxAmount: 2.005 })];
    const result = calculateProportionalTax(taxes, {
      type: 'qty',
      noteValue: 1,
      invoiceValue: 1,
    });

    expect(result.totalTaxAmount).toBe(2.0);
  });

  it("should round 1.015 up to 1.02 using banker's rounding (half-to-even — odd target)", () => {
    const taxes = [makeTax({ taxAmount: 1.015 })];
    const result = calculateProportionalTax(taxes, {
      type: 'qty',
      noteValue: 1,
      invoiceValue: 1,
    });

    expect(result.totalTaxAmount).toBe(1.02);
  });
});

// ---------------------------------------------------------------------------
// Multi-tax support
// ---------------------------------------------------------------------------
describe('calculateProportionalTax multi-tax', () => {
  it('should distribute each tax independently by quantity ratio', () => {
    const taxes = [
      makeTax({
        taxId: 'iva-uuid',
        taxCode: '01',
        taxName: 'IVA',
        taxRate: 19,
        taxAmount: 19.0,
      }),
      makeTax({
        taxId: 'ica-uuid',
        taxCode: '03',
        taxName: 'ICA',
        taxRate: 0.5,
        taxAmount: 0.5,
      }),
    ];
    const result = calculateProportionalTax(taxes, {
      type: 'qty',
      noteValue: 5,
      invoiceValue: 10,
    });

    expect(result.totalTaxAmount).toBeCloseTo(9.75, 2);
    expect(result.itemTaxes).toHaveLength(2);

    const iva = result.itemTaxes.find((t) => t.taxCode === '01');
    expect(iva!.amount).toBeCloseTo(9.5, 2);

    const ica = result.itemTaxes.find((t) => t.taxCode === '03');
    expect(ica!.amount).toBeCloseTo(0.25, 2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('calculateProportionalTax edge cases', () => {
  it('should return zero amounts when noteValue is 0 (qty mode)', () => {
    const taxes = [makeTax({ taxAmount: 19.0 })];
    const result = calculateProportionalTax(taxes, {
      type: 'qty',
      noteValue: 0,
      invoiceValue: 10,
    });

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should return zero amounts when noteValue is 0 (price mode)', () => {
    const taxes = [makeTax({ taxAmount: 19.0 })];
    const result = calculateProportionalTax(taxes, {
      type: 'price',
      noteValue: 0,
      invoiceValue: 100,
    });

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should return zero amounts when invoiceValue is 0 (price mode)', () => {
    const taxes = [makeTax({ taxAmount: 19.0 })];
    const result = calculateProportionalTax(taxes, {
      type: 'price',
      noteValue: 80,
      invoiceValue: 0,
    });

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should return zero amounts when taxes array is empty', () => {
    const result = calculateProportionalTax([], {
      type: 'qty',
      noteValue: 3,
      invoiceValue: 10,
    });

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should return zero amounts when invoiceValue is 0 in qty mode', () => {
    const taxes = [makeTax({ taxAmount: 19.0 })];
    const result = calculateProportionalTax(taxes, {
      type: 'qty',
      noteValue: 3,
      invoiceValue: 0,
    });

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should handle full match where noteValue equals invoiceValue', () => {
    const taxes = [makeTax({ taxAmount: 19.0 })];
    const result = calculateProportionalTax(taxes, {
      type: 'qty',
      noteValue: 10,
      invoiceValue: 10,
    });

    expect(result.totalTaxAmount).toBe(19.0);
    expect(result.itemTaxes).toHaveLength(1);
    expect(result.itemTaxes[0].amount).toBe(19.0);
  });
});

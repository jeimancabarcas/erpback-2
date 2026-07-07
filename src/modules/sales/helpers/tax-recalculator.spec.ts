import { calculateProportionalTax } from './tax-recalculator';
import { InvoiceItemTax } from '../entities/invoice-item-tax.entity';

// ---------------------------------------------------------------------------
// Helper to create InvoiceItemTax fixtures (with Tax relation)
// ---------------------------------------------------------------------------
function makeTax(overrides: Partial<InvoiceItemTax> = {}): InvoiceItemTax {
  return {
    id: 'tax-id',
    invoiceItemId: 'inv-item-id',
    invoiceItem: undefined as any,
    taxId: 'tax-uuid',
    taxAmount: 0,
    tax: { code: '01', name: 'IVA', percentage: 19 } as any,
    ...overrides,
  };
}

const UNIT_PRICE = 119; // priceBeforeTax=100 at 19% → perUnitTax=19

// ---------------------------------------------------------------------------
// Quantity-proportional tax calculation
// ---------------------------------------------------------------------------
describe('calculateProportionalTax (qty mode)', () => {
  it('should return proportional tax amount based on quantity ratio', () => {
    const taxes = [makeTax()];
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'qty',
        noteValue: 3,
        invoiceValue: 10,
      },
      UNIT_PRICE,
    );

    // perUnitTax = 19, ratio = 0.3 → amount = 5.7
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
    const taxes = [makeTax()];
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'price',
        noteValue: 80,
        invoiceValue: 100,
      },
      UNIT_PRICE,
    );

    // perUnitTax = 19, ratio = 0.8 → amount = 15.2
    expect(result.totalTaxAmount).toBe(15.2);
    expect(result.itemTaxes).toHaveLength(1);
    expect(result.itemTaxes[0].amount).toBe(15.2);
  });
});

// ---------------------------------------------------------------------------
// Banker's rounding (half-to-even)
// ---------------------------------------------------------------------------
describe('calculateProportionalTax rounding', () => {
  it("should round 0.95*1=0.95 to 1.00 using banker's rounding", () => {
    // rate=5 → perUnitTax = 100 * 5/100 = 5 at unitPrice=105
    const taxes = [
      makeTax({ tax: { code: '05', name: 'Test', percentage: 5 } as any }),
    ];
    // unitPrice=105 → priceBeforeTax=105/1.05=100 → perUnitTax=5
    // ratio=1/1 → amount=5.0
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'qty',
        noteValue: 1,
        invoiceValue: 1,
      },
      105,
    );

    expect(result.totalTaxAmount).toBe(5.0);
  });

  it('should handle full match where noteValue equals invoiceValue', () => {
    const taxes = [makeTax()];
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'qty',
        noteValue: 10,
        invoiceValue: 10,
      },
      UNIT_PRICE,
    );

    // perUnitTax = 19, ratio = 1.0 → amount = 19.0
    expect(result.totalTaxAmount).toBe(19.0);
    expect(result.itemTaxes).toHaveLength(1);
    expect(result.itemTaxes[0].amount).toBe(19.0);
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
        tax: { code: '01', name: 'IVA', percentage: 19 } as any,
      }),
      makeTax({
        taxId: 'ica-uuid',
        tax: { code: '03', name: 'ICA', percentage: 0.5 } as any,
      }),
    ];
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'qty',
        noteValue: 5,
        invoiceValue: 10,
      },
      119.5,
    ); // weighted: 119.5 → totalRate=19.5 → priceBeforeTax=100 → IVA=19*0.5=9.5, ICA=0.5*0.5=0.25

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
    const taxes = [makeTax()];
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'qty',
        noteValue: 0,
        invoiceValue: 10,
      },
      UNIT_PRICE,
    );

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should return zero amounts when noteValue is 0 (price mode)', () => {
    const taxes = [makeTax()];
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'price',
        noteValue: 0,
        invoiceValue: 100,
      },
      UNIT_PRICE,
    );

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should return zero amounts when invoiceValue is 0 (price mode)', () => {
    const taxes = [makeTax()];
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'price',
        noteValue: 80,
        invoiceValue: 0,
      },
      UNIT_PRICE,
    );

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should return zero amounts when taxes array is empty', () => {
    const result = calculateProportionalTax(
      [],
      {
        type: 'qty',
        noteValue: 3,
        invoiceValue: 10,
      },
      UNIT_PRICE,
    );

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should return zero amounts when invoiceValue is 0 in qty mode', () => {
    const taxes = [makeTax()];
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'qty',
        noteValue: 3,
        invoiceValue: 0,
      },
      UNIT_PRICE,
    );

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(0);
  });

  it('should handle unitPrice=0 gracefully', () => {
    const taxes = [makeTax()];
    const result = calculateProportionalTax(
      taxes,
      {
        type: 'qty',
        noteValue: 5,
        invoiceValue: 10,
      },
      0,
    );

    expect(result.totalTaxAmount).toBe(0);
    expect(result.itemTaxes).toHaveLength(1);
  });
});

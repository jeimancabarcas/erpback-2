import { InvoiceItemTax } from '../entities/invoice-item-tax.entity';

export interface ProportionalTaxResult {
  totalTaxAmount: number;
  itemTaxes: {
    taxId: string;
    taxCode: string;
    taxRate: number;
    amount: number;
  }[];
}

export type ProportionalFactor = {
  type: 'qty' | 'price';
  noteValue: number;
  invoiceValue: number;
};

/** Helper: compute the effective per-unit price (from product.sellingPrice) */
export function getEffectiveUnitPrice(invoiceItem: {
  product?: { sellingPrice?: number };
}): number {
  return Number(invoiceItem.product?.sellingPrice || 0);
}

/**
 * Applies banker's rounding (half-to-even) to 2 decimal places.
 * Also known as "round half to even" or "unbiased rounding".
 *
 * Examples:
 *   1.005 → 1.00 (even digit before 5)
 *   1.015 → 1.02 (odd digit before 5)
 *   2.005 → 2.00 (even digit before 5)
 *
 * Uses a small epsilon tolerance (1e-10) to detect exact-half values
 * that may have floating-point representation issues (e.g., 1.015 * 100
 * produces 101.49999999999999 instead of 101.5).
 */
function bankersRound(value: number): number {
  const scaled = value * 100;
  const integerPart = Math.trunc(scaled);
  const fraction = scaled - integerPart;

  // Tolerance for floating-point drift around exactly-0.5 fractions
  const HALF_EPSILON = 1e-10;
  const isExactHalf = Math.abs(fraction - 0.5) < HALF_EPSILON;

  if (isExactHalf) {
    // Half-to-even: round toward even integer
    if (integerPart % 2 === 0) {
      return integerPart / 100;
    }
    return (integerPart + 1) / 100;
  }

  // Standard rounding for non-half cases
  return Math.round(scaled) / 100;
}

/**
 * Calculates proportional tax amounts for a credit/debit note item
 * based on the original InvoiceItemTax records (with eager-loaded Tax relation).
 *
 * The original per-unit tax amount is computed on the fly from the Tax entity,
 * since the denormalized tax columns have been removed from InvoiceItemTax.
 *
 * Two modes:
 * - `qty`:   taxAmount = originalTaxAmount * (noteQty / invoiceQty)
 * - `price`: taxAmount = originalTaxAmount * (notePrice / originalPrice)
 *
 * Each tax is distributed independently, rounded to 2 decimal places
 * using banker's rounding (half-to-even).
 *
 * @param invoiceItemTaxes - Original tax records from the invoice item (with eager-loaded Tax)
 * @param factor - Proportional factor with type, noteValue, and invoiceValue
 * @returns Total tax amount and per-tax breakdown
 */
export function calculateProportionalTax(
  invoiceItemTaxes: InvoiceItemTax[],
  factor: ProportionalFactor,
  unitPrice?: number,
): ProportionalTaxResult {
  // Edge cases: zero noteValue, zero invoiceValue, or empty taxes
  if (
    invoiceItemTaxes.length === 0 ||
    factor.noteValue === 0 ||
    factor.invoiceValue === 0
  ) {
    return { totalTaxAmount: 0, itemTaxes: [] };
  }

  // Compute total tax rate to derive priceBeforeTax
  const totalTaxRate = invoiceItemTaxes.reduce(
    (sum, t) => sum + Number(t.tax?.percentage || 0),
    0,
  );

  // If unitPrice is provided, compute the original per-unit tax amount from Tax relation
  const priceBeforeTax =
    unitPrice !== undefined && totalTaxRate > 0
      ? Number((unitPrice / (1 + totalTaxRate / 100)).toFixed(2))
      : unitPrice || 0;

  const ratio = factor.noteValue / factor.invoiceValue;
  let totalTaxAmount = 0;
  const itemTaxes: ProportionalTaxResult['itemTaxes'] = [];

  for (const tax of invoiceItemTaxes) {
    const taxRate = Number(tax.tax?.percentage || 0);
    const taxCode = tax.tax?.code || '';

    // Compute original per-unit tax amount: priceBeforeTax * rate / 100
    const originalPerUnitAmount =
      unitPrice !== undefined
        ? Number(((priceBeforeTax * taxRate) / 100).toFixed(2))
        : 0;

    // Apply proportional ratio (qty: noteQty/invoiceQty, price: notePrice/originalPrice)
    const rawAmount = originalPerUnitAmount * ratio;
    const amount = bankersRound(rawAmount);
    totalTaxAmount += amount;
    itemTaxes.push({
      taxId: tax.taxId,
      taxCode,
      taxRate,
      amount,
    });
  }

  // Ensure totalTaxAmount is also rounded to avoid floating-point drift
  totalTaxAmount = bankersRound(totalTaxAmount);

  return { totalTaxAmount, itemTaxes };
}

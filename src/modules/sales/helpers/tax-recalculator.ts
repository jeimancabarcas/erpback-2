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
 * based on the original InvoiceItemTax records.
 *
 * Two modes:
 * - `qty`:   taxAmount = originalTaxAmount * (noteQty / invoiceQty)
 * - `price`: taxAmount = originalTaxAmount * (notePrice / originalPrice)
 *
 * Each tax is distributed independently, rounded to 2 decimal places
 * using banker's rounding (half-to-even).
 *
 * @param invoiceItemTaxes - Original tax records from the invoice item
 * @param factor - Proportional factor with type, noteValue, and invoiceValue
 * @returns Total tax amount and per-tax breakdown
 */
export function calculateProportionalTax(
  invoiceItemTaxes: InvoiceItemTax[],
  factor: ProportionalFactor,
): ProportionalTaxResult {
  // Edge cases: zero noteValue, zero invoiceValue, or empty taxes
  if (
    invoiceItemTaxes.length === 0 ||
    factor.noteValue === 0 ||
    factor.invoiceValue === 0
  ) {
    return { totalTaxAmount: 0, itemTaxes: [] };
  }

  const ratio = factor.noteValue / factor.invoiceValue;
  let totalTaxAmount = 0;
  const itemTaxes: ProportionalTaxResult['itemTaxes'] = [];

  for (const tax of invoiceItemTaxes) {
    const rawAmount = Number(tax.taxAmount) * ratio;
    const amount = bankersRound(rawAmount);
    totalTaxAmount += amount;
    itemTaxes.push({
      taxId: tax.taxId,
      taxCode: tax.taxCode,
      taxRate: Number(tax.taxRate),
      amount,
    });
  }

  // Ensure totalTaxAmount is also rounded to avoid floating-point drift
  totalTaxAmount = bankersRound(totalTaxAmount);

  return { totalTaxAmount, itemTaxes };
}

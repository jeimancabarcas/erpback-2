import { Tax } from '../../settings/entities/tax.entity';
import { FactusTax } from '../../factus/interfaces/factus-invoicing-gateway.interface';

/**
 * Result of computing reverse-tax from a product's taxes and unit price.
 */
export interface FactusItemTaxComputation {
  /** Pre-tax price after reverse-tax calculation */
  priceBeforeTax: number;
  /** Factus-formatted tax entries */
  factusTaxes: FactusTax[];
}

/**
 * Compute Factus tax data from a product's taxes and a tax-inclusive unit price.
 *
 * Mirrors `SalesService.emit()` tax logic (lines 374-403):
 * - `priceBeforeTax = unitPrice / (1 + totalTaxRate/100)` when totalTaxRate > 0
 * - Falls back to `unitPrice` for exempt items (no taxes)
 * - Each product tax is mapped to a `FactusTax` with code, rate, and isExcluded=false
 *
 * @param product - Product-like object with optional `taxes` array (Tax[])
 * @param unitPrice - Tax-inclusive unit price from the invoice item
 * @returns FactusItemTaxComputation with priceBeforeTax and factusTaxes
 */
export function computeFactusItemTaxes(
  product: { taxes?: Tax[] } | null | undefined,
  unitPrice: number,
): FactusItemTaxComputation {
  const taxes = product?.taxes || [];
  const totalTaxRate = taxes.reduce((sum, t) => sum + Number(t.percentage), 0);
  const priceBeforeTax =
    totalTaxRate > 0
      ? Number((unitPrice / (1 + totalTaxRate / 100)).toFixed(2))
      : unitPrice;

  const factusTaxes: FactusTax[] = taxes.map((tax) => ({
    code: tax.code,
    rate: Number(tax.percentage).toFixed(2),
    isExcluded: false,
  }));

  return { priceBeforeTax, factusTaxes };
}

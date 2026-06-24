import { Injectable } from '@nestjs/common';
import {
  ScenarioHandler,
  ScenarioParams,
  ScenarioResult,
  PreparedNoteItem,
} from './scenario-handler.interface';

/**
 * Default tax rate for financial interest (Scenario E).
 * Can be configured via FACTUS_INTEREST_TAX_RATE env var.
 */
function getInterestTaxRate(): number {
  const envRate = process.env.FACTUS_INTEREST_TAX_RATE;
  if (envRate !== undefined) {
    const parsed = Number(envRate);
    if (!isNaN(parsed)) return parsed;
  }
  return 0; // Default: IVA-exempt for financial interest
}

/**
 * Scenario E — Financial Interest (DIAN correction code 1, debit notes).
 *
 * Business rules:
 * - Virtual line items — NO productId, no inventory impact (no restoreStock).
 * - Interest amount is taken from DTO item price; no matching against invoice items.
 * - Default tax rate is configurable via FACTUS_INTEREST_TAX_RATE env var (default: 0% — IVA-exempt).
 * - When rate is 0%, tax code is 'ZZ' (exempt); when rate > 0%, tax code is '01' (standard IVA).
 * - Interest amount becomes the note subtotal (before tax).
 * - Electronic path: price before tax computed from interest amount and rate.
 */
@Injectable()
export class ScenarioEHandler implements ScenarioHandler {
  getType(): 'credit' | 'debit' {
    return 'debit';
  }

  async execute(params: ScenarioParams): Promise<ScenarioResult> {
    const { invoice, dto } = params;

    if (!dto.items || dto.items.length === 0) {
      throw new Error(
        'El escenario de intereses financieros requiere ítems en el DTO',
      );
    }

    let totalAmount = 0;
    const items: PreparedNoteItem[] = [];
    const factusItems: any[] = [];
    const isElectronic = dto.isElectronic ?? invoice.isElectronic;
    const interestTaxRate = getInterestTaxRate();

    // Determine interest tax code based on rate
    // 'ZZ' for IVA-exempt (rate 0), '01' for standard IVA
    const interestTaxCode = interestTaxRate > 0 ? '01' : 'ZZ';

    for (const itemDto of dto.items) {
      // Virtual/financial line item — no productId
      const interestAmount =
        itemDto.price !== undefined ? Number(itemDto.price) : 0;
      const quantity = itemDto.quantity || 1;
      const subtotal = quantity * interestAmount;
      totalAmount += subtotal;

      // Default tax for interest
      const taxAmount =
        interestTaxRate > 0
          ? Number(
              (subtotal * (interestTaxRate / (100 + interestTaxRate))).toFixed(
                2,
              ),
            )
          : 0;

      const noteItemTaxes = [
        {
          taxId: '',
          taxCode: interestTaxCode,
          taxName: interestTaxRate > 0 ? 'IVA' : 'Exento',
          taxRate: interestTaxRate,
          taxAmount,
        },
      ];

      items.push({
        codeReference: itemDto.codeReference || 'FIN-INT',
        name: itemDto.codeReference
          ? `Interés: ${itemDto.codeReference}`
          : 'Intereses Financieros',
        quantity,
        unitPrice: interestAmount,
        subtotal,
        // No productId — virtual item
        taxAmount,
        noteItemTaxes,
      });

      if (isElectronic) {
        // For electronic, pass price before tax
        const priceBeforeTax =
          interestTaxRate > 0
            ? Number((interestAmount / (1 + interestTaxRate / 100)).toFixed(2))
            : interestAmount;

        const taxes = [
          {
            code: interestTaxCode,
            rate: interestTaxRate.toFixed(2),
            isExcluded: interestTaxRate === 0,
          },
        ];
        factusItems.push({
          codeReference: itemDto.codeReference || 'FIN-INT',
          name: 'Intereses Financieros',
          quantity,
          discountRate: 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes,
        });
      }
    }

    return {
      items,
      totalAmount,
      factusItems: isElectronic ? factusItems : undefined,
    };
  }
}

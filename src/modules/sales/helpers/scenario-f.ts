import { BadRequestException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import {
  ScenarioHandler,
  ScenarioParams,
  ScenarioResult,
  PreparedNoteItem,
} from './scenario-handler.interface';
import { calculateProportionalTax } from './tax-recalculator';
import { buildFactusItem } from './scenario-a';

/**
 * Scenario F — Undercharge Correction (DIAN correction codes 2, 3, 4 for debit notes).
 *
 * Business rules:
 * - The corrected price MUST be higher than the original invoice item unit price (undercharge).
 * - Only the DIFFERENTIAL (newPrice - originalPrice) is applied as the note line amount.
 * - Each DTO item is matched against invoice items by SKU/codeReference.
 * - Proportional tax is calculated in PRICE mode on the differential (taxes scaled by diff / original).
 * - No inventory impact (undercharge corrections do not affect stock).
 * - productId is carried from the matched invoice item for reference (not used for stock).
 * - Electronic path: builds Factus items with differential price and product tax codes.
 */
@Injectable()
export class ScenarioFHandler implements ScenarioHandler {
  getType(): 'credit' | 'debit' {
    return 'debit';
  }

  async execute(params: ScenarioParams): Promise<ScenarioResult> {
    const { invoice, dto } = params;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'El escenario de corrección por menor cobro requiere ítems en el DTO',
      );
    }

    let totalAmount = 0;
    const items: PreparedNoteItem[] = [];
    const factusItems: any[] = [];
    const isElectronic = dto.isElectronic ?? invoice.isElectronic;

    for (const itemDto of dto.items) {
      const matchingInvoiceItem = invoice.items.find(
        (ii) =>
          ii.product?.sku === itemDto.codeReference ||
          ii.productId === itemDto.codeReference,
      );

      if (!matchingInvoiceItem) {
        throw new BadRequestException(
          `El ítem con código ${itemDto.codeReference} no pertenece a esta factura`,
        );
      }

      const newPrice =
        itemDto.price !== undefined
          ? Number(itemDto.price)
          : Number(matchingInvoiceItem.unitPrice);

      const originalPrice = Number(matchingInvoiceItem.unitPrice);

      // Validate new price > original price (undercharge correction)
      if (newPrice <= originalPrice) {
        throw new BadRequestException(
          'La corrección por menor cobro requiere un precio mayor al precio original de la factura',
        );
      }

      // The differential becomes the item's unitPrice for the debit note
      const diffPrice = newPrice - originalPrice;
      const subtotal = itemDto.quantity * diffPrice;
      totalAmount += subtotal;

      // Calculate proportional tax on the differential (price mode)
      const invoiceItemTaxes = matchingInvoiceItem.invoiceItemTaxes || [];
      const taxResult = calculateProportionalTax(invoiceItemTaxes, {
        type: 'price',
        noteValue: diffPrice,
        invoiceValue: originalPrice,
      });

      const noteItemTaxes = taxResult.itemTaxes.map((t) => ({
        taxId: t.taxId,
        taxCode: t.taxCode,
        taxName: '',
        taxRate: t.taxRate,
        taxAmount: t.amount,
      }));

      items.push({
        codeReference: itemDto.codeReference,
        name: matchingInvoiceItem.product?.name || 'Producto',
        quantity: itemDto.quantity,
        unitPrice: diffPrice,
        subtotal,
        productId: matchingInvoiceItem.productId,
        taxAmount: taxResult.totalTaxAmount,
        noteItemTaxes,
      });

      if (isElectronic) {
        factusItems.push(
          buildFactusItem(
            matchingInvoiceItem,
            diffPrice,
            itemDto.quantity,
            taxResult,
          ),
        );
      }
    }

    return {
      items,
      totalAmount,
      factusItems: isElectronic ? factusItems : undefined,
    };
  }
}

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
 * Scenario B — Discount (DIAN correction code 3).
 *
 * Business rules:
 * - The new price MUST be lower than the original invoice item unit price (validates discount).
 * - Each DTO item is matched against invoice items by SKU/codeReference.
 * - Proportional tax is calculated in PRICE mode (taxes scaled by new price / original price).
 * - No inventory impact (discounts do not return or consume stock).
 * - Electronic path: builds Factus items with product-specific tax codes.
 */
@Injectable()
export class ScenarioBHandler implements ScenarioHandler {
  getType(): 'credit' | 'debit' {
    return 'credit';
  }

  async execute(params: ScenarioParams): Promise<ScenarioResult> {
    const { invoice, dto } = params;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'El escenario de descuento requiere ítems en el DTO',
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

      // Validate new price < original price (discount)
      if (newPrice >= originalPrice) {
        throw new BadRequestException(
          'El descuento requiere un precio menor al precio original de la factura',
        );
      }

      const subtotal = itemDto.quantity * newPrice;
      totalAmount += subtotal;

      // Calculate proportional tax (price mode) — no inventory impact
      const invoiceItemTaxes = matchingInvoiceItem.invoiceItemTaxes || [];
      const taxResult = calculateProportionalTax(invoiceItemTaxes, {
        type: 'price',
        noteValue: newPrice,
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
        unitPrice: newPrice,
        subtotal,
        taxAmount: taxResult.totalTaxAmount,
        restored: false,
        noteItemTaxes,
      });

      if (isElectronic) {
        factusItems.push(
          buildFactusItem(
            matchingInvoiceItem,
            newPrice,
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

import { BadRequestException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InvoiceStatus } from '../entities/invoice.entity';
import {
  ScenarioHandler,
  ScenarioParams,
  ScenarioResult,
  PreparedNoteItem,
} from './scenario-handler.interface';
import { InventoryService } from '../../inventory/inventory.service';

/**
 * Scenario D — Total Annulment (DIAN correction code 2).
 *
 * Business rules:
 * - The invoice MUST NOT already be in CANCELLED status.
 * - ALL invoice items are processed (no filtering by DTO items).
 * - Stock is restored for EVERY invoice item via InventoryService.restoreStock().
 * - ALL InvoiceItemTax amounts are reversed at 100% (full proportional reversal).
 * - The parent invoice status is set to CANCELLED after successful processing.
 * - Electronic path: builds factus items with full reversal price and product taxes.
 */
@Injectable()
export class ScenarioDHandler implements ScenarioHandler {
  constructor(private readonly inventoryService: InventoryService) {}

  getType(): 'credit' {
    return 'credit';
  }

  async execute(params: ScenarioParams): Promise<ScenarioResult> {
    const { invoice, dto, queryRunner } = params;

    // Validate invoice.status !== 'CANCELLED'
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        'No se puede anular una factura que ya está cancelada',
      );
    }

    let totalAmount = 0;
    const items: PreparedNoteItem[] = [];
    const factusItems: any[] = [];
    const isElectronic = dto.isElectronic ?? invoice.isElectronic;

    // Loop ALL invoice items for full annulment
    for (const invoiceItem of invoice.items) {
      // Restore stock for each item
      await this.inventoryService.restoreStock(
        invoiceItem.productId,
        invoiceItem.quantity,
        queryRunner,
      );

      const subtotal =
        Number(invoiceItem.quantity) * Number(invoiceItem.unitPrice);
      totalAmount += subtotal;

      // Reverse ALL InvoiceItemTax amounts (full reversal)
      const invoiceItemTaxes = invoiceItem.invoiceItemTaxes || [];
      const noteItemTaxes = invoiceItemTaxes.map((t) => ({
        taxId: t.taxId,
        taxCode: t.taxCode,
        taxName: t.taxName || '',
        taxRate: Number(t.taxRate),
        taxAmount: Number(t.taxAmount), // Full tax amount (100% reversal)
      }));

      const totalTaxAmount = noteItemTaxes.reduce(
        (sum, t) => sum + t.taxAmount,
        0,
      );

      items.push({
        codeReference: invoiceItem.product?.sku || invoiceItem.productId,
        name: invoiceItem.product?.name || 'Producto',
        quantity: Number(invoiceItem.quantity),
        unitPrice: Number(invoiceItem.unitPrice),
        subtotal,
        productId: invoiceItem.productId,
        purchasePrice: Number(invoiceItem.purchasePrice),
        taxAmount: totalTaxAmount,
        restored: true,
        noteItemTaxes,
      });

      if (isElectronic) {
        const unitPrice = Number(invoiceItem.unitPrice);
        const totalTaxRate = noteItemTaxes.reduce(
          (sum, t) => sum + t.taxRate,
          0,
        );
        const priceBeforeTax =
          totalTaxRate > 0
            ? Number((unitPrice / (1 + totalTaxRate / 100)).toFixed(2))
            : unitPrice;

        const taxMap = new Map<string, { code: string; rate: number; isExcluded: boolean }>();
        noteItemTaxes.forEach((t) => {
          const existing = taxMap.get(t.taxCode);
          if (existing) {
            existing.rate += t.taxRate;
          } else {
            taxMap.set(t.taxCode, {
              code: t.taxCode,
              rate: t.taxRate,
              isExcluded: false,
            });
          }
        });
        const taxes = Array.from(taxMap.values()).map((t) => ({
          code: t.code,
          rate: t.rate.toFixed(2),
          isExcluded: t.isExcluded,
        }));
        factusItems.push({
          codeReference: invoiceItem.product?.sku || invoiceItem.productId,
          name: invoiceItem.product?.name || 'Producto',
          quantity: Number(invoiceItem.quantity),
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
      updatedInvoiceStatus: InvoiceStatus.CANCELLED,
    };
  }
}

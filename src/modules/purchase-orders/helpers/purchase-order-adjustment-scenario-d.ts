import { Injectable, BadRequestException } from '@nestjs/common';
import {
  PurchaseOrderAdjustmentScenarioHandler,
  PurchaseOrderAdjustmentScenarioParams,
  PurchaseOrderAdjustmentScenarioResult,
  PreparedAdjustmentNoteItem,
  NoteItemTaxData,
} from './purchase-order-adjustment-scenario-handler.interface';
import { InventoryService } from '../../inventory/inventory.service';

@Injectable()
export class PurchaseOrderAdjustmentScenarioDHandler implements PurchaseOrderAdjustmentScenarioHandler {
  constructor(private readonly inventoryService: InventoryService) {}

  async execute(
    params: PurchaseOrderAdjustmentScenarioParams,
  ): Promise<PurchaseOrderAdjustmentScenarioResult> {
    const { purchaseOrder, queryRunner } = params;

    if (purchaseOrder.status === 'CANCELLED') {
      throw new BadRequestException(
        'No se puede emitir una nota de ajuste para una orden ya cancelada',
      );
    }

    let totalAmount = 0;
    const items: PreparedAdjustmentNoteItem[] = [];
    const factusItems: any[] = [];

    for (const orderItem of purchaseOrder.items) {
      // Consume stock (purchase reversal = remove stock)
      await this.inventoryService.consumeStock(
        orderItem.productId,
        orderItem.quantity,
        queryRunner,
        {
          referenceType: 'PURCHASE_ORDER_ADJUSTMENT',
          referenceId: purchaseOrder.id,
        },
      );

      // Compute priceBeforeTax from the tax-inclusive item.price
      const price = Number(orderItem.price);
      const taxes = orderItem.product?.taxes || [];
      const totalTaxRate = taxes.reduce(
        (sum: number, t: any) => sum + Number(t.percentage),
        0,
      );
      const priceBeforeTax =
        totalTaxRate > 0
          ? Math.round((price / (1 + totalTaxRate / 100)) * 100) / 100
          : price;

      const subtotal = Number(orderItem.quantity) * price;
      totalAmount += subtotal;

      // Tax breakdown
      const noteItemTaxes: NoteItemTaxData[] = taxes.map((t: any) => {
        const taxAmt = Number(
          ((priceBeforeTax * Number(t.percentage)) / 100).toFixed(2),
        );
        return {
          taxId: t.id,
          taxCode: t.code,
          taxName: t.name,
          taxRate: Number(t.percentage),
          taxAmount: taxAmt,
        };
      });

      const totalTaxAmount = noteItemTaxes.reduce(
        (sum, t) => sum + t.taxAmount,
        0,
      );

      items.push({
        codeReference: orderItem.product?.sku || orderItem.productId,
        name: orderItem.product?.name || 'Producto',
        quantity: Number(orderItem.quantity),
        unitPrice: price,
        subtotal,
        productId: orderItem.productId,
        taxAmount: totalTaxAmount,
        consumed: true,
        noteItemTaxes,
      });

      // Build Factus items
      const taxMap = new Map<
        string,
        { code: string; rate: number; isExcluded: boolean }
      >();
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
      const factusTaxes = Array.from(taxMap.values()).map((t) => ({
        code: t.code,
        rate: t.rate.toFixed(2),
        isExcluded: t.isExcluded,
      }));

      factusItems.push({
        codeReference: orderItem.product?.sku || orderItem.productId,
        name: orderItem.product?.name || 'Producto',
        quantity: Number(orderItem.quantity),
        discountRate: 0,
        price: priceBeforeTax,
        unitMeasureCode: '94',
        standardCode: '999',
        taxes: factusTaxes,
      });
    }

    return {
      items,
      totalAmount,
      factusItems,
      updatedOrderStatus: 'CANCELLED',
    };
  }
}

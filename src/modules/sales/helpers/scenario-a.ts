import { BadRequestException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InvoiceItem } from '../entities/invoice-item.entity';
import {
  ScenarioHandler,
  ScenarioParams,
  ScenarioResult,
  PreparedNoteItem,
} from './scenario-handler.interface';
import { calculateProportionalTax } from './tax-recalculator';
import { InventoryService } from '../../inventory/inventory.service';

/**
 * Scenario A — Partial Return (DIAN correction codes 1/5).
 *
 * Business rules:
 * - Each DTO item MUST have a productId (required for restoreStock).
 * - Each DTO item is matched against the original invoice items by productId or SKU.
 * - The requested quantity MUST NOT exceed the original invoice item quantity.
 * - Proportional tax is calculated in QTY mode (taxes scaled by note qty / invoice qty).
 * - Stock is restored via InventoryService.restoreStock() for each returned item.
 * - A purchasePrice is derived from the restored stock cost.
 * - Electronic path: builds Factus items with product-specific tax codes.
 */
@Injectable()
export class ScenarioAHandler implements ScenarioHandler {
  constructor(private readonly inventoryService: InventoryService) {}

  getType(): 'credit' {
    return 'credit';
  }

  async execute(params: ScenarioParams): Promise<ScenarioResult> {
    const { invoice, dto, queryRunner } = params;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'El escenario de devolución parcial requiere ítems en el DTO',
      );
    }

    let totalAmount = 0;
    const items: PreparedNoteItem[] = [];
    const factusItems: any[] = [];
    const isElectronic = dto.isElectronic ?? invoice.isElectronic;

    for (const itemDto of dto.items) {
      // Validate items have productId
      if (!itemDto.productId) {
        throw new BadRequestException(
          'La devolución parcial requiere que cada ítem tenga un productId',
        );
      }

      // Match DTO items to original Invoice items
      const matchingInvoiceItem = invoice.items.find(
        (ii) =>
          ii.productId === itemDto.productId ||
          ii.product?.sku === itemDto.codeReference,
      );

      if (!matchingInvoiceItem) {
        throw new BadRequestException(
          `El ítem con código ${itemDto.codeReference} no pertenece a esta factura`,
        );
      }

      // Validate requested qty <= invoice qty per item
      const requestedQty = itemDto.quantity;
      if (requestedQty > matchingInvoiceItem.quantity) {
        throw new BadRequestException(
          `La cantidad a acreditar (${requestedQty}) supera la cantidad facturada (${matchingInvoiceItem.quantity})`,
        );
      }

      const price =
        itemDto.price !== undefined
          ? Number(itemDto.price)
          : Number(matchingInvoiceItem.unitPrice);

      const subtotal = requestedQty * price;
      totalAmount += subtotal;

      // Calculate proportional tax (qty mode)
      const invoiceItemTaxes = matchingInvoiceItem.invoiceItemTaxes || [];
      const taxResult = calculateProportionalTax(invoiceItemTaxes, {
        type: 'qty',
        noteValue: requestedQty,
        invoiceValue: matchingInvoiceItem.quantity,
      });

      // Restore stock
      const totalItemCost = await this.inventoryService.restoreStock(
        itemDto.productId,
        requestedQty,
        queryRunner,
      );
      const purchasePrice = totalItemCost / requestedQty;

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
        quantity: requestedQty,
        unitPrice: price,
        subtotal,
        productId: itemDto.productId,
        purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice,
        taxAmount: taxResult.totalTaxAmount,
        restored: true,
        noteItemTaxes,
      });

      if (isElectronic) {
        factusItems.push(
          buildFactusItem(matchingInvoiceItem, price, requestedQty, taxResult),
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

export function buildFactusItem(
  invoiceItem: InvoiceItem,
  price: number,
  quantity: number,
  taxResult: {
    totalTaxAmount: number;
    itemTaxes: {
      taxId: string;
      taxCode: string;
      taxRate: number;
      amount: number;
    }[];
  },
): any {
  const taxMap = new Map<string, { code: string; rate: number; isExcluded: boolean }>();
  taxResult.itemTaxes.forEach((t) => {
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

  // Compute price before tax using the deduped tax rates
  const totalTaxRate = Array.from(taxMap.values()).reduce(
    (sum, t) => sum + t.rate,
    0,
  );
  const priceBeforeTax =
    totalTaxRate > 0
      ? Number((price / (1 + totalTaxRate / 100)).toFixed(2))
      : price;
  return {
    codeReference: invoiceItem.product?.sku || invoiceItem.productId,
    name: invoiceItem.product?.name || 'Producto',
    quantity,
    discountRate: 0,
    price: priceBeforeTax,
    unitMeasureCode: '94',
    standardCode: '999',
    taxes,
  };
}

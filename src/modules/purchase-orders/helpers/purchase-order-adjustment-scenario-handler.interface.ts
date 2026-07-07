import { PurchaseOrder } from '../entities/purchase-order.entity';
import { CreatePurchaseOrderAdjustmentNoteDto } from '../dto/create-purchase-order-adjustment-note.dto';
import { EntityManager } from 'typeorm';
import { IFactusInvoicingGateway } from '../../factus/interfaces/factus-invoicing-gateway.interface';
import { FactusItem } from '../../factus/interfaces/factus-invoicing-gateway.interface';

export interface NoteItemTaxData {
  taxId: string;
  taxCode: string;
  taxName: string;
  taxRate: number;
  taxAmount: number;
}

export interface PreparedAdjustmentNoteItem {
  codeReference: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productId?: string;
  taxAmount: number;
  consumed: boolean;
  noteItemTaxes: NoteItemTaxData[];
}

export interface PurchaseOrderAdjustmentScenarioResult {
  items: PreparedAdjustmentNoteItem[];
  totalAmount: number;
  factusItems: FactusItem[];
  updatedOrderStatus: string;
}

export interface PurchaseOrderAdjustmentScenarioParams {
  purchaseOrder: PurchaseOrder;
  dto: CreatePurchaseOrderAdjustmentNoteDto;
  queryRunner: EntityManager;
  factusGateway: IFactusInvoicingGateway;
}

export interface PurchaseOrderAdjustmentScenarioHandler {
  execute(
    params: PurchaseOrderAdjustmentScenarioParams,
  ): Promise<PurchaseOrderAdjustmentScenarioResult>;
}

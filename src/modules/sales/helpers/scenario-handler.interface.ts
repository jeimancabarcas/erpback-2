import { Invoice } from '../entities/invoice.entity';
import { CreateSalesNoteDto } from '../dto/create-sales-note.dto';
import { EntityManager } from 'typeorm';
import { IFactusInvoicingGateway } from '../../factus/interfaces/factus-invoicing-gateway.interface';

// ---------------------------------------------------------------------------
// Strategy Pattern: Scenario Handlers for Credit/Debit Notes
//
// Each scenario handler implements the ScenarioHandler interface and is
// registered in a strategy map (creditScenarioMap / debitScenarioMap) inside
// SalesService. The map dispatches to the correct handler based on the DIAN
// correctionConceptCode from the DTO.
//
// Handlers share common infrastructure via ScenarioParams:
//   - invoice:     The parent invoice (loaded with items + taxes)
//   - dto:         The incoming CreateSalesNoteDto
//   - queryRunner: TypeORM EntityManager for transactional persistence
//   - factusGateway: Optional Factus gateway for electronic note paths
//
// The ScenarioResult returned by each handler is consumed by
// processCreditNoteWithHandler / processDebitNoteWithHandler which handle
// Factus payload building (electronic) or local persistence (manual).
//
// Six concrete handlers cover the business scenarios:
//   Credit: ScenarioA (partial return), ScenarioB (discount),
//           ScenarioC (price correction), ScenarioD (total annulment)
//   Debit:  ScenarioE (financial interest), ScenarioF (undercharge correction)
// ---------------------------------------------------------------------------

/** Per-item tax breakdown data, mirroring InvoiceItemTax structure. */
export interface NoteItemTaxData {
  taxId: string;
  taxCode: string;
  taxName: string;
  taxRate: number;
  taxAmount: number;
}

/** A single item ready for persistence in a credit or debit note. */
export interface PreparedNoteItem {
  creditNoteId?: string;
  debitNoteId?: string;
  codeReference: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productId?: string;
  purchasePrice?: number;
  taxAmount: number;
  restored?: boolean;
  noteItemTaxes: NoteItemTaxData[];
}

/** Result produced by a scenario handler after executing its business rules. */
export interface ScenarioResult {
  /** Note items with computed prices, taxes, and inventory flags. */
  items: PreparedNoteItem[];
  /** Total monetary amount for the note. */
  totalAmount: number;
  /** Factus API payload items (only set for electronic notes). */
  factusItems?: any[];
  /** If set, the parent invoice status should be changed (e.g., CANCELLED for Scenario D). */
  updatedInvoiceStatus?: string;
}

/** Parameters passed to every scenario handler execution. */
export interface ScenarioParams {
  /** The parent invoice with loaded items, product, and invoiceItemTaxes relations. */
  invoice: Invoice;
  /** The incoming DTO (contains correctionConceptCode, items, isElectronic, etc.). */
  dto: CreateSalesNoteDto;
  /** TypeORM EntityManager scoped to the current transaction (for persist operations). */
  queryRunner: EntityManager;
  /** Factus gateway instance (only provided for electronic note flows). */
  factusGateway?: IFactusInvoicingGateway;
}

/**
 * Strategy interface implemented by all scenario handlers.
 *
 * Each handler encapsulates the business rules for one DIAN correction concept:
 * - Validates the DTO items and invoice state
 * - Computes proportional taxes using the shared tax-recalculator utility
 * - Restores inventory when applicable (Scenarios A, D)
 * - Builds electronic Factus payload items when applicable
 * - Returns a ScenarioResult for the caller to persist
 */
export interface ScenarioHandler {
  /** Execute the scenario's business logic and return the result for persistence. */
  execute(params: ScenarioParams): Promise<ScenarioResult>;
  /** Returns 'credit' for credit note handlers or 'debit' for debit note handlers. */
  getType(): 'credit' | 'debit';
}

/** Factory interface for looking up the correct handler by correction concept code. */
export interface ScenarioHandlerFactory {
  getHandler(correctionConceptCode: string): ScenarioHandler;
  register(code: string, handler: ScenarioHandler): void;
}

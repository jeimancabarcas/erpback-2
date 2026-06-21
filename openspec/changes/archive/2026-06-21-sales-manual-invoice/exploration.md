# Exploration: Manual (Non-Electronic) Sales Invoice

**Change:** `sales-manual-invoice`
**Date:** 2026-06-21
**Scope:** Backend (NestJS/TypeORM) + Frontend (Angular)

---

## 1. Current Sales Flow Architecture

### End-to-End Flow (as it exists today)

```
Frontend SaleFormComponent
  → InvoiceService.createInvoice(dto: CreateInvoiceDto)    [POST /sales/invoices]
      → SalesController.create(dto)
          → SalesService.create(dto)
              ├─ 1. Load customer from DB
              ├─ 2. For each item:
              │     ├─ Load product from DB
              │     ├─ InventoryService.consumeStock()    ← reduces stock immediately
              │     └─ Build factusItems[] array
              ├─ 3. Build factusPayload + call FactusGateway.createInvoice()  ← DIAN submission
              │     └─ On error: throw BadRequestException (rolls back entire TX)
              └─ 4. Persist Invoice + InvoiceItems to DB (inside transaction)
```

The Factus call (step 3) happens **synchronously inside the DB transaction** (`queryRunner`). If Factus fails, the entire transaction rolls back — inventory is NOT consumed and no local record is created.

---

## 2. Backend — Sales Module

### File locations

| File | Path |
|------|------|
| Invoice entity | `src/modules/sales/entities/invoice.entity.ts` |
| InvoiceItem entity | `src/modules/sales/entities/invoice-item.entity.ts` |
| CreditNote entity | `src/modules/sales/entities/credit-note.entity.ts` |
| DebitNote entity | `src/modules/sales/entities/debit-note.entity.ts` |
| SalesService | `src/modules/sales/sales.service.ts` |
| SalesController | `src/modules/sales/sales.controller.ts` |
| SalesModule | `src/modules/sales/sales.module.ts` |
| CreateInvoiceDto | `src/modules/sales/dto/create-invoice.dto.ts` |

### Invoice entity — current fields (`invoices` table)

```typescript
// src/modules/sales/entities/invoice.entity.ts

export enum InvoiceStatus {
  DRAFT      = 'DRAFT',
  PAID       = 'PAID',
  CANCELLED  = 'CANCELLED',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceNumber: string;         // Set to Factus number (e.g. SETP990003678) or local fallback

  @Column({ type: 'timestamp' })
  date: Date;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_id' })
  customerId: string;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @OneToMany(() => CreditNote, (cn) => cn.invoice)
  creditNotes: CreditNote[];

  @OneToMany(() => DebitNote, (dn) => dn.invoice)
  debitNotes: DebitNote[];

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Critical finding:** There is **NO** `isElectronic`, `saleType`, `invoiceType`, or any discriminator field on the Invoice entity. Every invoice today is implicitly electronic.

### InvoiceItem entity — current fields (`invoice_items` table)

```typescript
@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'invoice_id' }) invoiceId: string;
  @ManyToOne(() => Invoice) invoice: Invoice;
  @Column() productId: string;
  @ManyToOne(() => Product) product: Product;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) quantity: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) unitPrice: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) purchasePrice: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) subtotal: number;
}
```

### CreateInvoiceDto — current fields

```typescript
// src/modules/sales/dto/create-invoice.dto.ts

class CreateInvoiceItemDto {
  @IsNotEmpty() productId: string;
  @IsNotEmpty() quantity: number;
  // unitPrice optional — falls back to product.sellingPrice if not sent
}

class CreateInvoiceDto {
  @IsNotEmpty() customerId: string;
  date?: Date;
  notes?: string;
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
```

**Critical finding:** No `isElectronic` or `type` field in the DTO either. Everything is electronic by default.

---

## 3. The Factus Integration Boundary

### Exact call chain

**File:** `src/modules/sales/sales.service.ts`, lines ~131–163

```typescript
// Step 3 inside SalesService.create() transaction:

// 3a. Build payload
const factusPayload = {
  referenceCode,
  paymentDetails: [{ paymentForm: '1', paymentMethodCode: '10', amount: ... }],
  customer: this.mapCustomerToFactus(customer),
  items: factusItems,
};

// 3b. Submit to DIAN via Factus
let invoiceNumber = `FAC-${(count + 1).toString().padStart(4, '0')}`;
try {
  const factusResponse = await this.factusGateway.createInvoice(factusPayload);  // ← THE CALL
  if (factusResponse?.data?.number) {
    invoiceNumber = factusResponse.data.number;   // e.g. SETP990003678
  }
} catch (error) {
  throw new BadRequestException(`Error al emitir Factura en Factus: ${error.message}`);
  // ↑ This propagates to the outer catch → rollbackTransaction()
}
```

**Gateway interface:** `src/modules/factus/interfaces/factus-invoicing-gateway.interface.ts`
**HTTP adapter:** `src/modules/factus/adapters/factus-http-invoicing.adapter.ts` — class `FactusHttpInvoicingAdapter`
**Injection token:** `'IFactusInvoicingGateway'` (injected into SalesService via `@Inject`)
**Registered in:** `src/modules/factus/factus.module.ts` exports `FactusHttpInvoicingAdapter`; `src/modules/sales/sales.module.ts` imports `FactusModule`

**To bypass:** wrap the `this.factusGateway.createInvoice(factusPayload)` block in an `if (!isManual)` guard. When `isManual === true`, skip it and use a local sequential number (e.g. `MAN-${count + 1}`).

---

## 4. Inventory — Stock Reduction

### Method: `InventoryService.consumeStock()`

**File:** `src/modules/inventory/inventory.service.ts`

```typescript
async consumeStock(
  productId: string,
  quantity: number,
  manager?: EntityManager,   // receives the transaction manager from SalesService
): Promise<number> {         // returns totalCost (for FIFO purchasePrice calc)
  // 1. Validates product exists
  // 2. Checks product.currentStock >= quantity → throws if insufficient
  // 3. Decrements product.currentStock and saves
  // 4. FIFO batch depletion: iterates InventoryBatch (oldest first), depletes batches
  // 5. Recalculates averagePrice
  // Returns: total cost of consumed stock
}
```

**Called from:** `SalesService.create()` at line ~94, inside the `queryRunner` transaction:
```typescript
const totalItemCost = await this.inventoryService.consumeStock(
  item.productId,
  item.quantity,
  queryRunner.manager,         // ← participates in same DB transaction
);
```

**Key detail:** `consumeStock` runs **before** the Factus call (step 2 vs step 3). If Factus fails and the transaction rolls back, the stock deduction is reversed too. This is safe. For manual invoices, inventory consumption stays unchanged — we still call `consumeStock()` the same way.

---

## 5. Frontend — Sales Module

### Key files

| File | Path |
|------|------|
| Sales page (list + open dialog) | `src/app/components/pages/sales-page/sales-page.component.ts` |
| Sale form (dialog, creates invoice) | `src/app/components/molecules/sale-form/sale-form.component.ts` |
| Frontend InvoiceService | `src/app/services/invoice.service.ts` |
| Invoice model / DTO | `src/app/models/invoice.model.ts` |

### SaleFormComponent — current fields

The form (inline template, 756 lines) exposes:
- **Customer** — autocomplete with lazy search/load more
- **Products** — autocomplete search → add to items table
- **Quantity** per item — capped at `product.currentStock`
- **Unit price** per item — editable inline, references selling price, average price
- **Notes** — not visible in template scan (may be in form group)
- **No toggle or type selector** for electronic vs. manual — does not exist yet.

### Submit method — `onSubmit()` in SaleFormComponent

```typescript
// Builds CreateInvoiceDto and calls:
this.invoiceService.createInvoice(dto).subscribe({ ... })
```

**Frontend invoice model — `CreateInvoiceDto`:**
```typescript
// src/app/models/invoice.model.ts
interface CreateInvoiceDto {
  customerId: string;
  date?: Date;
  notes?: string;
  items: { productId: string; quantity: number; unitPrice?: number }[];
}
```

No `isElectronic` or `type` field exists in the frontend DTO.

---

## 6. What Already Exists vs. What Needs to Be Added

### Already exists — nothing needs to change

- Inventory reduction via `consumeStock()` — works for manual invoices as-is.
- Transaction management with rollback — reusable.
- `invoiceNumber` generation fallback (`FAC-xxxx`) — can be adapted for manual.
- Customer and product loading logic — unchanged.

### Needs to be added

#### Backend

1. **`Invoice` entity — add discriminator column:**
   ```typescript
   @Column({ name: 'is_electronic', default: true })
   isElectronic: boolean;
   ```
   Or alternatively an enum:
   ```typescript
   export enum InvoiceType { ELECTRONIC = 'ELECTRONIC', MANUAL = 'MANUAL' }
   @Column({ type: 'enum', enum: InvoiceType, default: InvoiceType.ELECTRONIC })
   invoiceType: InvoiceType;
   ```
   **Recommendation:** boolean `isElectronic` is simpler; the enum is more extensible. Use enum.

2. **`CreateInvoiceDto` — add optional field:**
   ```typescript
   @IsOptional()
   @IsBoolean()
   isElectronic?: boolean;  // defaults to true for backward compatibility
   ```

3. **`SalesService.create()` — gate the Factus call:**
   ```typescript
   if (isElectronic !== false) {
     // existing Factus block (lines ~131–163)
   } else {
     invoiceNumber = `MAN-${(count + 1).toString().padStart(4, '0')}`;
   }
   ```
   The `inventoryService.consumeStock()` call stays unconditional.

4. **Database migration** — add `is_electronic` / `invoice_type` column to `invoices` table with a default value so existing records are not broken.

5. **`invoiceNumber` uniqueness** — the `invoices.invoiceNumber` column has a `UNIQUE` constraint. Manual numbers (`MAN-xxxx`) must use a sequence that doesn't collide with `FAC-xxxx` or DIAN numbers. Consider prefixing and scoping the count to invoice type.

#### Frontend

1. **`CreateInvoiceDto` model** — add `isElectronic?: boolean` field.

2. **`SaleFormComponent`** — add a toggle or segmented control for "Electrónica / Manual". When Manual is selected, show a subtle warning that the invoice won't be sent to DIAN.

3. **`InvoiceService.createInvoice()`** — pass `isElectronic` through the DTO.

4. **Invoice list display** — consider showing a badge ("MANUAL" / "ELECTRÓNICA") in the sales page table to distinguish invoice types.

---

## 7. Risk Areas and Edge Cases

### CRITICAL

1. **`invoiceNumber` UNIQUE collision risk** — The current `count`-based numbering (`FAC-${count+1}`) counts ALL invoices (electronic + manual). If manual invoices use `MAN-${count+1}`, two invoices created simultaneously could race. Consider a DB sequence per type or a more robust generator.

2. **Factus call is synchronous inside the DB transaction** — The current architecture means Factus failure = rollback. For manual invoices this coupling is bypassed entirely, but care must be taken not to introduce the Factus call in any conditional path where the transaction could partially commit.

3. **Database migration required** — Adding the `isElectronic` / `invoiceType` column needs a TypeORM migration with a non-null default so the `invoices` table constraint does not break existing rows.

### WARNING

4. **Credit notes and debit notes always call Factus** — `SalesService.createCreditNote()` and `SalesService.createDebitNote()` also call `this.factusGateway.createCreditNote/DebitNote()` unconditionally. If a manual invoice is created and the user later tries to issue a credit/debit note on it, the system will attempt a Factus call for a non-existent DIAN invoice. This is a related edge case that must be guarded in the notes methods too.

5. **`municipalities` hardcoded to sandbox default** — `mapCustomerToFactus()` hardcodes `municipalityCode: '68679'` (sandbox). For manual invoices this code is never called, which is fine — but this is a latent bug for electronic invoices in production.

6. **Frontend stock cap** — `SaleFormComponent` caps quantity at `selectedProduct().currentStock`, which is correct for both electronic and manual modes.

7. **No `isElectronic` field on the QueryInvoicesDto** — Filtering invoices by type (manual vs. electronic) will require adding a filter field to `QueryInvoicesDto` and updating `findAll()` in `SalesService`.

---

## 8. Summary Architecture Diagram

```
                    ┌─────────────────────────────┐
                    │    SaleFormComponent         │
                    │  + isElectronic toggle [NEW] │
                    └────────────┬────────────────┘
                                 │ POST /sales/invoices
                                 │ { ...dto, isElectronic: false }
                    ┌────────────▼────────────────┐
                    │   SalesController.create()   │
                    └────────────┬────────────────┘
                                 │
                     ┌───────────▼────────────────┐
                     │    SalesService.create()     │
                     │                             │
                     │  ┌─ consumeStock() ─────┐  │
                     │  │  always runs          │  │
                     │  └───────────────────────┘  │
                     │                             │
                     │  if (isElectronic !== false) │
                     │  ┌─ factusGateway ───────┐  │  → Factus API → DIAN
                     │  │  createInvoice()       │  │
                     │  └───────────────────────┘  │
                     │  else                        │
                     │  ┌─ local number ────────┐  │
                     │  │  MAN-xxxx             │  │
                     │  └───────────────────────┘  │
                     │                             │
                     │  → persist Invoice to DB    │
                     └─────────────────────────────┘
```

---

## 9. Key File Reference

| Concern | File | Key Lines |
|---------|------|-----------|
| Invoice entity (no discriminator yet) | `erpbackend/src/modules/sales/entities/invoice.entity.ts` | entire file |
| SalesService.create() full method | `erpbackend/src/modules/sales/sales.service.ts` | 51–185 |
| Factus call (exact integration point) | `erpbackend/src/modules/sales/sales.service.ts` | 131–163 |
| consumeStock (inventory reduction) | `erpbackend/src/modules/inventory/inventory.service.ts` | `async consumeStock()` method |
| Factus HTTP adapter | `erpbackend/src/modules/factus/adapters/factus-http-invoicing.adapter.ts` | `createInvoice()` |
| Factus gateway interface | `erpbackend/src/modules/factus/interfaces/factus-invoicing-gateway.interface.ts` | `IFactusInvoicingGateway` |
| CreateInvoiceDto (no type field) | `erpbackend/src/modules/sales/dto/create-invoice.dto.ts` | entire file |
| SaleFormComponent (form + submit) | `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.ts` | 700–756 |
| Frontend Invoice model/DTO | `erpfrontend/src/app/models/invoice.model.ts` | `CreateInvoiceDto` interface |
| Frontend InvoiceService | `erpfrontend/src/app/services/invoice.service.ts` | `createInvoice()` |
| mapCustomerToFactus (private helper) | `erpbackend/src/modules/sales/sales.service.ts` | after line ~185 |
| Credit/debit note Factus coupling | `erpbackend/src/modules/sales/sales.service.ts` | `createCreditNote()`, `createDebitNote()` |

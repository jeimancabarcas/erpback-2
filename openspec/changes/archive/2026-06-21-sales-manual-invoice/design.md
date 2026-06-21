# Design: sales-manual-invoice

## Architecture Overview

The change introduces a boolean discriminator `isElectronic` on the `Invoice` entity. When `false`, the `SalesService.create()` skips the Factus/DIAN submission block and assigns a local sequential number (`MAN-XXXXXXXX`). Inventory reduction (`consumeStock`) always runs unconditionally. Credit and debit note endpoints guard against manual-invoice parents. The frontend adds a slide-toggle to `SaleFormComponent` and a `MANUAL` badge in `SalesPageComponent`.

```
SaleFormComponent (isManual toggle)
  │  POST /sales/invoices { ...dto, isElectronic: false }
  │
  ▼
SalesController.create(dto: CreateInvoiceDto)
  │
  ▼
SalesService.create()
  ├─ consumeStock()          ← always runs (unchanged)
  ├─ if (isElectronic !== false)
  │    └─ factusGateway.createInvoice()  → DIAN/Factus
  │         invoiceNumber = factusResponse.data.number   (e.g. SETP990003678)
  └─ else
       └─ SELECT COUNT(*) WHERE is_electronic = false
            invoiceNumber = MAN-${(manualCount+1).padStart(8,'0')}
  └─ invoice.isElectronic = dto.isElectronic ?? true
  └─ persist Invoice → DB

SalesService.createCreditNote() / createDebitNote()
  └─ load parent invoice → if (!invoice.isElectronic) throw BadRequestException
```

---

## Backend Changes

### `erpbackend/src/modules/sales/entities/invoice.entity.ts`

Add a single boolean column after `status`:

```typescript
// BEFORE — line ~88 (after status column)
@Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
status: InvoiceStatus;

// AFTER
@Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
status: InvoiceStatus;

@Column({ name: 'is_electronic', default: true })
isElectronic: boolean;
```

No import changes required — `@Column` is already imported.

---

### `erpbackend/src/modules/sales/dto/create-invoice.dto.ts`

Add `isElectronic` as an optional boolean field. Import `IsBoolean` from `class-validator`.

```typescript
// BEFORE
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

// AFTER
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
```

```typescript
// BEFORE (end of CreateInvoiceDto)
  @IsString()
  @IsOptional()
  notes?: string;
}

// AFTER
  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isElectronic?: boolean;
}
```

---

### `erpbackend/src/modules/sales/sales.service.ts`

#### Change 1 — `create()`: invoice number branching + Factus gate

Current code (lines ~131–163):

```typescript
// 3. Generar referencia y llamar Factus API sincrónicamente
const count = await this.invoiceRepository.count();
const referenceCode = `FAC-REF-${(count + 1).toString().padStart(4, '0')}-${Date.now()}`;

const factusPayload = { ... };

let invoiceNumber = `FAC-${(count + 1).toString().padStart(4, '0')}`;
try {
  const factusResponse = await this.factusGateway.createInvoice(factusPayload);
  if (factusResponse && factusResponse.data && factusResponse.data.number) {
    invoiceNumber = factusResponse.data.number;
  }
} catch (error) {
  throw new BadRequestException(`Error al emitir Factura en Factus: ${error.message}`);
}
```

Replace with:

```typescript
// 3. Generar número de factura y (si es electrónica) llamar Factus API
const count = await this.invoiceRepository.count();
const isElectronic = dto.isElectronic !== false;

let invoiceNumber: string;

if (!isElectronic) {
  const manualCount = await this.invoiceRepository.count({
    where: { isElectronic: false },
  });
  invoiceNumber = `MAN-${(manualCount + 1).toString().padStart(8, '0')}`;
} else {
  const referenceCode = `FAC-REF-${(count + 1).toString().padStart(4, '0')}-${Date.now()}`;

  const factusPayload = {
    referenceCode,
    paymentDetails: [
      {
        paymentForm: '1',
        paymentMethodCode: '10',
        amount: factusTotalAmount.toFixed(2),
      },
    ],
    customer: this.mapCustomerToFactus(customer),
    items: factusItems,
  };

  invoiceNumber = `FAC-${(count + 1).toString().padStart(4, '0')}`;
  try {
    const factusResponse = await this.factusGateway.createInvoice(factusPayload);
    if (factusResponse && factusResponse.data && factusResponse.data.number) {
      invoiceNumber = factusResponse.data.number;
    }
  } catch (error) {
    throw new BadRequestException(`Error al emitir Factura en Factus: ${error.message}`);
  }
}
```

#### Change 2 — `create()`: set `isElectronic` on the entity before persist

Current code (lines ~166–173):

```typescript
// 4. Crear la factura local
const invoice = this.invoiceRepository.create({
  ...invoiceData,
  date: invoiceData.date || new Date(),
  invoiceNumber,
  totalAmount,
  status: InvoiceStatus.PAID,
  items: invoiceItems,
});
```

Replace with:

```typescript
// 4. Crear la factura local
const invoice = this.invoiceRepository.create({
  ...invoiceData,
  date: invoiceData.date || new Date(),
  invoiceNumber,
  totalAmount,
  status: InvoiceStatus.PAID,
  isElectronic: dto.isElectronic ?? true,
  items: invoiceItems,
});
```

#### Change 3 — `createCreditNote()`: guard manual invoice at entry

Current code (start of `createCreditNote()`, around line ~305–316):

```typescript
async createCreditNote(invoiceId: string, dto: CreateSalesNoteDto): Promise<CreditNote> {
  const invoice = await this.invoiceRepository.findOne({
    where: { id: invoiceId },
    relations: ['customer', 'items', 'items.product'],
  });

  if (!invoice) {
    throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
  }
  // ... item building starts
```

Add the manual invoice guard immediately after the `NotFoundException` check:

```typescript
  if (!invoice) {
    throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
  }

  if (!invoice.isElectronic) {
    throw new BadRequestException(
      'No se pueden crear notas de crédito para facturas manuales',
    );
  }
```

#### Change 4 — `createDebitNote()`: same guard

Current code (start of `createDebitNote()`, around line ~489–499):

```typescript
async createDebitNote(invoiceId: string, dto: CreateSalesNoteDto): Promise<DebitNote> {
  const invoice = await this.invoiceRepository.findOne({
    where: { id: invoiceId },
    relations: ['customer', 'items', 'items.product'],
  });

  if (!invoice) {
    throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
  }
  // ... item building starts
```

Add the manual invoice guard immediately after the `NotFoundException` check:

```typescript
  if (!invoice) {
    throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
  }

  if (!invoice.isElectronic) {
    throw new BadRequestException(
      'No se pueden crear notas de débito para facturas manuales',
    );
  }
```

#### Note on `findAll()` — no change needed

`findAll()` uses `findAndCount()` with full entity relations. Since `isElectronic` is now a mapped column on the entity, TypeORM will include it in all SELECT results automatically. No code change is required.

---

## Migration

### File: `erpbackend/src/database/migrations/1750000000000-AddIsElectronicToInvoice.ts`

Use the timestamp `1750000000000` (replace with `Date.now()` output at creation time, e.g. `npx typeorm migration:create`). If no migrations directory exists yet, create `src/database/migrations/`.

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsElectronicToInvoice1750000000000 implements MigrationInterface {
  name = 'AddIsElectronicToInvoice1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD COLUMN "is_electronic" BOOLEAN NOT NULL DEFAULT TRUE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN "is_electronic"`,
    );
  }
}
```

**Key constraint:** `NOT NULL DEFAULT TRUE` ensures all existing rows are treated as electronic without requiring a data backfill. The column is safe to add without downtime on a small table.

---

## Frontend Changes

### `erpfrontend/src/app/models/invoice.model.ts`

#### Change 1 — `Invoice` interface: add `isElectronic`

```typescript
// BEFORE
export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customer?: Customer;
  totalAmount: number;
  status: InvoiceStatus;
  // ...
}

// AFTER — add the field
export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customer?: Customer;
  totalAmount: number;
  status: InvoiceStatus;
  isElectronic?: boolean;
  // ...
}
```

#### Change 2 — `CreateInvoiceDto` interface: add `isElectronic`

```typescript
// BEFORE
export interface CreateInvoiceDto {
  customerId: string;
  date?: Date;
  notes?: string;
  items: { productId: string; quantity: number; unitPrice?: number }[];
}

// AFTER
export interface CreateInvoiceDto {
  customerId: string;
  date?: Date;
  notes?: string;
  items: { productId: string; quantity: number; unitPrice?: number }[];
  isElectronic?: boolean;
}
```

---

### `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.ts`

#### Change 1 — Add `isManual` signal in the component class

In the component class body, alongside the other `signal()` declarations:

```typescript
// Add after existing signals (e.g. after selectedCustomer, selectedProduct signals)
isManual = signal(false);
```

#### Change 2 — Add toggle in the template

Locate the `<form [formGroup]="saleForm" (ngSubmit)="onSubmit()">` area. Add the toggle block as the **first child** inside the form, above the customer autocomplete section:

```html
<!-- Manual invoice toggle -->
<div class="flex items-center gap-4 px-1">
  <mat-slide-toggle
    [checked]="isManual()"
    (change)="isManual.set($event.checked)"
    color="warn"
  >
    <span class="text-sm font-semibold text-gray-700">Venta manual</span>
  </mat-slide-toggle>
</div>

@if (isManual()) {
  <div class="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
    <mat-icon class="text-amber-500 mt-0.5 text-[18px]">warning_amber</mat-icon>
    <p class="text-xs text-amber-700 leading-relaxed">
      Esta venta <strong>no será enviada a la DIAN</strong>. Se asignará un número
      interno (MAN-XXXXXXXX) y no tendrá validez fiscal electrónica.
    </p>
  </div>
}
```

`MatSlideToggleModule` must be imported in the component's `imports` array (it uses standalone components).

#### Change 3 — Include `isElectronic` in `onSubmit()`

Current `onSubmit()` (line ~716):

```typescript
onSubmit() {
  // ... validation ...
  const dto: CreateInvoiceDto = {
    customerId: ...,
    date: ...,
    notes: ...,
    items: ...,
  };
  this.invoiceService.createInvoice(dto).subscribe({ ... });
}
```

After the change:

```typescript
onSubmit() {
  // ... validation ...
  const dto: CreateInvoiceDto = {
    customerId: ...,
    date: ...,
    notes: ...,
    items: ...,
    isElectronic: !this.isManual(),
  };
  this.invoiceService.createInvoice(dto).subscribe({ ... });
}
```

#### Change 4 — Reset `isManual` on successful submit

In the success callback of `createInvoice().subscribe()`, add:

```typescript
this.isManual.set(false);
```

---

### `erpfrontend/src/app/components/pages/sales-page/sales-page.component.ts`

#### Change 1 — Add `MANUAL` badge in the invoice number column

Locate the `matColumnDef="invoiceNumber"` cell. Add the badge inline after the invoice number text:

```html
<!-- BEFORE -->
<ng-container matColumnDef="invoiceNumber">
  <th mat-header-cell *matHeaderCellDef ...>...</th>
  <td mat-cell *matCellDef="let inv" ...>
    <span class="font-mono text-xs ...">{{ inv.invoiceNumber }}</span>
  </td>
</ng-container>

<!-- AFTER -->
<ng-container matColumnDef="invoiceNumber">
  <th mat-header-cell *matHeaderCellDef ...>...</th>
  <td mat-cell *matCellDef="let inv" ...>
    <div class="flex items-center gap-2">
      <span class="font-mono text-xs ...">{{ inv.invoiceNumber }}</span>
      @if (inv.isElectronic === false) {
        <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">
          MANUAL
        </span>
      }
    </div>
  </td>
</ng-container>
```

#### Change 2 — PDF button (no change needed)

The exploration confirms there is **no PDF button in the list view** — the actions column contains only a `visibility` icon button that opens the detail dialog. No change is required here. If a PDF download button is added to the detail dialog in the future, it should be wrapped with `@if (inv.isElectronic)` at that time.

---

## Migration Strategy

### Execution order

1. Run migration (`up`) — adds `is_electronic BOOLEAN NOT NULL DEFAULT TRUE`.
2. Deploy backend — entity picks up the new column; `findAll()` returns `isElectronic: true` for all existing invoices.
3. Deploy frontend — toggle appears; `isElectronic: false` can now be sent.

### Rollback

1. Revert frontend deploy.
2. Run migration `down` — `DROP COLUMN is_electronic`.
3. Revert backend deploy.

No data backfill is required because all pre-existing rows get `DEFAULT TRUE` from the migration.

### TypeORM `synchronize` warning

If `synchronize: true` is active in development, TypeORM will add the column automatically on startup. The migration is still required for staging/production where `synchronize` must be `false`.

---

## Testing Strategy

### Backend — `SalesService` unit tests

| Scenario | What to assert |
|---|---|
| `create()` with `isElectronic: true` (default) | `factusGateway.createInvoice` is called; returned `invoiceNumber` comes from Factus response |
| `create()` with `isElectronic: false` | `factusGateway.createInvoice` is NOT called; `invoiceNumber` matches `MAN-00000001` pattern; `invoice.isElectronic === false` |
| `create()` with `isElectronic` omitted | treated as `true`; Factus is called |
| `create()` sequential manual invoices | second manual invoice gets `MAN-00000002` (scoped count via `where: { isElectronic: false }`) |
| `createCreditNote()` on manual invoice | throws `BadRequestException` with message containing "manuales" |
| `createDebitNote()` on manual invoice | throws `BadRequestException` with message containing "manuales" |
| `createCreditNote()` on electronic invoice | proceeds normally (existing behavior unchanged) |

Mocks needed: `invoiceRepository.count` (returns separate values for total count and `where: { isElectronic: false }` count), `factusGateway.createInvoice`.

### Frontend — `SaleFormComponent` unit tests

| Scenario | What to assert |
|---|---|
| Toggle starts as `false` (isManual = false) | Warning block is not rendered; submit sends `isElectronic: true` |
| User toggles to `true` | Amber warning block is visible |
| Submit with toggle on | DTO includes `isElectronic: false` |
| Submit with toggle off | DTO includes `isElectronic: true` |
| Successful submit resets toggle | `isManual()` returns `false` after observable success callback |

### Frontend — `SalesPageComponent` unit tests

| Scenario | What to assert |
|---|---|
| Invoice with `isElectronic: false` | MANUAL badge is rendered in invoiceNumber cell |
| Invoice with `isElectronic: true` | MANUAL badge is NOT rendered |
| Invoice with `isElectronic` undefined | MANUAL badge is NOT rendered (falsy guard: `=== false`) |

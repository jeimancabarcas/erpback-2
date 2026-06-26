# Design: Payment Method & Type on Sales Invoices

## Technical Approach

Wire the existing `PaymentMethod` (6 DIAN codes) and `PaymentType` (2 codes) entities into invoice creation. Add nullable FKs to `Invoice`, optional UUIDs to `CreateInvoiceDto`, inject `SettingsModule` into `SalesModule`, and replace 4 hardcoded `paymentForm: '1'` / `paymentMethodCode: '10'` sites with a private helper `resolvePaymentConfig()` that resolves from FK or falls back to defaults.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Entity FK pattern** eager vs explicit relations | Eager: tiny ref tables (6 & 2 rows), no need to audit every `find*`. Explicit: consistent with customer relation. | **Eager** — negligible overhead, avoids missing a query site |
| **Default resolution** findByCode vs findOne + hardcode | findByCode is resilient to seed changes. Hardcoding falls apart if seed order changes. | **Add `findByCode(code)`** to both payment services |
| **Module wiring** direct TypeOrm vs SettingsModule | Direct adds duplicate providers. SettingsModule reuses existing singletons. | **Import SettingsModule** — follows established pattern (TaxesService already imported) |

## Data Flow

```
CreateInvoiceDto
  ├── paymentMethodId?: UUID
  └── paymentTypeId?: UUID
            │
            ▼
   SalesService.create()
     ├── Invoice saved with FK columns
     └── resolvePaymentConfig(id?, id?)
              │
              ├── PaymentMethodsService.findByCode('10') ← fallback
              ├── PaymentTypesService.findByCode('1')    ← fallback
              │
              ▼
          { paymentMethodCode, paymentFormCode }
              │
              ▼
          Factus payload (4 sites)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/modules/sales/entities/invoice.entity.ts` | Modify | +2 `@ManyToOne` + `@JoinColumn` + 2 `@Column` for FKs |
| `src/modules/sales/dto/create-invoice.dto.ts` | Modify | +2 `@IsOptional() @IsUUID()` fields |
| `src/modules/sales/sales.module.ts` | Modify | Import `SettingsModule`; add `PaymentMethod`, `PaymentType` to `TypeOrmModule.forFeature` |
| `src/modules/sales/sales.service.ts` | Modify | Inject 2 services; add `resolvePaymentConfig`; replace 4 hardcode sites |
| `src/modules/settings/services/payment-methods.service.ts` | Modify | Add `findByCode(code: string): Promise<PaymentMethod>` |
| `src/modules/settings/services/payment-types.service.ts` | Modify | Add `findByCode(code: string): Promise<PaymentType>` |

## Interfaces / Contracts

```typescript
// Add to PaymentMethodsService & PaymentTypesService:
async findByCode(code: string): Promise<PaymentMethod> {
  const entity = await this.repo.findOne({ where: { code } });
  if (!entity) throw new NotFoundException(`... código ${code} no encontrado`);
  return entity;
}
```

```typescript
// Invoice entity — follows existing customer pattern:
@ManyToOne(() => PaymentMethod, { nullable: true, eager: true })
@JoinColumn({ name: 'payment_method_id' })
paymentMethod?: PaymentMethod;

@Column({ name: 'payment_method_id', nullable: true })
paymentMethodId?: string;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `resolvePaymentConfig` with ID, without ID, invalid ID | Mock both services; assert fallback codes |
| Unit | DTO validation — valid UUIDs pass, invalid UUIDs fail | `ValidationPipe` + `TestingModule` |
| Integration | Invoice creation stores payment IDs | Create invoice with/without IDs; assert DB columns |
| Unit | 4 Factus payload sites emit dynamic codes | Stub `resolvePaymentConfig`; assert `paymentForm`/`paymentMethodCode` match expected |

## Migration / Rollout

No migration — TypeORM `synchronize` or explicit migration to add 2 nullable FK columns. Existing invoices keep NULLs, fallback defaults apply at Factus payload time.

## Open Questions

- None — all dependencies confirmed in existing codebase.

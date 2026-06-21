# Design: Paginated Customer Selection

## Technical Approach
Implement backend search and query logic to support fuzzy matching and filtering. Update the frontend invoice form to use a debounced, paginated autocomplete dropdown, allowing creation of new customers inline via a dialog popup without losing form state.

## Architecture Decisions

### Decision: Active Status Filter Mapping
| Option | Tradeoff | Decision |
|---|---|---|
| Query with `isActive: true` | Requires database migration and model change. | Rejected |
| Query with `status: CustomerStatus.ACTIVE` | Reuses existing `status` column and enum without database schema changes. | **Selected** |

### Decision: Autocomplete Dropdown State Isolation
| Option | Tradeoff | Decision |
|---|---|---|
| Use global service signals (`customers`) | Overwrites global customer state, causing display bugs on other screens. | Rejected |
| Use local signals in `SaleFormMolecule` | Keeps pagination state isolated, preventing global state pollution. | **Selected** |

### Decision: Selection of Newly Created Customer
| Option | Tradeoff | Decision |
|---|---|---|
| Return `Customer` from Dialog | Cleanest approach, but requires modifying the dialog component. | Option A |
| Fall back to `customers()[0]` | Zero-risk fallback since the service automatically prepends the new record. | Option B (**Hybrid Fallback**) |

## Data Flow
```
User Types ──→ Debounce (300ms) ──→ API (Search Term, Active Status, Page)
                    │
                    └─→ Append results (Page > 1) or Replace results (Page = 1)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `erpbackend/src/modules/customers/dto/query-customers.dto.ts` | Modify | Add optional `search?: string` parameter. |
| `erpbackend/src/modules/customers/customers.service.ts` | Modify | Handle `search` in `findAll` using `ILike` with OR name/documentNumber filter and `status = ACTIVE`. |
| `erpfrontend/src/app/components/molecules/sale-form/sale-form.component.ts` | Modify | Replace `<mat-select>` with `<mat-autocomplete>`, implement search FormControl, local pagination state, and dialog hook. |

## Interfaces / Contracts

### QueryCustomersDto Updates
```typescript
export class QueryCustomersDto extends PaginationDto {
  // ... existing fields
  @IsOptional()
  @IsString()
  search?: string;
}
```

### Component State Properties
```typescript
customersList = signal<Customer[]>([]);
currentPage = 1;
hasMore = signal(false);
currentSearchTerm = '';
isLoadingCustomers = signal(false);
customerSearchControl = new FormControl<string | Customer>('');
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (Backend) | `findAll()` search and filtering | Verify OR logic for `name` and `documentNumber`, and exclusion of inactive customers. |
| Integration (Frontend) | Autocomplete behavior | Verify debouncing (300ms), pagination append, and dropdown preservation on "Cargar más". |
| E2E | Inline creation workflow | Test creating a customer and verifying automatic selection in the invoice form. |

## Migration / Rollout
No database migration required. The `search` query parameter is backward-compatible.

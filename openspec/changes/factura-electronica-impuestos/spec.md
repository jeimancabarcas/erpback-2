# Spec: Factura Electrónica — Impuestos de Producto

Two domains: new `electronic-invoice-taxes` (full) + delta for `sales-manual-invoice`.

---

# electronic-invoice-taxes (NEW)

## Purpose

Replace hardcoded IVA 19% in Factus with per-product taxes. Persist tax breakdown per item.

## ADDED Requirements

### Requirement: InvoiceItemTax Entity

New `InvoiceItemTax` entity (table `invoice_item_taxes`): `id` (UUID PK), `invoiceItemId` (FK, CASCADE), `taxId` (nullable FK), `taxCode` (varchar 10), `taxRate` (decimal 5,2), `taxAmount` (decimal 12,2). `InvoiceItem` gains `taxAmount` — sum of its child tax records.

- **Persisted**: GIVEN a product with IVA 19%, WHEN electronic invoice is created, THEN one `InvoiceItemTax` per tax is persisted
- **Cascade**: GIVEN item with tax records, WHEN item is deleted, THEN child records are cascade-deleted
- **Untaxed**: GIVEN untaxed product, WHEN electronic invoice is created, THEN no `InvoiceItemTax` records are created for that item

### Requirement: Tax Calculation

`priceBeforeTax = unitPrice / (1 + sum(rate)/100)`. Per-tax amount: `priceBeforeTax * (rate/100)`. `InvoiceItem.taxAmount` = sum of per-tax amounts.

- **Single**: GIVEN `unitPrice=119000`, `rate=19%`, THEN `priceBeforeTax=100000`, `taxAmount=19000`
- **Multi**: GIVEN `unitPrice=123000`, `rate=19%+4%`, THEN `priceBeforeTax=100000`, IVA=19000, INC=4000, total=23000

### Requirement: Factus Payload — Dynamic Taxes

`create()` MUST load `product.taxes`. Each tax → `{ code: tax.code, rate: tax.percentage.toFixed(2), isExcluded: false }`. If product has no taxes, `FactusItem.taxes` is omitted/empty. Factus `price` = `priceBeforeTax`.

- **Taxed**: GIVEN product with IVA 19%, WHEN electronic `create()`, THEN Factus gets `{ code:'01', rate:'19.00' }` and `price: priceBeforeTax`
- **Multi-tax**: GIVEN product with IVA+INC, THEN Factus taxes has two entries
- **Untaxed**: GIVEN product without taxes, THEN Factus item has NO taxes array

### Requirement: Emit — Dynamic Tax

`emit()` MUST load `items.product.taxes` and apply same calculation as `create()`.

- **Emit taxed**: GIVEN manual invoice with taxed products, WHEN `emit()`, THEN Factus has per-product tax codes

### Requirement: Manual Invoice — No Tax

Non-electronic invoices MUST NOT trigger Factus or tax persistence.

- **Manual skip**: GIVEN `isElectronic: false`, WHEN `create()`, THEN no Factus call, no `InvoiceItemTax` records

---

# sales-manual-invoice (DELTA)

## MODIFIED Requirements

### Requirement: SalesService — Conditional Factus Gating

(Full block replaces existing — dynamic tax per product replaces hardcoded 1.19)

`SalesService.create()` MUST gate Factus on `isElectronic !== false`. Electronic path: load `product.taxes`, compute taxes dynamically. Untaxed products omit taxes entirely. `consumeStock()` unconditional.
(Previously: hardcoded `unitPrice/1.19` with fixed 19%)

- **Single-tax**: GIVEN product IVA 19%, `unitPrice=119000`, WHEN electronic `create()`, THEN Factus price=100000, taxes=`[{ code:'01', rate:'19.00' }]`
- **Multi-tax**: GIVEN product IVA+INC 4%, THEN Factus taxes has two entries
- **Untaxed**: GIVEN untaxed product, THEN Factus item has no taxes array
- **Manual** (unchanged): GIVEN `isElectronic: false`, THEN Factus never called

### Requirement: Emit with Dynamic Tax (ADDED)

`emit()` MUST load `items.product.taxes` and compute taxes dynamically.

- **Emit per-product**: GIVEN manual invoice with taxed products, WHEN `emit()`, THEN each FactusItem has correct tax codes from product config

### Requirement: findOne Returns Tax Data (ADDED)

`findOne()` MUST include `items.invoiceItemTaxes` in relations.

- **Taxes in response**: GIVEN invoice with `InvoiceItemTax` records, WHEN `findOne()`, THEN each item has `taxes[]` with `taxCode`, `taxRate`, `taxAmount`

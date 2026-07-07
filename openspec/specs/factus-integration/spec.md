# factus-integration Specification

## Purpose

Define the Factus gateway interface extensions, request/response types, and HTTP adapter methods required to support electronic adjustment notes (notas de ajuste) for purchase order support documents (documentos soporte).

## Requirements

### Requirement: Support Document Adjustment Note Types

The system MUST define TypeScript interfaces for the Factus support document adjustment note request and response payloads, following the established credit-note pattern.

#### Scenario: FactusSupportDocumentAdjustmentNoteRequest type

- GIVEN the Factus invoicing gateway interface file
- WHEN the types are inspected
- THEN `FactusSupportDocumentAdjustmentNoteRequest` SHALL be defined with fields:
  - `referenceCode: string` — unique client-generated reference
  - `correctionConceptCode: string` — concept code (e.g., `'2'` for total annulment)
  - `supportDocumentNumber: string` — the Factus-assigned number of the original support document
  - `numberingRangeId?: number` — optional numbering range ID
  - `observation: string` — adjustment note observation
  - `paymentDetails: FactusPaymentDetail[]` — payment reversal details
  - `provider?: FactusSupportDocumentProvider` — provider info for the note
  - `items: FactusItem[]` — items with `priceBeforeTax` and tax breakdown

#### Scenario: FactusSupportDocumentAdjustmentNoteResponse type

- GIVEN the Factus invoicing gateway interface file
- WHEN the types are inspected
- THEN `FactusSupportDocumentAdjustmentNoteResponse` SHALL be defined with:
  - `status: string`
  - `message: string`
  - `data: FactusSupportDocumentAdjustmentNoteResponseData`

#### Scenario: FactusSupportDocumentAdjustmentNoteResponseData type

- GIVEN the Factus invoicing gateway interface file
- WHEN the types are inspected
- THEN `FactusSupportDocumentAdjustmentNoteResponseData` SHALL be defined with fields:
  - `referenceCode: string`
  - `number: string` — Factus-assigned note number
  - `cude: string` — unique electronic document code
  - `qrUrl?: string`
  - `publicUrl?: string`
  - `isValidated: boolean`
  - `validatedAt: string | null`
  - `createdAt: string`
  - `numberingRange: FactusNumberingRange | null`
  - `items: any[]`
  - `taxes: any[]`
  - `totals: FactusInvoiceResponseTotals | null`
  - `links: { qr?: string; publicUrl?: string }`

#### Scenario: Types follow existing naming conventions

- GIVEN existing types like `FactusInvoiceRequest`, `FactusCreditNoteRequest`, `FactusSupportDocumentRequest`
- WHEN the new adjustment note types are defined
- THEN they SHALL follow the same PascalCase naming pattern
- AND they SHALL reuse existing shared types (`FactusPaymentDetail`, `FactusItem`, `FactusNumberingRange`, `FactusInvoiceResponseTotals`, `FactusSupportDocumentProvider`) rather than duplicating them

### Requirement: Gateway Interface Methods

The `IFactusInvoicingGateway` interface MUST declare three new methods for support document adjustment note operations.

#### Scenario: createSupportDocumentAdjustmentNote method signature

- GIVEN the `IFactusInvoicingGateway` interface
- WHEN the interface is inspected
- THEN a method `createSupportDocumentAdjustmentNote` SHALL be declared with:
  - Parameter: `request: FactusSupportDocumentAdjustmentNoteRequest`
  - Return type: `Promise<FactusSupportDocumentAdjustmentNoteResponse>`

#### Scenario: destroySupportDocumentAdjustmentNote method signature

- GIVEN the `IFactusInvoicingGateway` interface
- WHEN the interface is inspected
- THEN a method `destroySupportDocumentAdjustmentNote` SHALL be declared with:
  - Parameter: `referenceCode: string`
  - Return type: `Promise<{ status: string; message: string }>`

#### Scenario: downloadSupportDocumentAdjustmentNotePdf method signature

- GIVEN the `IFactusInvoicingGateway` interface
- WHEN the interface is inspected
- THEN a method `downloadSupportDocumentAdjustmentNotePdf` SHALL be declared with:
  - Parameter: `number: string`
  - Return type: `Promise<{ pdfBase64Encoded: string; fileName: string }>`

#### Scenario: Existing methods remain unchanged

- GIVEN the `IFactusInvoicingGateway` interface with existing methods
- WHEN the new methods are added
- THEN all existing method signatures SHALL remain unchanged
- AND no existing method SHALL be removed or renamed

### Requirement: HTTP Adapter Endpoints

The `FactusHttpInvoicingAdapter` MUST implement the three new gateway methods by calling the corresponding Factus API endpoints.

#### Scenario: createSupportDocumentAdjustmentNote adapter implementation

- GIVEN the `FactusHttpInvoicingAdapter` class
- WHEN `createSupportDocumentAdjustmentNote(request)` is called
- THEN the adapter SHALL send a POST request to `/v1/adjustment-notes/support-documents/validate`
- AND the request body SHALL include `referenceCode`, `correctionConceptCode`, `supportDocumentNumber`, `numberingRangeId`, `observation`, `paymentDetails`, `provider`, and `items`
- AND the response SHALL be parsed as `FactusSupportDocumentAdjustmentNoteResponse`

#### Scenario: destroySupportDocumentAdjustmentNote adapter implementation

- GIVEN the `FactusHttpInvoicingAdapter` class
- WHEN `destroySupportDocumentAdjustmentNote(referenceCode)` is called
- THEN the adapter SHALL send a DELETE request to `/v1/adjustment-notes/support-documents/reference/{referenceCode}`
- AND the response SHALL be parsed as `{ status, message }`

#### Scenario: downloadSupportDocumentAdjustmentNotePdf adapter implementation

- GIVEN the `FactusHttpInvoicingAdapter` class
- WHEN `downloadSupportDocumentAdjustmentNotePdf(number)` is called
- THEN the adapter SHALL send a GET request to `/v2/adjustment-notes/{number}/download-pdf`
- AND the response SHALL be parsed as `{ pdfBase64Encoded, fileName }`

#### Scenario: Adapter uses existing HTTP patterns

- GIVEN the existing adapter methods
- WHEN implementing the new adjustment note methods
- THEN the same HTTP client configuration, authentication headers, and error handling patterns SHALL be used

#### Scenario: Adapter implements the full gateway interface

- GIVEN the `FactusHttpInvoicingAdapter` class
- WHEN the class is inspected
- THEN it SHALL `implements IFactusInvoicingGateway`
- AND all 11 interface methods SHALL be implemented (8 existing + 3 new)

### Requirement: Numbering Range Resolution

The system MUST resolve the appropriate Factus numbering range for support document adjustment notes.

#### Scenario: Active numbering range lookup

- GIVEN the numbering range for "Nota Ajuste Documento Soporte" exists in Factus
- WHEN building the adjustment note request
- THEN the system SHALL attempt to resolve the active numbering range
- AND the resolved `numberingRangeId` SHALL be included in the Factus payload

#### Scenario: Fallback when numbering range lookup fails

- GIVEN the numbering range lookup fails
- WHEN building the adjustment note request
- THEN a fallback numbering range ID SHALL be used
- AND the system SHALL NOT crash
- AND a warning SHALL be logged

### Non-Functional Requirements

#### NFR: Adapter Consistency

All new adapter methods MUST follow the existing error handling, logging, and response parsing patterns. No new HTTP client instances, interceptors, or authentication mechanisms SHALL be introduced.

#### NFR: Type Reuse

New types SHALL reuse existing shared types rather than duplicating their definitions.

#### NFR: Backward Compatibility

The gateway interface extension SHALL be backward compatible. Existing consumers SHALL continue to compile and function without modification.

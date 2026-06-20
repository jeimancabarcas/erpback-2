# 📝 Notas de Crédito - Factus API

> **Índice de este módulo**
> 1. [Crear y Validar (POST)](#crear-y-validar)
> 2. [Eliminar Nota de Crédito (DELETE)](#eliminar)
> 3. [Ver Nota de Crédito (GET)](#ver)
> 4. [Listar y Filtrar (GET)](#listar)
> 5. [Enviar por Correo (POST)](#correo)
> 6. [Implementación NestJS completa](#nestjs)

---

## <a name="crear-y-validar"></a>

Las Notas de Crédito permiten corregir o anular total o parcialmente una factura electrónica previamente validada ante la DIAN.

---

## 🌍 Endpoints

| Entorno | URL |
| :--- | :--- |
| **Sandbox** | `POST https://api-sandbox.factus.com.co/v2/credit-notes/validate` |
| **Producción** | `POST https://api.factus.com.co/v2/credit-notes/validate` |

---

## 📥 Campos del Payload (JSON)

### Campos Base
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `reference_code` | `string` | **Sí** | Código único de referencia interna del ERP (idempotencia). |
| `correction_concept_code` | `string` | **Sí** | Código del concepto de corrección. Ver tabla de códigos abajo. |
| `customization_id` | `string` | No (def. `"20"`) | Tipo de operación. `"20"` = con referencia, `"22"` = sin referencia. |
| `bill_number` | `string` | Cond. | Número DIAN de la factura asociada (ej. `SETP990002519`). Requerido salvo `customization_id = "22"`. |
| `numbering_range_id` | `integer` | No | ID del rango de numeración. Requerido si hay múltiples rangos activos. |
| `observation` | `string` | No | Nota de la nota crédito (máx. 250 caracteres). |
| `payment_details` | `array` | **Sí** | Medios de pago. Mismo formato que en facturas. |
| `customer` | `object` | No | Si se omite, Factus toma los datos del cliente desde la factura referenciada en `bill_number`. |
| `items` | `array` | **Sí** | Productos o servicios acreditados. |
| `allowance_charges` | `array` | No | Descuentos o recargos globales. |

### Códigos de Concepto de Corrección (`correction_concept_code`)
| Código | Descripción |
| :--- | :--- |
| `1` | Devolución parcial de los bienes y/o no aceptación parcial del servicio |
| `2` | Anulación de factura electrónica |
| `3` | Rebaja o descuento parcial |
| `4` | Ajuste de precio |
| `5` | Otros |

### Ítems (`items[]`)
Los ítems tienen la misma estructura que en las facturas (ver [emision_facturas.md](emision_facturas.md)), con el campo adicional opcional:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `additional_properties[].code` | `string` | Código de operación para sector transporte de carga. |
| `additional_properties[].value` | `string` | Valor de la característica. |
| `additional_properties[].quantity` | `string` | Cantidad transportada (requerido si `code = "03"`). |
| `additional_properties[].unit_measure_code` | `string` | Unidad de la cantidad (requerido si `code = "03"`). |

### Descuentos/Recargos Globales (`allowance_charges[]`)
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `concept_type` | `string` | Código del tipo de descuento o recargo. |
| `is_surcharge` | `boolean` | `true` = recargo, `false` = descuento. |
| `reason` | `string` | Razón del descuento o recargo. |
| `base_amount` | `string` | Base para el cálculo (máx. 2 decimales). |
| `amount` | `string` | Valor del descuento o recargo (máx. 2 decimales). |

> [!NOTE]
> Las reglas de idempotencia y manejo del `409 Conflict` son idénticas a las de facturas. Si recibes un `409`, elimina la nota crédito por referencia con `DELETE /v2/credit-notes/destroy/reference/{reference_code}` y reintenta.

---

## 📝 Ejemplo de Solicitud (JSON)
```json
{
  "reference_code": "NOTA-2026-0015",
  "correction_concept_code": "2",
  "customization_id": "20",
  "bill_number": "SETP990002519",
  "numbering_range_id": 1776,
  "observation": "Anulación de factura por error en datos del cliente",
  "payment_details": [
    {
      "payment_form": "1",
      "payment_method_code": "42",
      "reference_code": "pago-001",
      "amount": "83300"
    }
  ],
  "customer": {
    "identification_document_code": "31",
    "identification": "123456789",
    "company": "Alan company name",
    "trade_name": "Alan trade name",
    "address": "calle 1 # 1-1",
    "email": "cliente@correo.com",
    "phone": "1234567890",
    "legal_organization_code": "1",
    "tribute_code": "ZZ",
    "municipality_code": "68679"
  },
  "items": [
    {
      "code_reference": "PROD-000A",
      "name": "Producto A",
      "quantity": "1.00",
      "discount_rate": "0.00",
      "price": "10000.00",
      "unit_measure_code": "94",
      "standard_code": "999",
      "taxes": [{ "code": "01", "rate": "19.00" }]
    },
    {
      "code_reference": "PROD-000B",
      "name": "Producto B",
      "quantity": "3.00",
      "discount_rate": "0.00",
      "price": "20000.00",
      "unit_measure_code": "94",
      "standard_code": "999",
      "taxes": [{ "code": "01", "rate": "19.00" }]
    }
  ]
}
```

---

## 🏛️ Implementación NestJS

### Interfaces de Dominio
Agrega estas interfaces al archivo `factus-invoicing-gateway.interface.ts`:

```typescript
export interface FactusCreditNoteRequest {
  referenceCode: string;
  correctionConceptCode: string;
  customizationId?: string;
  billNumber?: string;
  numberingRangeId?: number;
  observation?: string;
  paymentDetails: FactusPaymentDetail[];
  customer?: FactusCustomer;
  items: FactusItem[];
  allowanceCharges?: FactusAllowanceCharge[];
}

export interface FactusAllowanceCharge {
  conceptType: string;
  isSurcharge: boolean;
  reason: string;
  baseAmount: string;
  amount: string;
}

export interface FactusCreditNoteResponseData {
  referenceCode: string;
  number: string;
  cude: string;
  sendEmail: boolean;
  isValidated: boolean;
  validatedAt: string | null;
  createdAt: string;
  numberingRange: FactusNumberingRange;
  items: FactusResponseItem[];
  taxes: FactusResponseTax[];
  totals: FactusInvoiceResponseTotals;
  links: { qr: string; publicUrl: string };
}

export interface FactusCreditNoteResponse {
  status: string;
  message: string;
  data: FactusCreditNoteResponseData;
}
```

Extiende `IFactusInvoicingGateway`:
```typescript
export interface IFactusInvoicingGateway {
  createInvoice(invoice: FactusInvoiceRequest): Promise<FactusInvoiceResponse>;
  createCreditNote(creditNote: FactusCreditNoteRequest): Promise<FactusCreditNoteResponse>;
  deleteInvoice(referenceCode: string): Promise<void>;
  getInvoice(number: string): Promise<FactusInvoiceResponseData>;
  listInvoices(page?: number, filters?: Record<string, string>): Promise<FactusPaginatedInvoicesResponse>;
  downloadInvoicePdf(number: string): Promise<{ pdfBase64Encoded: string; fileName: string }>;
  getInvoiceEvents(number: string): Promise<FactusRadianEvent[]>;
}
```

### DTO de Validación
`src/modules/factus/dtos/create-factus-credit-note.dto.ts`
```typescript
import {
  IsString, IsNotEmpty, IsOptional, IsNumber,
  IsArray, ValidateNested, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FactusItemDto, FactusPaymentDetailDto, FactusCustomerDto } from './create-factus-invoice.dto';

export class FactusAllowanceChargeDto {
  @IsString() @IsNotEmpty() concept_type: string;
  @IsBoolean() is_surcharge: boolean;
  @IsString() @IsNotEmpty() reason: string;
  @IsString() @IsNotEmpty() base_amount: string;
  @IsString() @IsNotEmpty() amount: string;
}

export class CreateFactusCreditNoteDto {
  @IsString() @IsNotEmpty() reference_code: string;
  @IsString() @IsNotEmpty() correction_concept_code: string;
  @IsString() @IsOptional() customization_id?: string;
  @IsString() @IsOptional() bill_number?: string;
  @IsNumber() @IsOptional() numbering_range_id?: number;
  @IsString() @IsOptional() observation?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FactusPaymentDetailDto)
  payment_details: FactusPaymentDetailDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FactusCustomerDto)
  customer?: FactusCustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FactusItemDto)
  items: FactusItemDto[];

  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FactusAllowanceChargeDto)
  allowance_charges?: FactusAllowanceChargeDto[];
}
```

### Método del Adaptador HTTP
Agrega `createCreditNote` en `FactusHttpInvoicingAdapter`:

```typescript
async createCreditNote(creditNote: FactusCreditNoteRequest): Promise<FactusCreditNoteResponse> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();

  const payload: Record<string, any> = {
    reference_code: creditNote.referenceCode,
    correction_concept_code: creditNote.correctionConceptCode,
    customization_id: creditNote.customizationId || '20',
    bill_number: creditNote.billNumber,
    numbering_range_id: creditNote.numberingRangeId,
    observation: creditNote.observation,
    payment_details: creditNote.paymentDetails.map(p => ({
      payment_form: p.paymentForm,
      payment_method_code: p.paymentMethodCode,
      amount: p.amount,
      due_date: p.dueDate,
      reference_code: p.referenceCode,
    })),
    items: creditNote.items.map(item => ({
      code_reference: item.codeReference,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      discount_rate: item.discountRate,
      unit_measure_code: item.unitMeasureCode,
      standard_code: item.standardCode,
      note: item.note,
      taxes: item.taxes.map(t => ({ code: t.code, rate: t.rate, is_excluded: t.isExcluded })),
      ...(item.withholdingTaxes?.length && {
        withholding_taxes: item.withholdingTaxes.map(w => ({ code: w.code, rate: w.rate })),
      }),
    })),
  };

  if (creditNote.customer) {
    payload.customer = {
      identification_document_code: creditNote.customer.identificationDocumentCode,
      identification: creditNote.customer.identification,
      dv: creditNote.customer.dv,
      legal_organization_code: creditNote.customer.legalOrganizationCode,
      tribute_code: creditNote.customer.tributeCode || 'ZZ',
      company: creditNote.customer.company,
      trade_name: creditNote.customer.tradeName,
      names: creditNote.customer.names,
      address: creditNote.customer.address,
      email: creditNote.customer.email,
      phone: creditNote.customer.phone,
      municipality_code: creditNote.customer.municipalityCode,
    };
  }

  if (creditNote.allowanceCharges?.length) {
    payload.allowance_charges = creditNote.allowanceCharges.map(a => ({
      concept_type: a.conceptType,
      is_surcharge: a.isSurcharge,
      reason: a.reason,
      base_amount: a.baseAmount,
      amount: a.amount,
    }));
  }

  try {
    const response$ = this.httpService.post(`${baseUrl}/v2/credit-notes/validate`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const response = await firstValueFrom(response$);
    const d = response.data.data;
    return {
      status: response.data.status,
      message: response.data.message,
      data: {
        referenceCode: d.reference_code,
        number: d.number,
        cude: d.cude,
        sendEmail: d.send_email,
        isValidated: d.is_validated,
        validatedAt: d.validated_at,
        createdAt: d.created_at,
        numberingRange: d.numbering_range ? {
          prefix: d.numbering_range.prefix,
          from: d.numbering_range.from,
          to: d.numbering_range.to,
          resolutionNumber: d.numbering_range.resolution_number,
          startDate: d.numbering_range.start_date,
          endDate: d.numbering_range.end_date,
          months: d.numbering_range.months,
        } : null,
        items: d.items || [],
        taxes: d.taxes || [],
        totals: d.totals ? {
          prepaymentAmount: d.totals.prepayment_amount,
          grossAmount: d.totals.gross_amount,
          taxableAmount: d.totals.taxable_amount,
          taxAmount: d.totals.tax_amount,
          surchargeAmount: d.totals.surcharge_amount,
          total: d.totals.total,
        } : null,
        links: { qr: d.links?.qr, publicUrl: d.links?.public_url },
      },
    };
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
  // ... métodos existentes de facturas y notas crédito ...
  deleteCreditNote(referenceCode: string): Promise<void>;
  getCreditNote(number: string): Promise<FactusCreditNoteResponseData>;
  listCreditNotes(page?: number, filters?: Record<string, string>): Promise<FactusPaginatedCreditNotesResponse>;
  sendCreditNoteEmail(number: string, email: string, pdfBase64?: string): Promise<void>;
}
```

### Métodos en `FactusHttpInvoicingAdapter`

```typescript
async deleteCreditNote(referenceCode: string): Promise<void> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  try {
    await firstValueFrom(
      this.httpService.delete(`${baseUrl}/v2/credit-notes/reference/${referenceCode}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
    );
  } catch (error) {
    throw new Error(`Error eliminando nota crédito ${referenceCode}: ${error.response?.data?.message || error.message}`);
  }
}

async getCreditNote(number: string): Promise<FactusCreditNoteResponseData> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const response = await firstValueFrom(
    this.httpService.get(`${baseUrl}/v2/credit-notes/${number}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    }),
  );
  const d = response.data.data;
  return {
    referenceCode: d.reference_code,
    number: d.number,
    cude: d.cude,
    sendEmail: d.send_email,
    isValidated: d.is_validated,
    validatedAt: d.validated_at,
    createdAt: d.created_at,
    numberingRange: d.numbering_range ? {
      prefix: d.numbering_range.prefix,
      from: d.numbering_range.from,
      to: d.numbering_range.to,
      resolutionNumber: d.numbering_range.resolution_number,
      startDate: d.numbering_range.start_date,
      endDate: d.numbering_range.end_date,
      months: d.numbering_range.months,
    } : null,
    items: d.items || [],
    taxes: d.taxes || [],
    totals: d.totals ? {
      prepaymentAmount: d.totals.prepayment_amount,
      grossAmount: d.totals.gross_amount,
      taxableAmount: d.totals.taxable_amount,
      taxAmount: d.totals.tax_amount,
      surchargeAmount: d.totals.surcharge_amount,
      total: d.totals.total,
    } : null,
    links: { qr: d.links?.qr, publicUrl: d.links?.public_url },
  };
}

async listCreditNotes(page = 1, filters: Record<string, string> = {}): Promise<FactusPaginatedCreditNotesResponse> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const response = await firstValueFrom(
    this.httpService.get(`${baseUrl}/v2/credit-notes`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      params: { page, ...filters },
    }),
  );
  const raw = response.data.data;
  return {
    data: raw.data,
    meta: {
      total: raw.total,
      perPage: raw.per_page,
      currentPage: raw.current_page,
      lastPage: raw.last_page,
      from: raw.from,
      to: raw.to,
    },
  };
}

async sendCreditNoteEmail(number: string, email: string, pdfBase64?: string): Promise<void> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const body: Record<string, string> = { email };
  if (pdfBase64) body.pdf_base_64_encoded = pdfBase64;
  try {
    await firstValueFrom(
      this.httpService.post(`${baseUrl}/v2/credit-notes/${number}/send-email`, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );
  } catch (error) {
    throw new Error(`Error enviando correo de nota crédito ${number}: ${error.response?.data?.message || error.message}`);
  }
}
```

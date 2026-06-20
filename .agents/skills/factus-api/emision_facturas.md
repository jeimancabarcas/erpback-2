# 🧾 Emisión de Facturas Electrónicas - Factus API

Permite registrar y validar de forma **sincrónica** facturas electrónicas de venta ante la DIAN mediante un único endpoint.

---

## 🌍 Endpoints

| Entorno | URL |
| :--- | :--- |
| **Sandbox** | `POST https://api-sandbox.factus.com.co/v2/bills/validate` |
| **Producción** | `POST https://api.factus.com.co/v2/bills/validate` |

---

## 📥 Campos del Payload (JSON)

### Campos Base
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `reference_code` | `string` | **Sí** | Código único de referencia interna del ERP (idempotencia). |
| `document` | `string` | No (def. `"01"`) | Tipo de documento. `"01"` = Factura de Venta. |
| `numbering_range_id` | `integer` | No | ID del rango de numeración DIAN. Requerido si hay múltiples rangos activos. |
| `operation_type` | `string` | No (def. `"10"`) | `"10"` estándar, `"11"` mandatos, `"12"` transporte. |
| `send_email` | `boolean` | No (def. `true`) | Enviar correo de validación al cliente. |
| `observation` | `string` | No | Nota de la factura (máx. 250 caracteres). |
| `cash_rounding_amount` | `string` | No | Ajuste de redondeo en medios de pago (máx. ±500.00). |
| `created_time` | `string` | No | Hora de creación `HH:mm:ss`. |

### Adquiriente (`customer`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `identification_document_code` | `string` | **Sí** | `"13"` cédula, `"31"` NIT. |
| `identification` | `string` | **Sí** | Número de documento. |
| `legal_organization_code` | `string` | **Sí** | `"1"` Persona Jurídica, `"2"` Persona Natural. |
| `company` | `string` | Cond. | Razón social. Requerido si `legal_organization_code = "1"`. |
| `names` | `string` | Cond. | Nombre. Requerido si `legal_organization_code = "2"`. |
| `dv` | `string` | Cond. | Dígito de verificación (solo NIT; si se omite, se auto-calcula). |
| `tribute_code` | `string` | No (def. `"ZZ"`) | Responsabilidad fiscal. |
| `email` | `string` | No | Requerido si `send_email = true`. |
| `municipality_code` | `string` | No | Código DIVIPOLA. |

### Ítems (`items[]`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `code_reference` | `string` | **Sí** | Código de referencia del producto. |
| `name` | `string` | **Sí** | Nombre del producto o servicio. |
| `quantity` | `string` | **Sí** | Cantidad (máx. 2 decimales). |
| `price` | `string` | **Sí** | Precio unitario neto sin impuestos. |
| `discount_rate` | `string` | **Sí** | Porcentaje de descuento (ej. `"0.00"`). |
| `unit_measure_code` | `string` | **Sí** | `"94"` = unidad. |
| `standard_code` | `string` | **Sí** | `"999"` = adopción propia del contribuyente. |
| `taxes[].code` | `string` | **Sí** | `"01"` IVA, `"04"` INC. |
| `taxes[].rate` | `string` | **Sí** | Tarifa. Ej.: `"19.00"`. |
| `withholding_taxes[].code` | `string` | Cond. | `"05"` Retefuente, `"06"` ReteIVA, `"07"` ReteICA. |

> [!NOTE]
> Los arrays opcionales (`withholding_taxes`, `payment_details`, etc.) **no pueden enviarse vacíos**. Si no aplican, simplemente no los incluyas en el payload.

---

## 📝 Ejemplo de Solicitud (JSON)
```json
{
  "reference_code": "FACT-2026-0124",
  "document": "01",
  "numbering_range_id": 389,
  "operation_type": "10",
  "observation": "Observación de prueba",
  "payment_details": [
    {
      "payment_form": "1",
      "payment_method_code": "42",
      "reference_code": "pago-001",
      "amount": "83300"
    }
  ],
  "cash_rounding_amount": "0.00",
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

## 📄 Ejemplo de Respuesta DIAN (201 Created)
```json
{
  "status": "Created",
  "message": "Documento con el código de referencia FACT-2026-0124 registrado y validado con éxito.",
  "data": {
    "reference_code": "FACT-2026-0124",
    "number": "SETP-1234",
    "cufe": "76d54f89d3a1c8f395c52f9b17de38c4ef186cde...",
    "is_validated": true,
    "validated_at": "2026-05-20 14:02:15",
    "created_at": "2026-05-20 14:02:14",
    "numbering_range": {
      "prefix": "SETP",
      "from": 1,
      "to": 10000,
      "resolution_number": "187640000001",
      "start_date": "20-01-2026",
      "end_date": "20-01-2027",
      "months": 12
    },
    "totals": {
      "gross_amount": "70000.00",
      "taxable_amount": "70000.00",
      "tax_amount": "13300.00",
      "total": "83300.00"
    },
    "links": {
      "qr": "https://catalogo-vp.dian.gov.co/document/searchqr?documentKey=76d54f89...",
      "public_url": "https://portal.factus.com.co/view/SETP-1234"
    }
  }
}
```

---

## ⚠️ Manejo de Errores DIAN

| Escenario | Causa | Solución |
| :--- | :--- | :--- |
| **`reference_code` duplicado procesado** | El `reference_code` ya existe y fue validado. | La API retorna los datos del documento previo (idempotente). No se crea duplicado. |
| **`409 Conflict`** | Una factura con el mismo `reference_code` está pendiente en el buffer local de Factus. | Detectar el 409, llamar `DELETE /v2/bills/destroy/reference/{reference_code}` y reintentar. |
| **Arrays vacíos en payload** | Se envió un campo optional (`withholding_taxes: []`) con array vacío. | Omitir completamente el campo si no tiene datos. |

El campo `is_validated` guía la estrategia:
- `true` → La factura ya está ante la DIAN. No eliminar.
- `false` → Está pendiente. Eliminar y reintentar.

---

## 🏛️ Implementación NestJS

### Interfaces de Dominio
`src/modules/factus/interfaces/factus-invoicing-gateway.interface.ts`
```typescript
export interface FactusCustomer {
  identificationDocumentCode: string;
  identification: string;
  dv?: string;
  legalOrganizationCode: string;
  tributeCode?: string;
  company?: string;
  tradeName?: string;
  names?: string;
  address?: string;
  email?: string;
  phone?: string;
  municipalityCode?: string;
}

export interface FactusPaymentDetail {
  paymentForm: string;
  paymentMethodCode: string;
  amount: string;
  dueDate?: string;
  referenceCode?: string;
}

export interface FactusTax {
  code: string;
  rate: string;
  isExcluded?: boolean;
}

export interface FactusItem {
  codeReference: string;
  name: string;
  quantity: string;
  price: string;
  discountRate: string;
  unitMeasureCode: string;
  standardCode: string;
  note?: string;
  schemeId?: string;
  taxes: FactusTax[];
  withholdingTaxes?: { code: string; rate: string }[];
}

export interface FactusInvoiceRequest {
  referenceCode: string;
  createdTime?: string;
  document?: string;
  numberingRangeId?: number;
  operationType?: string;
  sendEmail?: boolean;
  observation?: string;
  cashRoundingAmount?: string;
  customer: FactusCustomer;
  paymentDetails: FactusPaymentDetail[];
  items: FactusItem[];
}

// ---- Interfaces de Respuesta ----
export interface FactusNumberingRange {
  prefix: string;
  from: number;
  to: number;
  resolutionNumber: string;
  startDate: string;
  endDate: string;
  months: number;
}

export interface FactusTaxRateDetail {
  taxableAmount: string;
  taxAmount: string;
  rate: string;
}

export interface FactusResponseTax {
  tribute: { code: string; name: string };
  isExcluded: boolean;
  rates: FactusTaxRateDetail[];
}

export interface FactusResponseItem {
  codeReference: string;
  name: string;
  quantity: string;
  unitMeasure: { code: string; name: string };
  standardCode: { code: string; name: string };
  discountRate: string;
  discount: string;
  grossValue: string;
  price: string;
  total: string;
  note?: string;
  taxes: FactusResponseTax[];
  withholdingTaxes?: any[];
}

export interface FactusInvoiceResponseTotals {
  prepaymentAmount: string;
  grossAmount: string;
  taxableAmount: string;
  taxAmount: string;
  surchargeAmount: string;
  total: string;
}

export interface FactusInvoiceResponseData {
  referenceCode: string;
  number: string;
  cufe: string;
  sendEmail: boolean;
  isValidated: boolean;
  validatedAt: string | null;
  createdAt: string;
  numberingRange: FactusNumberingRange;
  items: FactusResponseItem[];
  taxes: FactusResponseTax[];
  withholdingTaxes: any[];
  totals: FactusInvoiceResponseTotals;
  relatedNotes: { creditNotes: any[]; debitNotes: any[] };
  links: { qr: string; publicUrl: string };
}

export interface FactusInvoiceResponse {
  status: string;
  message: string;
  data: FactusInvoiceResponseData;
}

export interface IFactusInvoicingGateway {
  createInvoice(invoice: FactusInvoiceRequest): Promise<FactusInvoiceResponse>;
}
```

### DTO de Validación
`src/modules/factus/dtos/create-factus-invoice.dto.ts`
```typescript
import {
  IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber,
  IsArray, ValidateNested, IsEnum, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FactusTaxDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() rate: string;
  @IsBoolean() @IsOptional() is_excluded?: boolean;
}

export class FactusWithholdingTaxDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() rate: string;
}

export class FactusItemDto {
  @IsString() @IsNotEmpty() code_reference: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() quantity: string;
  @IsString() @IsNotEmpty() price: string;
  @IsString() @IsNotEmpty() discount_rate: string;
  @IsString() @IsNotEmpty() unit_measure_code: string;
  @IsString() @IsNotEmpty() standard_code: string;
  @IsString() @IsOptional() note?: string;
  @IsString() @IsOptional() scheme_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FactusTaxDto)
  taxes: FactusTaxDto[];

  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FactusWithholdingTaxDto)
  withholding_taxes?: FactusWithholdingTaxDto[];
}

export class FactusPaymentDetailDto {
  @IsString() @IsNotEmpty() payment_form: string;
  @IsString() @IsNotEmpty() payment_method_code: string;
  @IsString() @IsNotEmpty() amount: string;
  @ValidateIf(o => o.payment_form === '2')
  @IsString() @IsNotEmpty() due_date?: string;
  @IsString() @IsOptional() reference_code?: string;
}

export class FactusCustomerDto {
  @IsString() @IsNotEmpty() identification_document_code: string;
  @IsString() @IsNotEmpty() identification: string;
  @IsString() @IsOptional() dv?: string;
  @IsString() @IsNotEmpty() @IsEnum(['1', '2']) legal_organization_code: string;
  @ValidateIf(o => o.legal_organization_code === '1')
  @IsString() @IsNotEmpty() company?: string;
  @ValidateIf(o => o.legal_organization_code === '2')
  @IsString() @IsNotEmpty() names?: string;
  @IsString() @IsOptional() trade_name?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() tribute_code?: string;
  @IsString() @IsOptional() municipality_code?: string;
}

export class CreateFactusInvoiceDto {
  @IsString() @IsNotEmpty() reference_code: string;
  @IsString() @IsOptional() document?: string;
  @IsNumber() @IsOptional() numbering_range_id?: number;
  @IsString() @IsOptional() operation_type?: string;
  @IsBoolean() @IsOptional() send_email?: boolean;
  @IsString() @IsOptional() observation?: string;
  @IsString() @IsOptional() cash_rounding_amount?: string;
  @IsString() @IsOptional() created_time?: string;

  @ValidateNested()
  @Type(() => FactusCustomerDto)
  customer: FactusCustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FactusPaymentDetailDto)
  payment_details: FactusPaymentDetailDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FactusItemDto)
  items: FactusItemDto[];
}
```

### Adaptador HTTP
`src/modules/factus/adapters/factus-http-invoicing.adapter.ts`
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  IFactusInvoicingGateway, FactusInvoiceRequest, FactusInvoiceResponse,
} from '../interfaces/factus-invoicing-gateway.interface';
import { IFactusAuthGateway } from '../interfaces/factus-auth-gateway.interface';

@Injectable()
export class FactusHttpInvoicingAdapter implements IFactusInvoicingGateway {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject('IFactusAuthGateway')
    private readonly authGateway: IFactusAuthGateway,
  ) {}

  async createInvoice(invoice: FactusInvoiceRequest): Promise<FactusInvoiceResponse> {
    const baseUrl = this.configService.get<string>('FACTUS_API_URL');
    const token = await this.authGateway.getAccessToken();

    const payload = this.mapInvoiceToPayload(invoice);

    try {
      const response$ = this.httpService.post(`${baseUrl}/v2/bills/validate`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      const response = await firstValueFrom(response$);
      return this.mapResponseToDomain(response.data);
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      const details = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : '';
      throw new Error(`Error emitiendo factura: ${msg}. ${details}`);
    }
  }

  private mapInvoiceToPayload(invoice: FactusInvoiceRequest) {
    return {
      reference_code: invoice.referenceCode,
      document: invoice.document || '01',
      numbering_range_id: invoice.numberingRangeId,
      operation_type: invoice.operationType || '10',
      send_email: invoice.sendEmail ?? true,
      observation: invoice.observation,
      cash_rounding_amount: invoice.cashRoundingAmount,
      created_time: invoice.createdTime,
      customer: {
        identification_document_code: invoice.customer.identificationDocumentCode,
        identification: invoice.customer.identification,
        dv: invoice.customer.dv,
        legal_organization_code: invoice.customer.legalOrganizationCode,
        tribute_code: invoice.customer.tributeCode || 'ZZ',
        company: invoice.customer.company,
        trade_name: invoice.customer.tradeName,
        names: invoice.customer.names,
        address: invoice.customer.address,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
        municipality_code: invoice.customer.municipalityCode,
      },
      payment_details: invoice.paymentDetails.map(p => ({
        payment_form: p.paymentForm,
        payment_method_code: p.paymentMethodCode,
        amount: p.amount,
        due_date: p.dueDate,
        reference_code: p.referenceCode,
      })),
      items: invoice.items.map(item => ({
        code_reference: item.codeReference,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        discount_rate: item.discountRate,
        unit_measure_code: item.unitMeasureCode,
        standard_code: item.standardCode,
        note: item.note,
        scheme_id: item.schemeId,
        taxes: item.taxes.map(t => ({ code: t.code, rate: t.rate, is_excluded: t.isExcluded })),
        ...(item.withholdingTaxes?.length && {
          withholding_taxes: item.withholdingTaxes.map(w => ({ code: w.code, rate: w.rate })),
        }),
      })),
    };
  }

  private mapResponseToDomain(raw: any): FactusInvoiceResponse {
    const d = raw.data;
    return {
      status: raw.status,
      message: raw.message,
      data: {
        referenceCode: d.reference_code,
        number: d.number,
        cufe: d.cufe,
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
        items: d.items?.map(item => ({
          codeReference: item.code_reference,
          name: item.name,
          quantity: item.quantity,
          unitMeasure: { code: item.unit_measure?.code, name: item.unit_measure?.name },
          standardCode: { code: item.standard_code?.code, name: item.standard_code?.name },
          discountRate: item.discount_rate,
          discount: item.discount,
          grossValue: item.gross_value,
          price: item.price,
          total: item.total,
          note: item.note,
          taxes: item.taxes?.map(t => ({
            tribute: { code: t.tribute?.code, name: t.tribute?.name },
            isExcluded: t.is_excluded,
            rates: t.rates?.map(r => ({ taxableAmount: r.taxable_amount, taxAmount: r.tax_amount, rate: r.rate })),
          })),
          withholdingTaxes: item.withholding_taxes || [],
        })) || [],
        taxes: d.taxes?.map(t => ({
          tribute: { code: t.tribute?.code, name: t.tribute?.name },
          isExcluded: t.is_excluded,
          rates: t.rates?.map(r => ({ taxableAmount: r.taxable_amount, taxAmount: r.tax_amount, rate: r.rate })),
        })) || [],
        withholdingTaxes: d.withholding_taxes || [],
        totals: d.totals ? {
          prepaymentAmount: d.totals.prepayment_amount,
          grossAmount: d.totals.gross_amount,
          taxableAmount: d.totals.taxable_amount,
          taxAmount: d.totals.tax_amount,
          surchargeAmount: d.totals.surcharge_amount,
          total: d.totals.total,
        } : null,
        relatedNotes: {
          creditNotes: d.related_notes?.credit_notes || [],
          debitNotes: d.related_notes?.debit_notes || [],
        },
        links: { qr: d.links?.qr, publicUrl: d.links?.public_url },
      },
    };
  }
}
```

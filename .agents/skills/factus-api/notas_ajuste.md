# 📝 Notas de Ajuste a Documentos Soporte - Factus API

> **Índice de este módulo**
> 1. [Crear y Validar (POST)](#crear-y-validar)
> 2. [Eliminar Nota de Ajuste (DELETE)](#eliminar)
> 3. [Ver Nota de Ajuste (GET)](#ver)
> 4. [Listar y Filtrar (GET)](#listar)
> 5. [Descargar PDF (GET)](#pdf)
> 6. [Implementación NestJS Completa](#nestjs)

---

## <a name="crear-y-validar"></a> 1. Crear y Validar Nota de Ajuste

Las **Notas de Ajuste a Documentos Soporte** permiten corregir o anular de manera parcial o total un documento soporte electrónico previamente emitido ante la DIAN.

### 🌍 Endpoints
| Entorno | Método | URL |
| :--- | :--- | :--- |
| **Sandbox** | `POST` | `https://api-sandbox.factus.com.co/v2/adjustment-notes/validate` |
| **Producción** | `POST` | `https://api.factus.com.co/v2/adjustment-notes/validate` |

---

### 📥 Campos del Payload (JSON)

#### Campos Base del Documento
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `reference_code` | `string` | **Sí** | Código único de referencia del ERP para evitar duplicidad e idempotencia. |
| `created_time` | `string` | No | Hora de creación en formato `HH:mm:ss`. |
| `numbering_range_id` | `integer` | No | ID del rango de numeración. Requerido solo si tienes múltiples rangos de nota de ajuste activos. |
| `support_document_number`| `string` | **Sí** | Número del documento soporte al cual se le hace la nota de ajuste (ej: `SEDS984000129`). |
| `correction_concept_code` | `string` | **Sí** | Código del motivo por el cual se genera la nota de ajuste (ver códigos abajo). |
| `observation` | `string` | No | Observaciones de la nota de ajuste (máx. 250 caracteres). |
| `cash_rounding_amount` | `string` | No | Ajuste para redondear centavos en la moneda local (máx. ±500.00). |
| `payment_details` | `array` | **Sí** | Medios de pago utilizados en el documento. |
| `provider` | `object` | **Sí** | Datos del proveedor del bien o servicio. |
| `items` | `array` | **Sí** | Listado de productos o servicios que componen la nota de ajuste. |

#### Códigos de Concepto de Corrección (`correction_concept_code`)
| Código | Descripción |
| :--- | :--- |
| `1` | Devolución parcial de los bienes y/o no aceptación parcial del servicio |
| `2` | Anulación de documento soporte |
| `3` | Rebaja o descuento parcial |
| `4` | Ajuste de precio |
| `5` | Otros |

#### Datos del Proveedor (`provider`)
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `identification_document_code` | `string` | **Sí** | Código del documento de identidad del proveedor (ej. `"31"` para NIT). |
| `identification` | `string` | **Sí** | Número de identificación. |
| `dv` | `string` | No | Dígito de verificación (si no se envía, Factus lo calcula). |
| `trade_name` | `string` | No | Nombre comercial. |
| `names` | `string` | **Sí** | Nombre completo o Razón Social del proveedor. |
| `address` | `string` | **Sí** | Dirección. |
| `country_code` | `string` | **Sí** | Código de país (e.g. `"CO"`). |
| `municipality_code` | `string` | **Sí** | Código de municipio DIAN (e.g. `"68679"`). |
| `email` | `string` | No | Correo electrónico del proveedor. |
| `phone` | `string` | No | Teléfono de contacto. |

#### Ítems (`items[]`)
Cada producto o servicio de la nota de ajuste debe detallarse como un objeto:
| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `code_reference` | `string` | **Sí** | Código interno del ítem en el ERP. |
| `name` | `string` | **Sí** | Nombre o descripción del ítem. |
| `quantity` | `string` | **Sí** | Cantidad (máx. 2 decimales). |
| `discount_rate` | `string` | **Sí** | Porcentaje de descuento (ej. `"0.00"`). |
| `price` | `string` | **Sí** | Precio unitario neto del ítem sin impuestos (máx. 2 decimales). |
| `unit_measure_code` | `string` | **Sí** | Código de la unidad de medida (e.g. `"94"` para unidad). |
| `standard_code` | `string` | **Sí** | Código estándar adoptado (e.g. `"999"` contribuyente). |
| `taxes` | `array` | **Sí** | Array de impuestos. En Documento Soporte debe enviarse el código `"01"` (IVA). |
| `withholding_taxes` | `array` | No | Retenciones aplicadas en la fuente. |

---

### 📝 Ejemplo de Solicitud (JSON)
```json
{
  "reference_code": "AN-2026-0005",
  "support_document_number": "SEDS984000129",
  "correction_concept_code": "2",
  "created_time": "15:26:00",
  "payment_details": [
    {
      "payment_form": "1",
      "payment_method_code": "42",
      "reference_code": "pago-001",
      "amount": "119000.00"
    }
  ],
  "provider": {
    "identification_document_code": "31",
    "identification": "2343543",
    "dv": "7",
    "names": "Pepito Perez",
    "address": "calle 4",
    "country_code": "CO",
    "municipality_code": "68679"
  },
  "items": [
    {
      "code_reference": "12345",
      "name": "producto de prueba",
      "quantity": "2.00",
      "discount_rate": "0.00",
      "price": "50000.00",
      "unit_measure_code": "94",
      "standard_code": "999",
      "withholding_taxes": [
        {
          "code": "06",
          "rate": "3.50"
        }
      ],
      "taxes": [
        {
          "code": "01",
          "rate": "19.00"
        }
      ]
    }
  ]
}
```

> [!NOTE]
> Al igual que con facturas y notas de crédito, si recibes un `409 Conflict` indicando que ya existe un documento pendiente por enviar con la misma referencia, debes utilizar el endpoint de **Eliminar** y crear el documento nuevamente.

---

## <a name="eliminar"></a> 2. Eliminar Nota de Ajuste (No Validada)

Permite eliminar una nota de ajuste que contiene errores o no ha sido validada ante la DIAN.

### 🌍 Endpoints
| Entorno | Método | URL |
| :--- | :--- | :--- |
| **Sandbox** | `DELETE` | `https://api-sandbox.factus.com.co/v1/adjustment-notes/reference/{reference_code}` |
| **Producción** | `DELETE` | `https://api.factus.com.co/v1/adjustment-notes/reference/{reference_code}` |

#### Path Variables
* `reference_code`: Código de referencia único asignado por el ERP al crear la nota.

#### Ejemplo de Respuesta (status 200)
```json
{
  "status": "OK",
  "message": "Documento con código de referencia AN-2026-0005 eliminado con éxito"
}
```

---

## <a name="ver"></a> 3. Ver Nota de Ajuste

Devuelve la información técnica y de validación de una nota de ajuste mediante su número de documento.

### 🌍 Endpoints
| Entorno | Método | URL |
| :--- | :--- | :--- |
| **Sandbox** | `GET` | `https://api-sandbox.factus.com.co/v2/adjustment-notes/{number}` |
| **Producción** | `GET` | `https://api.factus.com.co/v2/adjustment-notes/{number}` |

#### Path Variables
* `number`: Número asignado a la Nota de Ajuste (ej: `NA1`).

---

## <a name="listar"></a> 4. Listar y Filtrar Notas de Ajuste

Obtiene un listado paginado y filtrable de las notas de ajuste registradas en la cuenta.

### 🌍 Endpoints
| Entorno | Método | URL |
| :--- | :--- | :--- |
| **Sandbox** | `GET` | `https://api-sandbox.factus.com.co/v2/adjustment-notes?page=1&filter[names]=...` |
| **Producción** | `GET` | `https://api.factus.com.co/v2/adjustment-notes?page=1&filter[names]=...` |

#### Filtros de Búsqueda Soportados
* `filter[identification]`: NIT/Identificación del proveedor.
* `filter[names]`: Nombre/Razón Social del proveedor.
* `filter[number]`: Número de la nota de ajuste (ej. `NA1`).
* `filter[prefix]`: Prefijo del rango de numeración.
* `filter[reference_code]`: Código de referencia del ERP.
* `filter[status]`: Estado de validación ante la DIAN (`1` = validado, `0` = sin validar).

---

## <a name="pdf"></a> 5. Descargar PDF en Base64

Permite descargar la representación gráfica de la Nota de Ajuste en formato Base64.

### 🌍 Endpoints
| Entorno | Método | URL |
| :--- | :--- | :--- |
| **Sandbox** | `GET` | `https://api-sandbox.factus.com.co/v2/adjustment-notes/{number}/download-pdf` |
| **Producción** | `GET` | `https://api.factus.com.co/v2/adjustment-notes/{number}/download-pdf` |

---

## <a name="nestjs"></a> 6. Implementación NestJS Completa

### 🏛️ Interfaces de Dominio (camelCase)
Se agregan a `factus-invoicing-gateway.interface.ts` en la capa de dominio:

```typescript
export interface FactusProvider {
  identificationDocumentCode: string;
  identification: string;
  dv?: string;
  tradeName?: string;
  names: string;
  address: string;
  countryCode: string;
  municipalityCode: string;
  email?: string;
  phone?: string;
}

export interface FactusAdjustmentNoteRequest {
  referenceCode: string;
  createdTime?: string;
  numberingRangeId?: number;
  supportDocumentNumber: string;
  correctionConceptCode: string;
  observation?: string;
  cashRoundingAmount?: string;
  paymentDetails: FactusPaymentDetail[];
  provider: FactusProvider;
  items: FactusItem[];
}

export interface FactusAdjustmentNoteResponseData {
  referenceCode: string;
  number: string;
  cuds: string;
  isValidated: boolean;
  validatedAt: string | null;
  createdAt: string;
  errors: string[];
  provider: {
    identification: string;
    names: string;
    email: string | null;
  };
  totals: {
    grossAmount: string;
    total: string;
  };
  links: {
    qr: string;
    publicUrl?: string;
  };
}

export interface FactusAdjustmentNoteResponse {
  status: string;
  message: string;
  data: FactusAdjustmentNoteResponseData;
}

export interface FactusPaginatedAdjustmentNotesResponse {
  data: any[];
  meta: {
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    from: number;
    to: number;
  };
}
```

#### Puertos del Gateway `IFactusInvoicingGateway`
Extiende la interfaz agregando los nuevos métodos para Notas de Ajuste:

```typescript
export interface IFactusInvoicingGateway {
  // ... métodos existentes de facturas y notas crédito ...

  createAdjustmentNote(adjustmentNote: FactusAdjustmentNoteRequest): Promise<FactusAdjustmentNoteResponse>;
  deleteAdjustmentNote(referenceCode: string): Promise<void>;
  getAdjustmentNote(number: string): Promise<FactusAdjustmentNoteResponseData>;
  listAdjustmentNotes(page?: number, filters?: Record<string, string>): Promise<FactusPaginatedAdjustmentNotesResponse>;
  downloadAdjustmentNotePdf(number: string): Promise<{ pdfBase64Encoded: string; fileName: string }>;
}
```

---

### 📥 DTO de Validación (`CreateFactusAdjustmentNoteDto`)
Ubicación lógica: `src/modules/factus/dtos/create-factus-adjustment-note.dto.ts`

```typescript
import {
  IsString, IsNotEmpty, IsOptional, IsNumber,
  IsArray, ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { FactusItemDto, FactusPaymentDetailDto } from './create-factus-invoice.dto';

export class FactusProviderDto {
  @IsString() @IsNotEmpty() identification_document_code: string;
  @IsString() @IsNotEmpty() identification: string;
  @IsString() @IsOptional() dv?: string;
  @IsString() @IsOptional() trade_name?: string;
  @IsString() @IsNotEmpty() names: string;
  @IsString() @IsNotEmpty() address: string;
  @IsString() @IsNotEmpty() country_code: string;
  @IsString() @IsNotEmpty() municipality_code: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
}

export class CreateFactusAdjustmentNoteDto {
  @IsString() @IsNotEmpty() reference_code: string;
  @IsString() @IsOptional() created_time?: string;
  @IsNumber() @IsOptional() numbering_range_id?: number;
  @IsString() @IsNotEmpty() support_document_number: string;
  @IsString() @IsNotEmpty() correction_concept_code: string;
  @IsString() @IsOptional() observation?: string;
  @IsString() @IsOptional() cash_rounding_amount?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FactusPaymentDetailDto)
  payment_details: FactusPaymentDetailDto[];

  @ValidateNested()
  @Type(() => FactusProviderDto)
  provider: FactusProviderDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FactusItemDto)
  items: FactusItemDto[];
}
```

---

### 🌍 Métodos del Adaptador HTTP (`FactusHttpInvoicingAdapter`)
Se implementan los mapeos de snake_case a camelCase en `factus-http-invoicing.adapter.ts`:

```typescript
async createAdjustmentNote(adjustmentNote: FactusAdjustmentNoteRequest): Promise<FactusAdjustmentNoteResponse> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();

  const payload = {
    reference_code: adjustmentNote.referenceCode,
    created_time: adjustmentNote.createdTime,
    numbering_range_id: adjustmentNote.numberingRangeId,
    support_document_number: adjustmentNote.supportDocumentNumber,
    correction_concept_code: adjustmentNote.correctionConceptCode,
    observation: adjustmentNote.observation,
    cash_rounding_amount: adjustmentNote.cashRoundingAmount,
    payment_details: adjustmentNote.paymentDetails.map(p => ({
      payment_form: p.paymentForm,
      payment_method_code: p.paymentMethodCode,
      amount: p.amount,
      reference_code: p.referenceCode,
      due_date: p.dueDate,
    })),
    provider: {
      identification_document_code: adjustmentNote.provider.identificationDocumentCode,
      identification: adjustmentNote.provider.identification,
      dv: adjustmentNote.provider.dv,
      trade_name: adjustmentNote.provider.tradeName,
      names: adjustmentNote.provider.names,
      address: adjustmentNote.provider.address,
      country_code: adjustmentNote.provider.countryCode,
      municipality_code: adjustmentNote.provider.municipalityCode,
      email: adjustmentNote.provider.email,
      phone: adjustmentNote.provider.phone,
    },
    items: adjustmentNote.items.map(item => ({
      code_reference: item.codeReference,
      name: item.name,
      quantity: item.quantity,
      discount_rate: item.discountRate,
      price: item.price,
      unit_measure_code: item.unitMeasureCode,
      standard_code: item.standardCode,
      taxes: item.taxes.map(t => ({ code: t.code, rate: t.rate, is_excluded: t.isExcluded })),
      ...(item.withholdingTaxes?.length && {
        withholding_taxes: item.withholdingTaxes.map(w => ({ code: w.code, rate: w.rate })),
      }),
    })),
  };

  try {
    const response$ = this.httpService.post(`${baseUrl}/v2/adjustment-notes/validate`, payload, {
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
        cuds: d.cuds,
        isValidated: d.is_validated,
        validatedAt: d.validated_at,
        createdAt: d.created_at,
        errors: d.errors || [],
        provider: d.provider ? {
          identification: d.provider.identification,
          names: d.provider.names,
          email: d.provider.email,
        } : null,
        totals: d.totals ? {
          grossAmount: d.totals.gross_amount,
          total: d.totals.total,
        } : null,
        links: { qr: d.links?.qr, publicUrl: d.links?.public_url },
      },
    };
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    const details = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : '';
    throw new Error(`Error emitiendo nota ajuste: ${msg}. ${details}`);
  }
}

async deleteAdjustmentNote(referenceCode: string): Promise<void> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  try {
    await firstValueFrom(
      this.httpService.delete(`${baseUrl}/v1/adjustment-notes/reference/${referenceCode}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
    );
  } catch (error) {
    throw new Error(`Error eliminando nota de ajuste ${referenceCode}: ${error.response?.data?.message || error.message}`);
  }
}

async getAdjustmentNote(number: string): Promise<FactusAdjustmentNoteResponseData> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const response = await firstValueFrom(
    this.httpService.get(`${baseUrl}/v2/adjustment-notes/${number}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    }),
  );
  const d = response.data.data;
  return {
    referenceCode: d.reference_code,
    number: d.number,
    cuds: d.cuds,
    isValidated: d.is_validated,
    validatedAt: d.validated_at,
    createdAt: d.created_at,
    errors: d.errors || [],
    provider: d.provider ? {
      identification: d.provider.identification,
      names: d.provider.names,
      email: d.provider.email,
    } : null,
    totals: d.totals ? {
      grossAmount: d.totals.gross_amount,
      total: d.totals.total,
    } : null,
    links: { qr: d.links?.qr, publicUrl: d.links?.public_url },
  };
}

async listAdjustmentNotes(page = 1, filters: Record<string, string> = {}): Promise<FactusPaginatedAdjustmentNotesResponse> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const response = await firstValueFrom(
    this.httpService.get(`${baseUrl}/v2/adjustment-notes`, {
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

async downloadAdjustmentNotePdf(number: string): Promise<{ pdfBase64Encoded: string; fileName: string }> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const response = await firstValueFrom(
    this.httpService.get(`${baseUrl}/v2/adjustment-notes/${number}/download-pdf`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    }),
  );
  return {
    pdfBase64Encoded: response.data.data.pdf_base_64_encoded,
    fileName: response.data.data.file_name,
  };
}
```

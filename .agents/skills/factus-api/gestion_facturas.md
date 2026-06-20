# 📋 Gestión de Facturas - Factus API

Este módulo cubre los 5 endpoints de administración y consulta de facturas electrónicas. Todos requieren el header `Authorization: Bearer <access_token>`.

---

## 🗑️ 1. Eliminar Factura (No Validada)

Elimina una factura del buffer local de Factus usando su `reference_code`. **Solo aplica a facturas no validadas ante la DIAN.** Su uso principal es resolver errores `409 Conflict`.

| | |
| :--- | :--- |
| **Método** | `DELETE` |
| **Sandbox** | `https://api-sandbox.factus.com.co/v2/bills/destroy/reference/{reference_code}` |
| **Producción** | `https://api.factus.com.co/v2/bills/destroy/reference/{reference_code}` |

### Path Variables
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `reference_code` | `string` | Código de referencia interna del ERP con el que se creó la factura. |

> [!CAUTION]
> Nunca llames a este endpoint sobre una factura con `is_validated: true`. Solo elimina documentos que están en estado pendiente (`is_validated: false`).

---

## 🔍 2. Ver Factura

Devuelve el detalle completo de una factura validada por su número consecutivo DIAN.

| | |
| :--- | :--- |
| **Método** | `GET` |
| **Sandbox** | `https://api-sandbox.factus.com.co/v2/bills/{number}` |
| **Producción** | `https://api.factus.com.co/v2/bills/{number}` |

### Path Variables
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `number` | `string` | Número consecutivo DIAN de la factura. Ej: `SETP-1234`. Retornado en `data.number` al momento de crear la factura. |

---

## 📋 3. Listar y Filtrar Facturas

Devuelve un listado paginado de facturas que cumplen los criterios especificados.

| | |
| :--- | :--- |
| **Método** | `GET` |
| **Sandbox** | `https://api-sandbox.factus.com.co/v2/bills` |
| **Producción** | `https://api.factus.com.co/v2/bills` |

### Query Params (Filtros)
| Parámetro | Tipo | Descripción |
| :--- | :--- | :--- |
| `page` | `integer` | Número de página. Default `1`. 10 resultados por página. |
| `filter[identification]` | `string` | NIT o cédula del adquiriente. |
| `filter[names]` | `string` | Nombre del adquiriente. |
| `filter[number]` | `string` | Número consecutivo DIAN de la factura. |
| `filter[prefix]` | `string` | Prefijo de la resolución DIAN (ej. `SETP`). |
| `filter[reference_code]` | `string` | Código de referencia interna del ERP. |
| `filter[status]` | `integer` | `1` = validada, `0` = pendiente por validar. |

### Estructura de Respuesta Paginada
```json
{
  "data": {
    "data": [ /* Array de facturas */ ],
    "total": 100,
    "per_page": 10,
    "current_page": 1,
    "last_page": 10,
    "from": 1,
    "to": 10,
    "links": { "first": "...", "last": "...", "prev": null, "next": "..." }
  }
}
```

> [!NOTE]
> Si el número de página solicitado no existe, el campo `data.data` retornará un array vacío `[]`.

---

## 📄 4. Descargar PDF (Base64)

Devuelve el PDF de la factura codificado en Base64 junto con el nombre del archivo.

| | |
| :--- | :--- |
| **Método** | `GET` |
| **Sandbox** | `https://api-sandbox.factus.com.co/v2/bills/{number}/download-pdf` |
| **Producción** | `https://api.factus.com.co/v2/bills/{number}/download-pdf` |

### Path Variables
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `number` | `string` | Número consecutivo DIAN de la factura. |

### Respuesta
```json
{
  "data": {
    "pdf_base_64_encoded": "JVBERi0xLjcKJeLjz9M...",
    "file_name": "SETP-1234.pdf"
  }
}
```

> [!TIP]
> Para guardar el PDF en el servidor o enviarlo al cliente, decodifica el campo `pdf_base_64_encoded` con `Buffer.from(base64, 'base64')` en Node.js/NestJS.

---

## 🔔 5. Eventos RADIAN de una Factura

Consulta el historial de eventos RADIAN (acuse de recibo, aceptación comercial, etc.) asociados a una factura validada ante la DIAN.

| | |
| :--- | :--- |
| **Método** | `GET` |
| **Sandbox** | `https://api-sandbox.factus.com.co/v2/bills/{number}/radian/events` |
| **Producción** | `https://api.factus.com.co/v2/bills/{number}/radian/events` |

### Path Variables
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `number` | `string` | Número consecutivo DIAN de la factura. |

### Estructura de Respuesta
```json
{
  "data": [
    {
      "number": "001",
      "cude": "abc123...",
      "event_code": "030",
      "event_name": "Acuse de Recibo",
      "effective_date": "2026-05-20",
      "effective_time": "14:30:00"
    }
  ]
}
```

### Códigos de Eventos RADIAN Comunes
| Código | Nombre |
| :--- | :--- |
| `030` | Acuse de Recibo |
| `031` | Reclamo |
| `032` | Recibo del Bien o Prestación del Servicio |
| `033` | Aceptación Expresa |
| `034` | Aceptación Tácita |

---

## 🏛️ Implementación NestJS

### Extensión del Puerto de Dominio
Agrega estos métodos a la interfaz `IFactusInvoicingGateway`:

```typescript
// Agregar en factus-invoicing-gateway.interface.ts

export interface FactusPaginationMeta {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  from: number;
  to: number;
}

export interface FactusPaginatedInvoicesResponse {
  data: FactusInvoiceResponseData[];
  meta: FactusPaginationMeta;
}

export interface FactusRadianEvent {
  number: string;
  cude: string;
  eventCode: string;
  eventName: string;
  effectiveDate: string;
  effectiveTime: string;
}

export interface IFactusInvoicingGateway {
  createInvoice(invoice: FactusInvoiceRequest): Promise<FactusInvoiceResponse>;
  deleteInvoice(referenceCode: string): Promise<void>;
  getInvoice(number: string): Promise<FactusInvoiceResponseData>;
  listInvoices(page?: number, filters?: Record<string, string>): Promise<FactusPaginatedInvoicesResponse>;
  downloadInvoicePdf(number: string): Promise<{ pdfBase64Encoded: string; fileName: string }>;
  getInvoiceEvents(number: string): Promise<FactusRadianEvent[]>;
}
```

### DTO de Filtros
`src/modules/factus/dtos/list-factus-invoices-query.dto.ts`
```typescript
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListFactusInvoicesQueryDto {
  @IsInt() @Min(1) @IsOptional() @Type(() => Number)
  page?: number = 1;

  @IsString() @IsOptional() 'filter[identification]'?: string;
  @IsString() @IsOptional() 'filter[names]'?: string;
  @IsString() @IsOptional() 'filter[number]'?: string;
  @IsString() @IsOptional() 'filter[prefix]'?: string;
  @IsString() @IsOptional() 'filter[reference_code]'?: string;
  @IsInt() @IsOptional() @Type(() => Number) 'filter[status]'?: number;
}
```

### Métodos del Adaptador HTTP
Extiende `FactusHttpInvoicingAdapter` con estos métodos:

```typescript
async deleteInvoice(referenceCode: string): Promise<void> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  try {
    const response$ = this.httpService.delete(
      `${baseUrl}/v2/bills/destroy/reference/${referenceCode}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    await firstValueFrom(response$);
  } catch (error) {
    throw new Error(`Error eliminando factura ${referenceCode}: ${error.response?.data?.message || error.message}`);
  }
}

async getInvoice(number: string): Promise<FactusInvoiceResponseData> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const response$ = this.httpService.get(`${baseUrl}/v2/bills/${number}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const response = await firstValueFrom(response$);
  return this.mapResponseToDomain({ status: '', message: '', data: response.data.data }).data;
}

async listInvoices(page = 1, filters: Record<string, string> = {}): Promise<FactusPaginatedInvoicesResponse> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const response$ = this.httpService.get(`${baseUrl}/v2/bills`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    params: { page, ...filters },
  });
  const response = await firstValueFrom(response$);
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

async downloadInvoicePdf(number: string): Promise<{ pdfBase64Encoded: string; fileName: string }> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const response$ = this.httpService.get(`${baseUrl}/v2/bills/${number}/download-pdf`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const response = await firstValueFrom(response$);
  return {
    pdfBase64Encoded: response.data.data.pdf_base_64_encoded,
    fileName: response.data.data.file_name,
  };
}

async getInvoiceEvents(number: string): Promise<FactusRadianEvent[]> {
  const baseUrl = this.configService.get<string>('FACTUS_API_URL');
  const token = await this.authGateway.getAccessToken();
  const response$ = this.httpService.get(`${baseUrl}/v2/bills/${number}/radian/events`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const response = await firstValueFrom(response$);
  return (response.data.data || []).map(e => ({
    number: e.number,
    cude: e.cude,
    eventCode: e.event_code,
    eventName: e.event_name,
    effectiveDate: e.effective_date,
    effectiveTime: e.effective_time,
  }));
}
```

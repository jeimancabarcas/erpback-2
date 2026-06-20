# Factus API Integration Skill

Esta Skill sirve como guía y referencia técnica definitiva para integrar e interactuar con la **Factus API** para facturación electrónica en el backend del ERP.

Para mantener la documentación clara y manejable, cada sección técnica se encuentra en un archivo dedicado. Consulta los módulos a continuación según la operación que necesites implementar.

---

## 🎯 Filosofía de Integración

Al integrar la API de Factus en nuestro backend desarrollado con NestJS, debemos guiarnos estrictamente por los principios de **Clean Architecture** y **Clean Code**:

1. **Independencia de la Capa de Infraestructura**: Todo el cliente HTTP de Factus API (incluyendo Axios/Fetch, endpoints y serializaciones propias de la API) debe pertenecer a la capa externa de infraestructura (Interface Adapters o Frameworks & Drivers).
2. **Puertos y Adaptadores (Ports & Adapters)**:
   - Definir interfaces (Puertos) en la capa de Casos de Uso/Negocio (ej. `IFactusInvoicingGateway`).
   - Implementar estas interfaces en adaptadores concretos (ej. `FactusHttpInvoicingAdapter`) que manejen los detalles de red y deserialización.
3. **Gestión de Configuración**: Las credenciales de Factus (`client_id`, `client_secret`, `username`, `password` y URLs base) se inyectarán exclusivamente a través del `ConfigService` de NestJS.
4. **Resiliencia y Cacheo de Tokens**: Dado que el Token de Acceso expira en **1 hora**, la arquitectura debe contemplar un mecanismo para almacenar en caché el token activo y refrescarlo automáticamente cuando esté cerca de expirar.
5. **Conversión snake_case → camelCase**: Todos los campos de la API externa (snake_case) se convierten a camelCase al cruzar la frontera hacia el dominio. Los adaptadores son los únicos responsables de esta transformación.

---

## 📚 Módulos de Referencia

| Módulo | Archivo | Descripción |
| :--- | :--- | :--- |
| 🔒 Autenticación OAuth2 | [autenticacion.md](autenticacion.md) | Flujo Password Grant, cacheo de tokens y adaptador NestJS |
| 🧾 Emisión de Facturas | [emision_facturas.md](emision_facturas.md) | Crear y validar facturas electrónicas ante la DIAN (`POST /v2/bills/validate`) |
| 📋 Gestión de Facturas | [gestion_facturas.md](gestion_facturas.md) | Ver, Eliminar, Listar, Descargar PDF y Eventos RADIAN de facturas |
| 📝 Notas de Crédito | [notas_credito.md](notas_credito.md) | Crear y validar notas de crédito ante la DIAN (`POST /v2/credit-notes/validate`) |
| 🛠️ Notas de Ajuste | [notas_ajuste.md](notas_ajuste.md) | Crear y validar notas de ajuste a documentos soporte ante la DIAN (`POST /v2/adjustment-notes/validate`) |

---

## 🏗️ Estructura de Módulo NestJS

La integración en el backend sigue esta estructura de directorios estándar:

```
src/modules/factus/
├── interfaces/
│   ├── factus-auth-gateway.interface.ts       # Puerto: Autenticación
│   └── factus-invoicing-gateway.interface.ts  # Puerto: Facturación, Notas Crédito y Ajuste
├── adapters/
│   ├── factus-http-auth.adapter.ts            # Adaptador HTTP: Autenticación
│   └── factus-http-invoicing.adapter.ts       # Adaptador HTTP: Facturación, Notas Crédito y Ajuste
├── dtos/
│   ├── create-factus-invoice.dto.ts           # DTO: Crear Factura
│   ├── create-factus-credit-note.dto.ts       # DTO: Crear Nota de Crédito
│   ├── create-factus-adjustment-note.dto.ts   # DTO: Crear Nota de Ajuste a Doc. Soporte
│   └── list-factus-invoices-query.dto.ts      # DTO: Filtros de Listado
└── factus.module.ts                           # Módulo NestJS
```

---

## ⚙️ Variables de Entorno Requeridas

```env
FACTUS_API_URL=https://api-sandbox.factus.com.co   # o https://api.factus.com.co en producción
FACTUS_CLIENT_ID=tu_client_id
FACTUS_CLIENT_SECRET=tu_client_secret
FACTUS_USERNAME=tu_username
FACTUS_PASSWORD=tu_password
```

> [!CAUTION]
> Nunca expongas estas credenciales en el código fuente. Usa siempre el `ConfigService` de NestJS para inyectarlas en los adaptadores de infraestructura.

# Especificación: invoice-electronic-emission-entity

## Propósito

Esta especificación describe la nueva entidad `InvoiceElectronicEmission` que persiste todos los campos de respuesta de Factus al emitir una factura electrónica. Reemplaza el campo único `factusNumber` — que descartaba el resto de la respuesta — por un registro completo de emisión con CUDE, URLs, validación, rangos de numeración y totales financieros.

---

## Requisitos

### Requisito: Nueva entidad InvoiceElectronicEmission

El sistema DEBE incluir una entidad TypeORM `InvoiceElectronicEmission` mapeada a la tabla `invoice_electronic_emissions` con los siguientes campos: `id` (UUID), `invoiceId`, `factusNumber`, `cude`, `qrUrl`, `publicUrl`, `isValidated`, `validatedAt`, `emittedAt`, `numberingRangePrefix`, `numberingRangeFrom`, `numberingRangeTo`, `numberingRangeResolution`, `total`, `taxAmount`, `rawResponse` (JSONB).

**Escenario: Todos los campos de Factus se persisten**
- DADO: una respuesta exitosa de Factus con todos los campos (`number`, `cude`, `qrUrl`, `publicUrl`, `isValidated`, `validatedAt`, `createdAt`, `numberingRange`, `totals`)
- CUANDO: `emit()` crea un `InvoiceElectronicEmission` con esos datos
- ENTONCES: cada campo de la respuesta Factus se almacena en la columna correspondiente de la entidad sin pérdida de información

**Escenario: Relación Invoice → Emission es OneToOne opcional**
- DADO: una factura sin emitir (no electrónica o no emitida aún)
- CUANDO: se consulta la entidad `Invoice` con su relación `emission`
- ENTONCES: `invoice.emission` es `null`
- Y: una factura electrónica emitida tiene `invoice.emission` poblado con los datos de emisión

**Escenario: Campos anidados de numberingRange se aplanan**
- DADO: la respuesta Factus incluye `numberingRange = { prefix: "SETP", from: 1, to: 1000, resolutionNumber: "Res123" }`
- CUANDO: se crea el registro de emisión
- ENTONCES: `numberingRangePrefix = "SETP"`, `numberingRangeFrom = 1`, `numberingRangeTo = 1000`, `numberingRangeResolution = "Res123"`

---

### Requisito: Migración de factusNumber existente

El sistema DEBE migrar todos los registros existentes con `factusNumber IS NOT NULL` a la nueva entidad `InvoiceElectronicEmission` antes de eliminar la columna `factusNumber`.

**Escenario: Migración crea emission para cada factusNumber existente**
- DADO: la tabla `invoices` contiene N filas con `factus_number` no nulo
- CUANDO: se ejecuta la migración de datos
- ENTONCES: la tabla `invoice_electronic_emissions` contiene N registros, cada uno vinculado a su invoice por `invoice_id`, con `factus_number` migrado

**Escenario: Facturas sin factusNumber no generan emission**
- DADO: una factura con `factus_number IS NULL`
- CUANDO: se ejecuta la migración
- ENTONCES: no se crea ningún registro de emisión para esa factura

**Escenario: Columna factusNumber se elimina post-migración**
- DADO: la migración de datos ha completado exitosamente
- CUANDO: se ejecuta la migración final
- ENTONCES: la columna `factus_number` es eliminada de la tabla `invoices` sin pérdida de datos

---

### Requisito: Descarga de PDF DIAN usa emission

`downloadDianPdf()` DEBE utilizar `emission.factusNumber` como identificador para la descarga del PDF desde Factus. Si la factura no tiene registro de emisión, DEBE retornar un error.

**Escenario: PDF se descarga usando emission.factusNumber**
- DADO: una factura con un registro `InvoiceElectronicEmission` donde `factusNumber = "SETP990003678"`
- CUANDO: se llama a `downloadDianPdf(id)`
- ENTONCES: se invoca `factusGateway.downloadInvoicePdf("SETP990003678")` y se retorna el PDF

**Escenario: Factura sin emission retorna error**
- DADO: una factura sin registro de emisión electrónica (ej: factura manual)
- CUANDO: se llama a `downloadDianPdf(id)`
- ENTONCES: el sistema retorna un error indicando que la factura no tiene emisión electrónica

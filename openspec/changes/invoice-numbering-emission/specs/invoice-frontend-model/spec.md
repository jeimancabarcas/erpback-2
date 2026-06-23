# Especificación: invoice-frontend-model

## Propósito

Esta especificación describe los cambios en el modelo frontend de `Invoice` para incorporar los nuevos campos `sequentialNumber` y `emission`, manteniendo total backward compatibility en el display de facturas existentes.

---

## Requisitos

### Requisito: Modelo Invoice incluye sequentialNumber

La interfaz `Invoice` en `src/app/models/invoice.model.ts` DEBE incluir el campo `sequentialNumber: number`.

**Escenario: sequentialNumber presente en respuesta API**
- DADO: la API retorna `{ ..., sequentialNumber: 42 }` para una factura
- CUANDO: el frontend deserializa la respuesta en el modelo `Invoice`
- ENTONCES: `invoice.sequentialNumber` es `42` sin errores de tipo TypeScript

---

### Requisito: Modelo Invoice incluye emission opcional

La interfaz `Invoice` DEBE incluir un campo `emission` opcional con la estructura: `{ factusNumber, cude, qrUrl, publicUrl, isValidated, validatedAt, emittedAt, total?, taxAmount? }`.

**Escenario: Factura emitida incluye emission**
- DADO: la API retorna una factura electrónica emitida con datos de emisión
- CUANDO: se deserializa la respuesta
- ENTONCES: `invoice.emission` contiene `factusNumber`, `cude`, `qrUrl`, `publicUrl`, `isValidated`, `validatedAt`, `emittedAt`

**Escenario: Factura no emitida tiene emission undefined**
- DADO: la API retorna una factura sin emisión electrónica
- CUANDO: se deserializa la respuesta
- ENTONCES: `invoice.emission` es `undefined`

**Escenario: Código existente que usaba factusNumber no se rompe**
- DADO: componentes que referenciaban `invoice.factusNumber`
- CUANDO: se actualiza el modelo
- ENTONCES: esas referencias DEBEN migrarse a `invoice.emission?.factusNumber` o el modelo DEBE proveer un getter temporal `get factusNumber()` que delegue en `emission?.factusNumber`

---

### Requisito: Display de invoiceNumber sin cambios visibles

La UI DEBE seguir mostrando `invoiceNumber` como identificador principal de la factura. El cambio a derivación desde `sequentialNumber` NO DEBE ser visible para el usuario.

**Escenario: Lista de facturas muestra invoiceNumber**
- DADO: la lista de facturas se renderiza en `SalesPageComponent`
- CUANDO: el usuario visualiza las filas
- ENTONCES: la columna de número de factura muestra `invoiceNumber` (ej: `"FAC-000042"` o `"MAN-000007"`) sin mostrar el `sequentialNumber`

**Escenario: Detalle de factura muestra invoiceNumber**
- DADO: el diálogo de detalle de factura se abre para una factura emitida
- CUANDO: el usuario visualiza el detalle
- ENTONCES: el número de factura principal es `invoiceNumber`, y los datos de emisión (`factusNumber`, `cude`) pueden mostrarse como información secundaria si el componente lo decide

---

### Requisito: Botón de emitir usa emission para decidir visibilidad

La condición para mostrar el botón "Emitir electrónicamente" DEBE usar `!inv.isElectronic && !inv.emission` en lugar de la condición anterior `!inv.isElectronic && !inv.factusNumber`.

**Escenario: Botón emitir visible cuando no hay emission**
- DADO: una factura electrónica sin emisión (`isElectronic = true`, `emission = undefined`)
- CUANDO: se renderiza el detalle de la factura
- ENTONCES: el botón "Emitir electrónicamente" es visible

**Escenario: Botón emitir oculto cuando ya hay emission**
- DADO: una factura electrónica con emisión (`emission` poblado)
- CUANDO: se renderiza el detalle
- ENTONCES: el botón "Emitir electrónicamente" NO es visible

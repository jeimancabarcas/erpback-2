# Especificación: factus-number-field

## Propósito

Invertir el default de `isElectronic` en la entidad `Invoice` de `true` a `false`, agregar el campo `factusNumber` nullable para almacenar el número de Factus en emisiones post-hoc, y actualizar las condiciones del service para que el default sea manual.

## Requisitos

---

### Requisito: Default de isElectronic invertido en entidad

La columna `is_electronic` en la entidad `Invoice` DEBE cambiar su default de `true` a `false`. La columna DEBE permanecer `NOT NULL`.

**Escenario: Nuevas facturas son manuales por defecto**
- DADO que la entidad Invoice se carga
- CUANDO se inspecciona el metadata de columna `is_electronic`
- ENTONCES el default es `false` (no `true`)

**Escenario: Migración actualiza el default**
- DADO una base de datos con el esquema actual (default `true`)
- CUANDO la migración `up()` se ejecuta
- ENTONCES la columna `is_electronic` mantiene datos existentes y nuevas filas usan default `false`

---

### Requisito: Nueva columna factusNumber nullable

La entidad `Invoice` DEBE incluir `factusNumber?: string` como columna nullable. Almacena el número oficial de Factus cuando una factura manual se emite post-hoc.

**Escenario: Columna factusNumber está presente**
- DADO que la entidad Invoice se carga
- CUANDO se inspecciona el metadata
- ENTONCES existe `factus_number` de tipo `varchar`, nullable

**Escenario: Invoice manual sin emitir tiene factusNumber null**
- DADO una factura manual sin emisión post-hoc
- CUANDO se consulta desde la base de datos
- ENTONCES `factusNumber` es `null`

---

### Requisito: Default invertido en SalesService.create()

`SalesService.create()` DEBE cambiar la condición de `isElectronic`:
- `createDto.isElectronic !== false` → `createDto.isElectronic === true`
- `createDto.isElectronic ?? true` → `createDto.isElectronic ?? false`

**Escenario: Request sin isElectronic crea factura manual**
- DADO un POST `/sales/invoices` sin el campo `isElectronic`
- CUANDO el service procesa el DTO
- ENTONCES `isElectronic` se trata como `false` y se genera número `MAN-xxxx`

**Escenario: Request con isElectronic: true crea factura electrónica**
- DADO un POST `/sales/invoices` con `"isElectronic": true`
- CUANDO el service procesa el DTO
- ENTONCES se ejecuta el flujo de Factus y se genera número electrónico

---

### Requisito: Numbering post-hoc preserva invoiceNumber original

Cuando una factura manual se emite post-hoc vía `emit()`, el número Factus DEBE guardarse en `factusNumber`. El `invoiceNumber` original (MAN-xxxx) NO DEBE modificarse.

**Escenario: Emisión post-hoc guarda número en factusNumber**
- DADO una factura manual con `invoiceNumber = "MAN-0001"`
- CUANDO `emit()` se ejecuta exitosamente
- ENTONCES `invoiceNumber` sigue siendo `"MAN-0001"`
- Y `factusNumber` contiene el número asignado por Factus (ej: `"SETP990003678"`)

---

### Fuera de Alcance

- Frontend logic for toggle and submission (cubierto en `invoice-creation`)
- Emit button in detail dialog (cubierto en `invoice-electronic-emission`)
- Invoice list badge or PDF behavior (sin cambios)
- Credit/debit note blocking for manual invoices (ya implementado)

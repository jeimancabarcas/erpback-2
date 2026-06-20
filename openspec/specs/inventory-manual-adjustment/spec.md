# Inventory Manual Adjustment Specification

## Purpose
Enables frontend capturing and movement logging for manual stock adjustments.

## Requirements

### Requirement: Capturing Adjustment Reason
The frontend MUST capture an optional `adjustmentReason` when the stock value is modified during product editing.

#### Scenario: Input adjustment reason on change
- GIVEN a product form with original stock 10
- WHEN the user edits the stock to 15
- THEN the form MUST prompt for and capture the `adjustmentReason`

### Requirement: Compiled Movements Logging
The system MUST include manual adjustments in compiled movements with origin/destination set to 'Ajuste de inventario'.

#### Scenario: Movement compilation for adjustments
- GIVEN a saved manual stock adjustment batch
- WHEN movements are compiled
- THEN the movement MUST show type In/Out and origin/destination as 'Ajuste de inventario'

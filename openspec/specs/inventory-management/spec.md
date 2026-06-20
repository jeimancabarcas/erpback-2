# Inventory Management Specification

## Purpose
Core inventory operations including product registration and baseline stock initialization.

## Requirements

### Requirement: Product Creation
The system MUST allow registering a new product with basic details.

#### Scenario: Register product with zero stock
- GIVEN a request to create a product with stock set to 0
- WHEN the creation is executed
- THEN the product is saved with currentStock 0 and no batches are created

### Requirement: Initial Stock Registration
The system MUST record initial stock and create a tracking batch when creating a product.
(Previously: Initial stock only saved the stock value on the product without creating a tracking batch.)

#### Scenario: Register product with initial stock
- GIVEN a product creation request with initial stock of 10
- WHEN the creation is executed
- THEN the product is saved with currentStock 10
- AND a batch is created with initialQuantity 10, purchasePrice 0, and adjustmentReason 'Stock Inicial'

### Requirement: Stock Difference Calculation
During updates, the system MUST compare new stock and old stock to determine the adjustment quantity.

#### Scenario: Calculate adjustment difference
- GIVEN a product with currentStock 10
- WHEN updating stock to 15
- THEN the system MUST compute a difference of +5

### Requirement: Positive Stock Adjustment
When the stock change is positive, the system MUST create a new batch at the current average purchase price with the user-provided reason.

#### Scenario: Handle positive stock change
- GIVEN a product with average purchase price 15.0 and stock change +5 with reason 'Auditoría'
- WHEN the update is executed
- THEN a new batch is created with initialQuantity 5, purchasePrice 15.0, and adjustmentReason 'Auditoría'

### Requirement: Negative Stock Adjustment
When the stock change is negative, the system MUST validate that total stock is sufficient, consume stock FIFO-style, prevent negative quantities, and save a tracking batch with negative quantity and the user reason.

#### Scenario: Handle negative stock change with sufficient stock
- GIVEN a product with stock 10, a batch with remaining stock 10, and stock change -4 with reason 'Pérdida'
- WHEN the update is executed
- THEN 4 units are consumed from the batch
- AND a tracking batch is saved with initialQuantity -4, remainingQuantity 0, and adjustmentReason 'Pérdida'

#### Scenario: Handle negative stock change with insufficient stock
- GIVEN a product with stock 3 and stock change -5
- WHEN the update is executed
- THEN the system MUST reject the adjustment and throw an error

# Tasks: Client Credit Portfolio

## Phase 1: Database Migrations
- [x] 1.1 Create TypeORM migration to add credit columns to customers table
- [x] 1.2 Create TypeORM migration to add ON_CREDIT to InvoiceStatus enum
- [x] 1.3 Create TypeORM migration to create payment_records table

## Phase 2: Backend Entities & DTOs
- [x] 2.1 Modify Customer entity with credit fields (creditLimit, currentBalance, paymentTermsDays, creditStatus)
- [x] 2.2 Add ON_CREDIT to InvoiceStatus enum in Invoice entity
- [x] 2.3 Create PaymentRecord entity
- [x] 2.4 Create DTOs: CustomerCreditDto, RecordPaymentDto, CreditPortfolioResponseDto, PaymentRecordDto

## Phase 3: Backend Services & Controllers
- [x] 3.1 Create CustomersCreditService with getCreditPortfolio(), setCreditLimit(), recordPayment(), getPaymentHistory()
- [x] 3.2 Add credit endpoints to CustomersController
- [x] 3.3 Modify SalesService.create() to set ON_CREDIT when paymentType = Crédito
- [x] 3.4 Extend getStats() with credit portfolio summary fields
- [x] 3.5 Register PaymentRecord entity and CustomersCreditService in CustomersModule

## Phase 4: Backend Tests
- [x] 4.1 Write unit tests for CustomersCreditService
- [x] 4.2 Write unit tests for SalesService ON_CREDIT behavior
- [x] 4.3 Write unit tests for getStats() extension
- [ ] 4.4 Write e2e tests for credit endpoints (deferred — requires DB)

## Phase 5: Frontend Models & Service
- [x] 5.1 Add credit fields to Customer model; add CreditPortfolio, RecordPaymentDto, PaymentRecord interfaces
- [x] 5.2 Add ON_CREDIT to InvoiceStatus type
- [x] 5.3 Add credit API methods to CustomerService

## Phase 6: Frontend Components
- [x] 6.1 Create CreditPortfolioOrganism
- [x] 6.2 Create RecordPaymentFormMolecule
- [x] 6.3 Create PaymentHistoryTableOrganism
- [x] 6.4 Modify SalesCustomerDetailPage to include credit section
- [x] 6.5 Add ON_CREDIT badge in invoice-detail-dialog and sales-page
- [x] 6.6 Add installments selection UI to sales form when payment type is Crédito
- [x] 6.7 Add installments field to backend Invoice entity and DTO

## Phase 7: Frontend Tests
- [x] 7.1 Write tests for CreditPortfolioOrganism
- [ ] 7.2 Write tests for RecordPaymentFormMolecule (deferred — requires Dialog infrastructure)
- [ ] 7.3 Write tests for CustomerService credit methods (deferred — frontend test infra incomplete)

### Known Gaps
- Task 4.4 (e2e tests): Deferred — requires running PostgreSQL DB
- Task 7.2 (RecordPaymentFormMolecule tests): Deferred — dialog infra dependency
- Task 7.3 (CustomerService credit methods tests): Deferred — frontend test infra incomplete

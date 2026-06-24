import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, Like, EntityManager } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceElectronicEmission } from './entities/invoice-electronic-emission.entity';
import { CreditNote } from './entities/credit-note.entity';
import { DebitNote } from './entities/debit-note.entity';
import { CreditNoteItem } from './entities/credit-note-item.entity';
import { DebitNoteItem } from './entities/debit-note-item.entity';
import { CreditNoteItemTax } from './entities/credit-note-item-tax.entity';
import { DebitNoteItemTax } from './entities/debit-note-item-tax.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { CreateSalesNoteDto } from './dto/create-sales-note.dto';
import { InventoryService } from '../inventory/inventory.service';
import { PdfGenerationService } from '../pdf-generation/pdf-generation.service';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { buildWhere } from '../../common/helpers/query.helper';
import {
  IFactusInvoicingGateway,
  FactusItem,
  FactusTax,
} from '../factus/interfaces/factus-invoicing-gateway.interface';
import { InvoiceItemTax } from './entities/invoice-item-tax.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../inventory/entities/product.entity';
import {
  ScenarioHandler,
  ScenarioParams,
  ScenarioResult,
} from './helpers/scenario-handler.interface';
import { ScenarioAHandler } from './helpers/scenario-a';
import { ScenarioBHandler } from './helpers/scenario-b';
import { ScenarioCHandler } from './helpers/scenario-c';
import { ScenarioDHandler } from './helpers/scenario-d';
import { ScenarioEHandler } from './helpers/scenario-e';
import { ScenarioFHandler } from './helpers/scenario-f';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(InvoiceElectronicEmission)
    private readonly invoiceEmissionRepository: Repository<InvoiceElectronicEmission>,
    @InjectRepository(CreditNote)
    private readonly creditNoteRepository: Repository<CreditNote>,
    @InjectRepository(DebitNote)
    private readonly debitNoteRepository: Repository<DebitNote>,
    @InjectRepository(CreditNoteItem)
    private readonly creditNoteItemRepository: Repository<CreditNoteItem>,
    @InjectRepository(DebitNoteItem)
    private readonly debitNoteItemRepository: Repository<DebitNoteItem>,
    @InjectRepository(CreditNoteItemTax)
    private readonly creditNoteItemTaxRepository: Repository<CreditNoteItemTax>,
    @InjectRepository(DebitNoteItemTax)
    private readonly debitNoteItemTaxRepository: Repository<DebitNoteItemTax>,
    @Inject('IFactusInvoicingGateway')
    private readonly factusGateway: any,
    private readonly inventoryService: InventoryService,
    private readonly pdfGenerationService: PdfGenerationService,
    private readonly dataSource: DataSource,
    // Scenario handlers (injected for DI)
    private readonly scenarioAHandler: ScenarioAHandler,
    private readonly scenarioBHandler: ScenarioBHandler,
    private readonly scenarioCHandler: ScenarioCHandler,
    private readonly scenarioDHandler: ScenarioDHandler,
    private readonly scenarioEHandler: ScenarioEHandler,
    private readonly scenarioFHandler: ScenarioFHandler,
  ) {
    this.buildScenarioMaps();
  }

  private creditScenarioMap: Record<string, ScenarioHandler> = {};
  private debitScenarioMap: Record<string, ScenarioHandler> = {};

  /**
   * Builds scenario handler lookup maps.
   * Credit note scenarios: codes 1-5 (A-D)
   *   - '1' / '5' → ScenarioA (partial return)
   *   - '3'       → ScenarioB (discount)
   *   - '4'       → ScenarioC (price correction / overcharge)
   *   - '2'       → ScenarioD (total annulment)
   * Debit note scenarios: codes 1-4 (E-F)
   *   - '1'       → ScenarioE (financial interest)
   *   - '2','3','4' → ScenarioF (undercharge correction)
   */
  private buildScenarioMaps(): void {
    // Credit note handler map
    this.creditScenarioMap['1'] = this.scenarioAHandler;
    this.creditScenarioMap['5'] = this.scenarioAHandler;
    this.creditScenarioMap['3'] = this.scenarioBHandler;
    this.creditScenarioMap['4'] = this.scenarioCHandler;
    this.creditScenarioMap['2'] = this.scenarioDHandler;

    // Debit note handler map
    this.debitScenarioMap['1'] = this.scenarioEHandler;
    this.debitScenarioMap['2'] = this.scenarioFHandler;
    this.debitScenarioMap['3'] = this.scenarioFHandler;
    this.debitScenarioMap['4'] = this.scenarioFHandler;
  }

  async create(createDto: CreateInvoiceDto): Promise<Invoice> {
    const { items, ...invoiceData } = createDto;

    if (!items || items.length === 0) {
      throw new BadRequestException(
        'La factura debe tener al menos un producto',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Cargar detalles del cliente
      const customer = await queryRunner.manager.findOne(Customer, {
        where: { id: invoiceData.customerId },
      });
      if (!customer) {
        throw new NotFoundException(
          `Cliente con ID ${invoiceData.customerId} no encontrado`,
        );
      }

      // 2. Calcular totales, verificar/consumir stock y preparar ítems de Factus
      const isElectronic = createDto.isElectronic === true;
      let totalAmount = 0;
      let factusTotalAmount = 0;
      const invoiceItems: InvoiceItem[] = [];
      const allItemsTaxData: Partial<InvoiceItemTax>[][] = [];
      const factusItems: FactusItem[] = [];

      for (const item of items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.productId },
          relations: ['taxes'],
        });
        if (!product) {
          throw new NotFoundException(
            `Producto con ID ${item.productId} no encontrado`,
          );
        }

        const unitPrice =
          item.unitPrice !== undefined
            ? Number(item.unitPrice)
            : Number(product.sellingPrice);

        const totalItemCost = await this.inventoryService.consumeStock(
          item.productId,
          item.quantity,
          queryRunner.manager,
        );
        const purchasePrice = totalItemCost / item.quantity;

        const subtotal = item.quantity * unitPrice;
        totalAmount += subtotal;

        // Cálculo dinámico de impuestos basado en product.taxes
        const taxes = product.taxes || [];
        const totalTaxRate = taxes.reduce(
          (sum, t) => sum + Number(t.percentage),
          0,
        );
        const priceBeforeTax =
          totalTaxRate > 0
            ? Number((unitPrice / (1 + totalTaxRate / 100)).toFixed(2))
            : unitPrice;

        let itemTaxAmount = 0;
        const invoiceItemTaxes: Partial<InvoiceItemTax>[] = [];
        const factusTaxes: FactusTax[] = [];

        for (const tax of taxes) {
          const taxAmt = Number(
            ((priceBeforeTax * Number(tax.percentage)) / 100).toFixed(2),
          );
          itemTaxAmount += taxAmt;
          invoiceItemTaxes.push({
            taxId: tax.id,
            taxCode: tax.code,
            taxName: tax.name,
            taxRate: Number(tax.percentage),
            taxAmount: taxAmt,
          });
          factusTaxes.push({
            code: tax.code,
            rate: Number(tax.percentage).toFixed(2),
            isExcluded: false,
          });
        }

        if (isElectronic) {
          const itemSubtotal = priceBeforeTax * item.quantity;
          const itemTaxTotal = itemTaxAmount * item.quantity;
          factusTotalAmount += itemSubtotal + itemTaxTotal;
        }

        invoiceItems.push(
          this.invoiceItemRepository.create({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice,
            purchasePrice,
            subtotal,
            taxAmount: itemTaxAmount,
          }),
        );

        allItemsTaxData.push(invoiceItemTaxes);

        factusItems.push({
          codeReference: product.sku || product.id,
          name: product.name,
          quantity: item.quantity,
          discountRate: 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes: factusTaxes,
        });
      }

      // 3. Para electrónicas, llamar Factus API primero
      let factusResponse: any = null;
      if (isElectronic) {
        const referenceCode = `FAC-REF-${Date.now()}`;

        const factusPayload = {
          referenceCode,
          paymentDetails: [
            {
              paymentForm: '1',
              paymentMethodCode: '10',
              amount: factusTotalAmount.toFixed(2),
            },
          ],
          customer: this.mapCustomerToFactus(customer),
          items: factusItems,
        };

        try {
          factusResponse =
            await this.factusGateway.createInvoice(factusPayload);
        } catch (error) {
          throw new BadRequestException(
            `Error al emitir Factura en Factus: ${error.message}`,
          );
        }
      }

      // 4. Crear la factura local (sin invoiceNumber inicial — se asigna tras obtener sequentialNumber)
      const invoice = this.invoiceRepository.create({
        ...invoiceData,
        date: invoiceData.date || new Date(),
        totalAmount,
        status: InvoiceStatus.PAID,
        isElectronic: createDto.isElectronic ?? false,
        items: invoiceItems,
      });
      const savedInvoice = await queryRunner.manager.save(invoice);

      // 5. Derivar invoiceNumber del sequentialNumber generado por la BD
      const prefix = savedInvoice.isElectronic ? 'FAC' : 'MAN';
      savedInvoice.invoiceNumber = `${prefix}-${String(savedInvoice.sequentialNumber).padStart(6, '0')}`;

      // 6. Guardar InvoiceItemTax para cada item (si tiene impuestos)
      for (let i = 0; i < savedInvoice.items.length; i++) {
        const savedItem = savedInvoice.items[i];
        const itemTaxes = allItemsTaxData[i];
        if (itemTaxes?.length) {
          for (const t of itemTaxes) {
            await queryRunner.manager.save(InvoiceItemTax, {
              invoiceItem: savedItem,
              taxId: t.taxId as string,
              taxCode: t.taxCode as string,
              taxName: t.taxName as string,
              taxRate: t.taxRate as number,
              taxAmount: t.taxAmount as number,
            });
          }
        }
      }

      // 7. Para electrónicas, crear la emisión
      if (isElectronic && factusResponse?.data) {
        const emission = this.invoiceEmissionRepository.create({
          invoice: savedInvoice,
          number: factusResponse.data.number,
          cude:
            factusResponse.data.cude || factusResponse.data.cufe || undefined,
          qrUrl: factusResponse.data.qrUrl || undefined,
          publicUrl: factusResponse.data.publicUrl || undefined,
          isValidated: factusResponse.data.isValidated ?? false,
          validatedAt: factusResponse.data.validatedAt
            ? (() => {
                const d = new Date(factusResponse.data.validatedAt);
                return isNaN(d.getTime()) ? undefined : d;
              })()
            : undefined,
          numberingRange: factusResponse.data.numberingRange || undefined,
          items: factusResponse.data.items || undefined,
          taxes: factusResponse.data.taxes || undefined,
          totals: factusResponse.data.totals || undefined,
          links: factusResponse.data.links || undefined,
        });
        savedInvoice.emission = await queryRunner.manager.save(emission);
      }

      await queryRunner.manager.save(savedInvoice);
      await queryRunner.commitTransaction();

      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error instanceof BadRequestException ||
        error instanceof NotFoundException
        ? error
        : new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async emit(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: [
        'customer',
        'items',
        'items.product',
        'items.product.taxes',
        'emission',
      ],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    if (invoice.isElectronic) {
      throw new BadRequestException('La factura ya es electrónica');
    }

    if (invoice.emission) {
      throw new BadRequestException(
        'La factura ya tiene una emisión registrada',
      );
    }

    // Build Factus payload from existing invoice data
    const factusItems: FactusItem[] = [];

    for (const item of invoice.items) {
      const unitPrice = Number(item.unitPrice);
      const taxes = item.product?.taxes || [];
      const totalTaxRate = taxes.reduce(
        (sum, t) => sum + Number(t.percentage),
        0,
      );
      const priceBeforeTax =
        totalTaxRate > 0
          ? Number((unitPrice / (1 + totalTaxRate / 100)).toFixed(2))
          : unitPrice;

      const factusTaxes: FactusTax[] = [];

      for (const tax of taxes) {
        factusTaxes.push({
          code: tax.code,
          rate: Number(tax.percentage).toFixed(2),
          isExcluded: false,
        });
      }

      factusItems.push({
        codeReference: item.product?.sku || item.productId,
        name: item.product?.name || 'Producto',
        quantity: Number(item.quantity),
        discountRate: 0,
        price: priceBeforeTax,
        unitMeasureCode: '94',
        standardCode: '999',
        taxes: factusTaxes,
      });
    }

    // Compute total the way DIAN/Factus likely does:
    // subtotal = SUM(price * qty)
    // tax = SUM(price * qty * rate/100) per tax
    // total = subtotal + sum(taxes), no intermediate rounding
    let subtotal = 0;
    const taxTotals: Record<string, number> = {};
    for (const fi of factusItems) {
      const price = Number(Number(fi.price).toFixed(2));
      const qty = Number(Number(fi.quantity).toFixed(2));
      subtotal += price * qty;
      for (const t of fi.taxes) {
        const rate = Number(t.rate) / 100;
        taxTotals[t.code] = (taxTotals[t.code] || 0) + price * qty * rate;
      }
    }
    const totalTax = Object.values(taxTotals).reduce((s, v) => s + v, 0);
    const factusTotalAmount = Number((subtotal + totalTax).toFixed(2));

    // Use stored reference code if available, otherwise generate a new one
    // Store it on the invoice so we can retry/destroy if Factus fails
    const referenceCode =
      invoice.factusReferenceCode ||
      `FAC-REF-${invoice.invoiceNumber || invoice.id}-${Date.now()}`;

    // Auth helper: call Factus, handle 409 with auto-cleanup + retry once
    const callFactusWithRetry = async (): Promise<any> => {
      try {
        return await this.factusGateway.createInvoice(factusPayload);
      } catch (error) {
        if (error.message?.includes('HTTP 409')) {
          // Destroy pending invoice using the stored reference code
          try {
            await this.factusGateway.destroyInvoice(referenceCode);
          } catch {
            // Could not destroy — will throw original 409
          }
          // Retry once (regardless of whether destroy succeeded)
          return await this.factusGateway.createInvoice(factusPayload);
        }
        throw error;
      }
    };

    const factusPayload = {
      referenceCode,
      paymentDetails: [
        {
          paymentForm: '1',
          paymentMethodCode: '10',
          amount: factusTotalAmount.toFixed(2),
        },
      ],
      customer: this.mapCustomerToFactus(invoice.customer),
      items: factusItems,
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Save reference code before calling Factus (so we can destroy on retry)
      if (!invoice.factusReferenceCode) {
        invoice.factusReferenceCode = referenceCode;
        await this.invoiceRepository.save(invoice);
      }

      const factusResponse =
        await callFactusWithRetry();

      // Create InvoiceElectronicEmission from full Factus response
      const emission = this.invoiceEmissionRepository.create({
        invoice,
        number: factusResponse.data.number,
        cude: factusResponse.data.cude || factusResponse.data.cufe || undefined,
        qrUrl: factusResponse.data.qrUrl || undefined,
        publicUrl: factusResponse.data.publicUrl || undefined,
        isValidated: factusResponse.data.isValidated ?? false,
        validatedAt: factusResponse.data.validatedAt
          ? (() => {
              const d = new Date(factusResponse.data.validatedAt);
              return isNaN(d.getTime()) ? undefined : d;
            })()
          : undefined,
        numberingRange: factusResponse.data.numberingRange || undefined,
        items: factusResponse.data.items || undefined,
        taxes: factusResponse.data.taxes || undefined,
        totals: factusResponse.data.totals || undefined,
        links: factusResponse.data.links || undefined,
      });

      invoice.isElectronic = true;
      invoice.emission = await queryRunner.manager.save(emission);
      await queryRunner.manager.save(invoice);

      // Persist InvoiceItemTax records for each item
      for (const item of invoice.items) {
        const taxes = item.product?.taxes || [];
        if (taxes.length === 0) continue;

        const unitPrice = Number(item.unitPrice);
        const totalTaxRate = taxes.reduce(
          (sum, t) => sum + Number(t.percentage),
          0,
        );
        const priceBeforeTax =
          totalTaxRate > 0
            ? Number((unitPrice / (1 + totalTaxRate / 100)).toFixed(2))
            : unitPrice;

        let itemTaxAmount = 0;
        for (const tax of taxes) {
          const taxAmt = Number(
            ((priceBeforeTax * Number(tax.percentage)) / 100).toFixed(2),
          );
          itemTaxAmount += taxAmt;
          await queryRunner.manager.save(InvoiceItemTax, {
            invoiceItem: item,
            taxId: tax.id,
            taxCode: tax.code,
            taxName: tax.name,
            taxRate: Number(tax.percentage),
            taxAmount: taxAmt,
          });
        }

        if (item.taxAmount !== itemTaxAmount) {
          item.taxAmount = itemTaxAmount;
          await queryRunner.manager.save(item);
        }
      }

      await queryRunner.commitTransaction();

      return invoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        `Error al emitir Factura en Factus: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(queryDto: QueryInvoicesDto): Promise<PaginatedResult<Invoice>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
    } = queryDto;
    const skip = (page - 1) * limit;

    const where = buildWhere(
      queryDto,
      ['invoiceNumber'],
      ['customerId', 'status'],
    );

    if (queryDto.isElectronic !== undefined) {
      where.isElectronic = queryDto.isElectronic;
    }

    const [data, total] = await this.invoiceRepository.findAndCount({
      where,
      order: { [sortBy]: order },
      take: limit,
      skip,
      relations: [
        'customer',
        'items',
        'items.product',
        'creditNotes',
        'debitNotes',
        'emission',
      ],
    });

    const enriched = data.map((inv) => {
      const creditSum = (inv.creditNotes ?? []).reduce(
        (acc, cn) => acc + Number(cn.amount),
        0,
      );
      const debitSum = (inv.debitNotes ?? []).reduce(
        (acc, dn) => acc + Number(dn.amount),
        0,
      );
      return {
        ...inv,
        netTotal: Number(inv.totalAmount) - creditSum + debitSum,
      };
    });

    return {
      data: enriched,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
        limit,
      },
    };
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: [
        'customer',
        'items',
        'items.product',
        'items.invoiceItemTaxes',
        'emission',
      ],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    return invoice;
  }

  async getFinancialStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const firstDayCurrent = new Date(currentYear, currentMonth, 1);
    const lastDayCurrent = new Date(
      currentYear,
      currentMonth + 1,
      0,
      23,
      59,
      59,
    );

    const firstDayPrev = new Date(currentYear, currentMonth - 1, 1);
    const lastDayPrev = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const currentMonthInvoices = await this.invoiceRepository.find({
      where: {
        date: Between(firstDayCurrent, lastDayCurrent),
        status: InvoiceStatus.PAID,
      },
      relations: ['items'],
    });

    const prevMonthInvoices = await this.invoiceRepository.find({
      where: {
        date: Between(firstDayPrev, lastDayPrev),
        status: InvoiceStatus.PAID,
      },
      relations: ['items'],
    });

    const calculateProfit = (invoices: Invoice[]) => {
      let totalSales = 0;
      let totalCost = 0;

      for (const inv of invoices) {
        totalSales += Number(inv.totalAmount);
        for (const item of inv.items) {
          totalCost += Number(item.purchasePrice || 0) * Number(item.quantity);
        }
      }

      return {
        totalSales,
        totalCost,
        profit: totalSales - totalCost,
      };
    };

    const currentStats = calculateProfit(currentMonthInvoices);
    const prevStats = calculateProfit(prevMonthInvoices);

    const profitDiff = currentStats.profit - prevStats.profit;
    const profitPercentage =
      prevStats.profit > 0
        ? (profitDiff / prevStats.profit) * 100
        : currentStats.profit > 0
          ? 100
          : 0;

    return {
      currentMonth: currentStats,
      previousMonth: prevStats,
      comparison: {
        difference: profitDiff,
        percentage: Number(profitPercentage.toFixed(2)),
        trend: profitDiff >= 0 ? 'UP' : 'DOWN',
      },
    };
  }

  private mapCustomerToFactus(customer: any) {
    let identificationDocumentCode = '13'; // CC
    let legalOrganizationCode = '2'; // Persona Natural

    if (customer.documentType === 'NIT') {
      identificationDocumentCode = '31';
      legalOrganizationCode = '1';
    } else if (customer.documentType === 'CE') {
      identificationDocumentCode = '22';
    } else if (customer.documentType === 'PP') {
      identificationDocumentCode = '41';
    }

    return {
      identificationDocumentCode,
      identification: customer.documentNumber,
      legalOrganizationCode,
      names: customer.name,
      address: customer.address || 'calle 1 # 1-1',
      email: customer.email || 'cliente@correo.com',
      phone: customer.phone || '1234567890',
      municipalityCode: '68679', // Sandbox default DIAN municipality
    };
  }

  /**
   * Guard: rejects electronic adjustment notes for manual invoices.
   * Called immediately after isElectronicNote resolution in both
   * createCreditNote() and createDebitNote().
   */
  private validateNoteElectronicStatus(
    isElectronicNote: boolean,
    invoice: Invoice,
  ): void {
    if (isElectronicNote && !invoice.isElectronic) {
      throw new BadRequestException(
        'Las notas de ajuste electrónicas solo pueden emitirse para facturas electrónicas',
      );
    }
  }

  private async getNextManualNoteNumber(
    queryRunner: any,
    invoice: Invoice,
    prefix: 'NC-MAN' | 'ND-MAN',
  ): Promise<string> {
    const entityClass = prefix === 'NC-MAN' ? CreditNote : DebitNote;
    const count = await queryRunner.manager.count(entityClass, {
      where: { invoiceId: invoice.id, noteNumber: Like(`${prefix}-%`) },
    });
    const seq = count + 1;
    return `${prefix}-${invoice.invoiceNumber}-${seq}`;
  }

  /**
   * Validates that the new credit note does not exceed the invoice cumulative limits.
   *
   * Amount check (ALL scenarios): existing credit note amounts + new note amount
   * must not exceed invoice.totalAmount.
   *
   * Per-product quantity check (scenarios A/D only — codes '1','5','2'):
   * existing credit note item quantities per productId + new note quantity
   * must not exceed the original invoice item quantity.
   */
  private async validateCumulativeLimits(
    invoice: Invoice,
    dto: CreateSalesNoteDto,
    manager: EntityManager,
  ): Promise<void> {
    // --- Amount check (all scenarios) ---
    const amountResult = await manager
      .createQueryBuilder(CreditNote, 'cn')
      .select('COALESCE(SUM(cn.amount), 0)', 'total')
      .where('cn.invoiceId = :invoiceId', { invoiceId: invoice.id })
      .getRawOne<{ total: string }>();

    const existingAmount = Number(amountResult?.total ?? 0);

    // Scenario D (code '2' — total annulment) is not allowed if any credit notes already exist
    if (dto.correctionConceptCode === '2' && existingAmount > 0) {
      throw new BadRequestException(
        'No se puede emitir una anulación total cuando ya existen notas de crédito parciales para esta factura',
      );
    }

    // Compute new note amount from DTO items matched to invoice items
    let newNoteAmount = 0;
    for (const dtoItem of dto.items || []) {
      const invoiceItem = invoice.items.find(
        (ii) =>
          ii.productId === dtoItem.productId ||
          ii.product?.sku === dtoItem.codeReference,
      );
      if (!invoiceItem) continue;
      const unitPrice = dtoItem.price ?? Number(invoiceItem.unitPrice);
      newNoteAmount += dtoItem.quantity * unitPrice;
    }

    if (existingAmount + newNoteAmount > Number(invoice.totalAmount)) {
      throw new BadRequestException(
        `El monto acumulado de notas de crédito (${existingAmount + newNoteAmount}) supera el total de la factura (${invoice.totalAmount})`,
      );
    }

    // --- Per-product quantity check (A/D only: codes '1','5','2') ---
    if (
      dto.correctionConceptCode &&
      ['1', '5', '2'].includes(dto.correctionConceptCode)
    ) {
      const qtyResults = await manager
        .createQueryBuilder(CreditNoteItem, 'cni')
        .select('cni.productId', 'productId')
        .addSelect('COALESCE(SUM(cni.quantity), 0)', 'totalQty')
        .innerJoin(CreditNote, 'cn', 'cn.id = cni.creditNoteId')
        .where('cn.invoiceId = :invoiceId', { invoiceId: invoice.id })
        .andWhere('cni.productId IS NOT NULL')
        .groupBy('cni.productId')
        .getRawMany<{ productId: string; totalQty: string }>();

      for (const dtoItem of dto.items || []) {
        if (!dtoItem.productId) continue;

        const existingQtyResult = qtyResults.find(
          (q) => q.productId === dtoItem.productId,
        );
        const existingQty = existingQtyResult
          ? Number(existingQtyResult.totalQty)
          : 0;

        const invoiceItem = invoice.items.find(
          (ii) =>
            ii.productId === dtoItem.productId ||
            ii.product?.sku === dtoItem.codeReference,
        );
        if (!invoiceItem) continue;

        if (existingQty + dtoItem.quantity > invoiceItem.quantity) {
          throw new BadRequestException(
            `La cantidad acumulada del producto ${dtoItem.productId} (${existingQty + dtoItem.quantity}) supera la cantidad facturada (${invoiceItem.quantity})`,
          );
        }
      }
    }
  }

  /**
   * Processes a credit note using the appropriate scenario handler.
   * Shared by both manual and electronic paths.
   */
  private async processCreditNoteWithHandler(
    invoice: Invoice,
    dto: CreateSalesNoteDto,
    handler: ScenarioHandler,
    isElectronic: boolean,
  ): Promise<CreditNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate cumulative limits before executing handler
      await this.validateCumulativeLimits(invoice, dto, queryRunner.manager);

      // Execute the scenario handler
      const params: ScenarioParams = {
        invoice,
        dto,
        queryRunner: queryRunner.manager,
        factusGateway: isElectronic ? this.factusGateway : undefined,
      };
      const result: ScenarioResult = await handler.execute(params);

      let noteNumber: string | null = null;
      let cude: string | null = null;
      let qrUrl: string | null = null;
      let publicUrl: string | null = null;
      const referenceCode = `NC-${invoice.invoiceNumber}-${Date.now()}`;

      if (isElectronic) {
        // --- Electronic path: build Factus payload and call gateway ---
        const factusItems = result.factusItems || [];

        const factusPayload = {
          referenceCode,
          correctionConceptCode: dto.correctionConceptCode,
          billNumber: dto.billNumber || invoice.invoiceNumber,
          numberingRangeId: dto.numberingRangeId,
          observation: dto.observation || 'Anulación / Corrección de factura',
          paymentDetails: [
            {
              paymentForm: '1',
              paymentMethodCode: '10',
              amount: result.totalAmount.toFixed(2),
            },
          ],
          customer: this.mapCustomerToFactus(invoice.customer),
          items: factusItems,
        };

        let factusResponse: any;
        try {
          factusResponse =
            await this.factusGateway.createCreditNote(factusPayload);
        } catch (error) {
          throw new BadRequestException(
            `Error al emitir Nota de Crédito en Factus: ${error.message}`,
          );
        }

        noteNumber = factusResponse.data.number || `NC-PEND-${Date.now()}`;
        cude = factusResponse.data.cude || null;
        qrUrl =
          factusResponse.data.qrUrl || factusResponse.data.links?.qr || null;
        publicUrl =
          factusResponse.data.publicUrl ||
          factusResponse.data.links?.publicUrl ||
          null;
      } else {
        // --- Manual path: generate sequential note number ---
        noteNumber = await this.getNextManualNoteNumber(
          queryRunner,
          invoice,
          'NC-MAN',
        );
      }

      // Create and save the CreditNote entity
      const creditNote = this.creditNoteRepository.create({
        referenceCode,
        noteNumber,
        cude,
        correctionConceptCode: dto.correctionConceptCode,
        amount: result.totalAmount,
        observation: dto.observation,
        qrUrl,
        publicUrl,
        invoiceId: invoice.id,
      });

      const savedNote = await queryRunner.manager.save(creditNote);

      // Create and save CreditNoteItem + CreditNoteItemTax records
      for (const item of result.items) {
        const createdItem = await queryRunner.manager.save(CreditNoteItem, {
          creditNoteId: savedNote.id,
          codeReference: item.codeReference,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          productId: item.productId,
          purchasePrice: item.purchasePrice,
          taxAmount: item.taxAmount,
          restored: item.restored ?? false,
        });

        // Save tax breakdown for this item
        if (item.noteItemTaxes && item.noteItemTaxes.length > 0) {
          for (const t of item.noteItemTaxes) {
            await queryRunner.manager.save(CreditNoteItemTax, {
              creditNoteItemId: createdItem.id,
              taxId: t.taxId || undefined,
              taxCode: t.taxCode,
              taxName: t.taxName,
              taxRate: t.taxRate,
              taxAmount: t.taxAmount,
            });
          }
        }
      }

      // Update invoice status if the handler specified a change
      if (result.updatedInvoiceStatus) {
        invoice.status = result.updatedInvoiceStatus as InvoiceStatus;
        await queryRunner.manager.save(invoice);
      }

      await queryRunner.commitTransaction();

      // Reload the saved note with items for the return value
      return this.creditNoteRepository.findOne({
        where: { id: savedNote.id },
        relations: ['items'],
      }) as Promise<CreditNote>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(
            `Error al crear nota de crédito: ${error.message}`,
          );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Processes a debit note using the appropriate scenario handler.
   * Shared by both manual and electronic paths.
   */
  private async processDebitNoteWithHandler(
    invoice: Invoice,
    dto: CreateSalesNoteDto,
    handler: ScenarioHandler,
    isElectronic: boolean,
  ): Promise<DebitNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Execute the scenario handler
      const params: ScenarioParams = {
        invoice,
        dto,
        queryRunner: queryRunner.manager,
        factusGateway: isElectronic ? this.factusGateway : undefined,
      };
      const result: ScenarioResult = await handler.execute(params);

      let noteNumber: string | null = null;
      let cude: string | null = null;
      let qrUrl: string | null = null;
      let publicUrl: string | null = null;
      const referenceCode = `ND-${invoice.invoiceNumber}-${Date.now()}`;

      if (isElectronic) {
        // --- Electronic path: build Factus payload and call gateway ---
        const factusItems = result.factusItems || [];

        const factusPayload = {
          referenceCode,
          correctionConceptCode: dto.correctionConceptCode,
          billNumber: dto.billNumber || invoice.invoiceNumber,
          numberingRangeId: dto.numberingRangeId,
          observation: dto.observation || 'Nota Débito por intereses o ajuste',
          paymentDetails: [
            {
              paymentForm: '1',
              paymentMethodCode: '10',
              amount: result.totalAmount.toFixed(2),
            },
          ],
          customer: this.mapCustomerToFactus(invoice.customer),
          items: factusItems,
        };

        let factusResponse: any;
        try {
          factusResponse =
            await this.factusGateway.createDebitNote(factusPayload);
        } catch (error) {
          throw new BadRequestException(
            `Error al emitir Nota de Débito en Factus: ${error.message}`,
          );
        }

        noteNumber = factusResponse.data.number || `ND-PEND-${Date.now()}`;
        cude = factusResponse.data.cude || null;
        qrUrl =
          factusResponse.data.qrUrl || factusResponse.data.links?.qr || null;
        publicUrl =
          factusResponse.data.publicUrl ||
          factusResponse.data.links?.publicUrl ||
          null;
      } else {
        // --- Manual path: generate sequential note number ---
        noteNumber = await this.getNextManualNoteNumber(
          queryRunner,
          invoice,
          'ND-MAN',
        );
      }

      // Create and save the DebitNote entity
      const debitNote = this.debitNoteRepository.create({
        referenceCode,
        noteNumber,
        cude,
        correctionConceptCode: dto.correctionConceptCode,
        amount: result.totalAmount,
        observation: dto.observation,
        qrUrl,
        publicUrl,
        invoiceId: invoice.id,
      });

      const savedNote = await queryRunner.manager.save(debitNote);

      // Create and save DebitNoteItem + DebitNoteItemTax records
      for (const item of result.items) {
        const createdItem = await queryRunner.manager.save(DebitNoteItem, {
          debitNoteId: savedNote.id,
          codeReference: item.codeReference,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          productId: item.productId,
          purchasePrice: item.purchasePrice,
          taxAmount: item.taxAmount,
        });

        // Save tax breakdown for this item
        if (item.noteItemTaxes && item.noteItemTaxes.length > 0) {
          for (const t of item.noteItemTaxes) {
            await queryRunner.manager.save(DebitNoteItemTax, {
              debitNoteItemId: createdItem.id,
              taxId: t.taxId || undefined,
              taxCode: t.taxCode,
              taxName: t.taxName,
              taxRate: t.taxRate,
              taxAmount: t.taxAmount,
            });
          }
        }
      }

      // Update invoice status if the handler specified a change
      if (result.updatedInvoiceStatus) {
        invoice.status = result.updatedInvoiceStatus as InvoiceStatus;
        await queryRunner.manager.save(invoice);
      }

      await queryRunner.commitTransaction();

      // Reload the saved note with items for the return value
      return this.debitNoteRepository.findOne({
        where: { id: savedNote.id },
        relations: ['items'],
      }) as Promise<DebitNote>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(
            `Error al crear nota de débito: ${error.message}`,
          );
    } finally {
      await queryRunner.release();
    }
  }

  async createCreditNote(
    invoiceId: string,
    dto: CreateSalesNoteDto,
  ): Promise<CreditNote> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: [
        'customer',
        'items',
        'items.product',
        'items.invoiceItemTaxes',
      ],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        'No se pueden crear notas de crédito para facturas anuladas',
      );
    }

    // --- Determinar si la nota es electrónica ---
    const isElectronicNote = dto.isElectronic ?? invoice.isElectronic;

    // Guard: reject electronic note for manual invoice
    this.validateNoteElectronicStatus(isElectronicNote, invoice);

    // --- Route to scenario handler ---
    const handler = this.creditScenarioMap[dto.correctionConceptCode];
    if (!handler) {
      throw new BadRequestException(
        `Concepto de corrección inválido para nota de crédito: ${dto.correctionConceptCode}`,
      );
    }

    return this.processCreditNoteWithHandler(
      invoice,
      dto,
      handler,
      isElectronicNote,
    );
  }

  async createDebitNote(
    invoiceId: string,
    dto: CreateSalesNoteDto,
  ): Promise<DebitNote> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: [
        'customer',
        'items',
        'items.product',
        'items.invoiceItemTaxes',
      ],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
    }

    // --- Determinar si la nota es electrónica ---
    const isElectronicNote = dto.isElectronic ?? invoice.isElectronic;

    // Guard: reject electronic note for manual invoice
    this.validateNoteElectronicStatus(isElectronicNote, invoice);

    // --- Route to scenario handler ---
    const handler = this.debitScenarioMap[dto.correctionConceptCode];
    if (!handler) {
      throw new BadRequestException(
        `Concepto de corrección inválido para nota de débito: ${dto.correctionConceptCode}`,
      );
    }

    return this.processDebitNoteWithHandler(
      invoice,
      dto,
      handler,
      isElectronicNote,
    );
  }

  async findNotesByInvoice(invoiceId: string) {
    const creditNotes = await this.creditNoteRepository.find({
      where: { invoiceId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });

    const debitNotes = await this.debitNoteRepository.find({
      where: { invoiceId },
      order: { createdAt: 'DESC' },
    });

    return {
      creditNotes,
      debitNotes,
    };
  }

  async findAllNotes() {
    const creditNotes = await this.creditNoteRepository.find({
      relations: ['invoice', 'invoice.customer'],
      order: { createdAt: 'DESC' },
    });

    const debitNotes = await this.debitNoteRepository.find({
      relations: ['invoice', 'invoice.customer'],
      order: { createdAt: 'DESC' },
    });

    return {
      creditNotes,
      debitNotes,
    };
  }

  async downloadInvoicePdf(
    id: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['customer', 'items', 'items.product'],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    const creditNotes = await this.creditNoteRepository.find({
      where: { invoiceId: id },
      relations: ['items'],
      order: { createdAt: 'ASC' },
    });

    const debitNotes = await this.debitNoteRepository.find({
      where: { invoiceId: id },
      relations: ['items'],
      order: { createdAt: 'ASC' },
    });

    try {
      const pdfBase64Encoded =
        await this.pdfGenerationService.generateInvoicePdf(
          invoice,
          creditNotes,
          debitNotes,
        );
      const fileName = `${invoice.invoiceNumber}-historial.pdf`;
      return { pdfBase64Encoded, fileName };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al generar el PDF: ${error.message}`,
      );
    }
  }

  async downloadDianPdf(
    id: string,
  ): Promise<{ pdfBase64Encoded: string; fileName: string }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['emission'],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    if (!invoice.isElectronic) {
      throw new BadRequestException(
        'Las facturas manuales no tienen PDF de la DIAN',
      );
    }

    if (!invoice.emission?.number) {
      throw new BadRequestException(
        'La factura no tiene un número de emisión oficial asignado',
      );
    }

    const emissionNumber = invoice.emission.number;
    return this.factusGateway.downloadInvoicePdf(emissionNumber);
  }

  /**
   * Cancela/elimina una factura pendiente en Factus usando el reference_code.
   * Solo funciona para facturas NO validadas por DIAN.
   * @param referenceCode El reference_code usado al crear la factura en Factus.
   * Si no se provee, intenta con FAC-REF-{invoiceNumber}-{timestamp}.
   */
  async cancelFactusInvoice(
    invoiceId: string,
    referenceCode?: string,
  ): Promise<{ status: string; message: string }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
    }

    // Use provided code, stored code, or fallback patterns
    const codesToTry = referenceCode
      ? [referenceCode]
      : invoice.factusReferenceCode
        ? [invoice.factusReferenceCode]
        : [
            `FAC-REF-${invoice.invoiceNumber || invoice.id}`,
          ];

    for (const code of codesToTry) {
      try {
        const result = await this.factusGateway.destroyInvoice(code);
        // Reset invoice electronic status so it can be re-emitted
        invoice.isElectronic = false;
        invoice.factusReferenceCode = undefined;
        await this.invoiceRepository.save(invoice);
        return result;
      } catch {
        continue;
      }
    }
    throw new BadRequestException(
      'No se pudo cancelar la factura en Factus. Verifica el reference_code o cancélala manualmente desde el panel de Factus.',
    );
  }

  async downloadAdjustmentNotePdf(
    id: string,
    type: 'Credit' | 'Debit',
  ): Promise<{ pdfBase64Encoded: string; fileName: string }> {
    let note: any;
    let invoice: any;

    if (type === 'Credit') {
      note = await this.creditNoteRepository.findOne({
        where: { id },
        relations: [
          'invoice',
          'invoice.customer',
          'items',
          'items.noteItemTaxes',
        ],
      });
      if (!note) {
        throw new NotFoundException(
          `Nota de crédito con ID ${id} no encontrada`,
        );
      }
      invoice = note.invoice;
    } else {
      note = await this.debitNoteRepository.findOne({
        where: { id },
        relations: [
          'invoice',
          'invoice.customer',
          'items',
          'items.noteItemTaxes',
        ],
      });
      if (!note) {
        throw new NotFoundException(
          `Nota de débito con ID ${id} no encontrada`,
        );
      }
      invoice = note.invoice;
    }

    const noteNumber = note.noteNumber;
    const isMock =
      !noteNumber ||
      noteNumber.startsWith('NC-PEND-') ||
      noteNumber.startsWith('ND-PEND-') ||
      !note.cude;

    if (!isMock) {
      try {
        return await this.factusGateway.downloadAdjustmentNotePdf(noteNumber);
      } catch (error) {
        // Log the error and fall back to the beautifully generated simulated PDF
        console.warn(
          `Factus PDF download failed for note ${noteNumber}, falling back to simulated PDF:`,
          error.message,
        );
      }
    }

    // Generate high-quality simulated PDF as a fallback
    const pdfBase64 = this.generateSimulatedNotePdfBase64(note, invoice, type);
    const fileName = `${noteNumber || note.referenceCode || note.id}.pdf`;

    return {
      pdfBase64Encoded: pdfBase64,
      fileName,
    };
  }

  private generateSimulatedNotePdfBase64(
    note: any,
    invoice: any,
    type: 'Credit' | 'Debit',
  ): string {
    const docType =
      type === 'Credit'
        ? 'NOTA CREDITO ELECTRONICA'
        : 'NOTA DEBITO ELECTRONICA';
    const number = note.noteNumber || note.referenceCode || note.id;
    const dateStr = note.createdAt
      ? new Date(note.createdAt).toLocaleDateString()
      : new Date().toLocaleDateString();
    const customerName = invoice?.customer?.name || 'Cliente Desconocido';
    const customerTaxId = invoice?.customer?.documentNumber || 'N/A';
    const amountStr = Number(note.amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Compute base and tax from actual item tax data when available
    let baseAmount = Number(note.amount);
    let taxLinesHtml = '';
    if (note.items && note.items.length > 0) {
      const totalItemSubtotals = note.items.reduce(
        (sum: number, item: any) => sum + Number(item.subtotal || 0),
        0,
      );
      const totalTaxes = note.items.reduce((sum: number, item: any) => {
        if (item.noteItemTaxes && item.noteItemTaxes.length > 0) {
          return (
            sum +
            item.noteItemTaxes.reduce(
              (s: number, t: any) => s + Number(t.taxAmount || 0),
              0,
            )
          );
        }
        return sum;
      }, 0);

      // If we have reliable item data, derive base from subtotals (which are before tax)
      if (totalItemSubtotals > 0) {
        baseAmount = totalItemSubtotals;
      }

      // Collect unique tax labels from item taxes
      const taxLabels = new Map<string, number>();
      for (const item of note.items) {
        if (item.noteItemTaxes) {
          for (const t of item.noteItemTaxes) {
            const label = t.taxName || `IVA ${t.taxRate}%`;
            taxLabels.set(
              label,
              (taxLabels.get(label) || 0) + Number(t.taxAmount || 0),
            );
          }
        }
      }

      if (taxLabels.size > 0) {
        taxLinesHtml = [...taxLabels.entries()]
          .map(
            ([label, amount]) =>
              `${label}: $${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          )
          .join('\n');
      } else {
        // Fallback: compute single implied tax rate
        const impliedTax =
          totalTaxes > 0 ? totalTaxes : Number(note.amount) - baseAmount;
        const taxLabelVal =
          impliedTax > 0
            ? `$${impliedTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '$0.00';
        taxLinesHtml = `Impuestos: ${taxLabelVal}`;
      }
    } else {
      // No items loaded — show total only, no hardcoded tax
      taxLinesHtml = `Impuestos: $0.00`;
    }

    const baseStr = baseAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const lines = [
      `Identificador: ${number}`,
      `Fecha de Emision: ${dateStr}`,
      `Estado Contable: Aplicado`,
      `CUDE DIAN: ${note.cude || 'N/A'}`,
      `Factura de Referencia: ${invoice?.invoiceNumber || note.invoiceId}`,
      `Cliente: ${customerName}`,
      `NIT/CC: ${customerTaxId}`,
      `Concepto: ${note.observation || 'Sin justificacion especificada'}`,
      `Monto Base: $${baseStr}`,
      ...taxLinesHtml.split('\n'),
      `VALOR TOTAL: $${amountStr}`,
      `---------------------------------------`,
      `SOPORTE DIGITAL SIMULADO DE LA DIAN`,
    ];

    const contentStream = [
      'BT',
      '/F1 18 Tf',
      '70 730 Td',
      `(${docType}) Tj`,
      '/F1 12 Tf',
      '0 -30 Td',
      ...lines.map((line) => `(${line.replace(/[\(\)]/g, '')}) Tj\n0 -18 Td`),
      'ET',
    ].join('\n');

    const streamLength = contentStream.length;

    const pdfBody = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLength} >>
stream
${contentStream}
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000244 00000 n
0000000319 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${319 + streamLength + 20}
%%EOF`;

    return Buffer.from(pdfBody, 'utf-8').toString('base64');
  }
}

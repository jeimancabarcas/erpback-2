import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, Like } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceElectronicEmission } from './entities/invoice-electronic-emission.entity';
import { CreditNote } from './entities/credit-note.entity';
import { DebitNote } from './entities/debit-note.entity';
import { CreditNoteItem } from './entities/credit-note-item.entity';
import { DebitNoteItem } from './entities/debit-note-item.entity';
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
} from '../factus/interfaces/factus-invoicing-gateway.interface';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../inventory/entities/product.entity';

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
    @Inject('IFactusInvoicingGateway')
    private readonly factusGateway: any,
    private readonly inventoryService: InventoryService,
    private readonly pdfGenerationService: PdfGenerationService,
    private readonly dataSource: DataSource,
  ) {}

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
      let totalAmount = 0;
      let factusTotalAmount = 0;
      const invoiceItems: InvoiceItem[] = [];
      const factusItems: FactusItem[] = [];

      for (const item of items) {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: item.productId },
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

        invoiceItems.push(
          this.invoiceItemRepository.create({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice,
            purchasePrice,
            subtotal,
          }),
        );

        const priceBeforeTax = Number((Number(unitPrice) / 1.19).toFixed(2));
        const itemSubtotal = priceBeforeTax * item.quantity;
        const itemTax = Number((itemSubtotal * 0.19).toFixed(2));
        factusTotalAmount += itemSubtotal + itemTax;

        factusItems.push({
          codeReference: product.sku || product.id,
          name: product.name,
          quantity: item.quantity,
          discountRate: 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes: [{ code: '01', rate: '19.00' }],
        });
      }

      const isElectronic = createDto.isElectronic === true;

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
          factusResponse = await this.factusGateway.createInvoice(factusPayload);
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

      // 6. Para electrónicas, crear la emisión
      if (isElectronic && factusResponse?.data) {
        const emission = this.invoiceEmissionRepository.create({
          invoice: savedInvoice,
          number: factusResponse.data.number,
          cude: factusResponse.data.cude || factusResponse.data.cufe || undefined,
          qrUrl: factusResponse.data.qrUrl || undefined,
          publicUrl: factusResponse.data.publicUrl || undefined,
          isValidated: factusResponse.data.isValidated ?? false,
      validatedAt: factusResponse.data.validatedAt
        ? (() => { const d = new Date(factusResponse.data.validatedAt); return isNaN(d.getTime()) ? undefined : d; })()
        : undefined,
          numberingRange: factusResponse.data.numberingRange || undefined,
          items: factusResponse.data.items || undefined,
          taxes: factusResponse.data.taxes || undefined,
          totals: factusResponse.data.totals || undefined,
          links: factusResponse.data.links || undefined,
        });
        savedInvoice.emission =
          await queryRunner.manager.save(emission);
      }

      await queryRunner.manager.save(savedInvoice);
      await queryRunner.commitTransaction();

      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error instanceof BadRequestException || error instanceof NotFoundException
        ? error
        : new BadRequestException(error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async emit(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['customer', 'items', 'items.product', 'emission'],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    if (invoice.isElectronic) {
      throw new BadRequestException(
        'La factura ya es electrónica',
      );
    }

    if (invoice.emission) {
      throw new BadRequestException(
        'La factura ya tiene una emisión registrada',
      );
    }

    // Build Factus payload from existing invoice data
    let factusTotalAmount = 0;
    const factusItems: FactusItem[] = [];

    for (const item of invoice.items) {
      const unitPrice = Number(item.unitPrice);
      const priceBeforeTax = Number((unitPrice / 1.19).toFixed(2));
      const itemSubtotal = priceBeforeTax * Number(item.quantity);
      const itemTax = Number((itemSubtotal * 0.19).toFixed(2));
      factusTotalAmount += itemSubtotal + itemTax;

      factusItems.push({
        codeReference: item.product?.sku || item.productId,
        name: item.product?.name || 'Producto',
        quantity: Number(item.quantity),
        discountRate: 0,
        price: priceBeforeTax,
        unitMeasureCode: '94',
        standardCode: '999',
        taxes: [{ code: '01', rate: '19.00' }],
      });
    }

    const referenceCode = `FAC-REF-${invoice.invoiceNumber || invoice.id}-${Date.now()}`;

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
      const factusResponse =
        await this.factusGateway.createInvoice(factusPayload);

      // Create InvoiceElectronicEmission from full Factus response
      const emission = this.invoiceEmissionRepository.create({
        invoice,
        number: factusResponse.data.number,
        cude: factusResponse.data.cude || factusResponse.data.cufe || undefined,
        qrUrl: factusResponse.data.qrUrl || undefined,
        publicUrl: factusResponse.data.publicUrl || undefined,
        isValidated: factusResponse.data.isValidated ?? false,
      validatedAt: factusResponse.data.validatedAt
        ? (() => { const d = new Date(factusResponse.data.validatedAt); return isNaN(d.getTime()) ? undefined : d; })()
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
      relations: ['customer', 'items', 'items.product', 'emission'],
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

  private async createCreditNoteLocal(
    invoice: Invoice,
    dto: CreateSalesNoteDto,
  ): Promise<CreditNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const noteNumber = await this.getNextManualNoteNumber(
        queryRunner,
        invoice,
        'NC-MAN',
      );

      let totalAmount = 0;
      const noteItems: Partial<CreditNoteItem>[] = [];

      if (dto.items && dto.items.length > 0) {
        for (const itemDto of dto.items) {
          const matchingInvoiceItem = invoice.items.find(
            (ii) =>
              ii.product?.sku === itemDto.codeReference ||
              ii.productId === itemDto.codeReference,
          );

          if (!matchingInvoiceItem) {
            throw new BadRequestException(
              `El ítem con código ${itemDto.codeReference} no pertenece a esta factura`,
            );
          }

          if (itemDto.quantity > matchingInvoiceItem.quantity) {
            throw new BadRequestException(
              `La cantidad a acreditar (${itemDto.quantity}) supera la cantidad facturada (${matchingInvoiceItem.quantity})`,
            );
          }

          const price =
            itemDto.price !== undefined
              ? Number(itemDto.price)
              : Number(matchingInvoiceItem.unitPrice);

          const subtotal = itemDto.quantity * price;
          totalAmount += subtotal;

          noteItems.push({
            creditNoteId: undefined,
            codeReference: itemDto.codeReference,
            name: matchingInvoiceItem.product?.name || 'Producto',
            quantity: itemDto.quantity,
            unitPrice: price,
            subtotal,
          });
        }
      } else {
        totalAmount = Number(invoice.totalAmount);
        for (const item of invoice.items) {
          const subtotal = Number(item.quantity) * Number(item.unitPrice);
          noteItems.push({
            creditNoteId: undefined,
            codeReference: item.product?.sku || item.productId,
            name: item.product?.name || 'Producto',
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            subtotal,
          });
        }
      }

      const referenceCode = `NC-${invoice.invoiceNumber}-${Date.now()}`;

      const creditNote = this.creditNoteRepository.create({
        referenceCode,
        noteNumber,
        cude: null,
        correctionConceptCode: dto.correctionConceptCode,
        amount: totalAmount,
        observation: dto.observation,
        qrUrl: null,
        publicUrl: null,
        invoiceId: invoice.id,
      });

      const savedNote = await queryRunner.manager.save(creditNote);

      for (const item of noteItems) {
        item.creditNoteId = savedNote.id;
      }
      await queryRunner.manager.save(CreditNoteItem, noteItems);

      if (dto.correctionConceptCode === '2') {
        invoice.status = InvoiceStatus.CANCELLED;
        await queryRunner.manager.save(invoice);
      }

      await queryRunner.commitTransaction();

      savedNote.items = noteItems as CreditNoteItem[];
      return savedNote;
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

  private async createDebitNoteLocal(
    invoice: Invoice,
    dto: CreateSalesNoteDto,
  ): Promise<DebitNote> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const noteNumber = await this.getNextManualNoteNumber(
        queryRunner,
        invoice,
        'ND-MAN',
      );

      let totalAmount = 0;
      const noteItems: Partial<DebitNoteItem>[] = [];

      if (dto.items && dto.items.length > 0) {
        for (const itemDto of dto.items) {
          const matchingInvoiceItem = invoice.items.find(
            (ii) =>
              ii.product?.sku === itemDto.codeReference ||
              ii.productId === itemDto.codeReference,
          );

          if (!matchingInvoiceItem) {
            throw new BadRequestException(
              `El ítem con código ${itemDto.codeReference} no pertenece a esta factura`,
            );
          }

          if (itemDto.quantity > matchingInvoiceItem.quantity) {
            throw new BadRequestException(
              `La cantidad a debitar (${itemDto.quantity}) supera la cantidad facturada (${matchingInvoiceItem.quantity})`,
            );
          }

          const price =
            itemDto.price !== undefined
              ? Number(itemDto.price)
              : Number(matchingInvoiceItem.unitPrice);

          const subtotal = itemDto.quantity * price;
          totalAmount += subtotal;

          noteItems.push({
            debitNoteId: undefined,
            codeReference: itemDto.codeReference,
            name: matchingInvoiceItem.product?.name || 'Producto',
            quantity: itemDto.quantity,
            unitPrice: price,
            subtotal,
          });
        }
      } else {
        totalAmount = Number(invoice.totalAmount);
        for (const item of invoice.items) {
          const subtotal = Number(item.quantity) * Number(item.unitPrice);
          noteItems.push({
            debitNoteId: undefined,
            codeReference: item.product?.sku || item.productId,
            name: item.product?.name || 'Producto',
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            subtotal,
          });
        }
      }

      const referenceCode = `ND-${invoice.invoiceNumber}-${Date.now()}`;

      const debitNote = this.debitNoteRepository.create({
        referenceCode,
        noteNumber,
        cude: null,
        correctionConceptCode: dto.correctionConceptCode,
        amount: totalAmount,
        observation: dto.observation,
        qrUrl: null,
        publicUrl: null,
        invoiceId: invoice.id,
      });

      const savedNote = await queryRunner.manager.save(debitNote);

      for (const item of noteItems) {
        item.debitNoteId = savedNote.id;
      }
      await queryRunner.manager.save(DebitNoteItem, noteItems);

      await queryRunner.commitTransaction();

      savedNote.items = noteItems as DebitNoteItem[];
      return savedNote;
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
      relations: ['customer', 'items', 'items.product'],
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

    if (!isElectronicNote) {
      return this.createCreditNoteLocal(invoice, dto);
    }

    // --- Electronic invoice path (unchanged) ---
    const itemsToCredit: any[] = [];
    let totalAmount = 0;
    let factusTotalAmount = 0;

    if (dto.items && dto.items.length > 0) {
      for (const itemDto of dto.items) {
        const matchingInvoiceItem = invoice.items.find(
          (ii) =>
            ii.product?.sku === itemDto.codeReference ||
            ii.productId === itemDto.codeReference,
        );

        if (!matchingInvoiceItem) {
          throw new BadRequestException(
            `El ítem con código ${itemDto.codeReference} no pertenece a esta factura`,
          );
        }

        if (itemDto.quantity > matchingInvoiceItem.quantity) {
          throw new BadRequestException(
            `La cantidad a acreditar (${itemDto.quantity}) supera la cantidad facturada (${matchingInvoiceItem.quantity})`,
          );
        }

        const price =
          itemDto.price !== undefined
            ? Number(itemDto.price)
            : Number(matchingInvoiceItem.unitPrice);

        totalAmount += itemDto.quantity * price;

        const priceBeforeTax = Number((Number(price) / 1.19).toFixed(2));
        const itemSubtotal = priceBeforeTax * itemDto.quantity;
        const itemTax = Number((itemSubtotal * 0.19).toFixed(2));
        factusTotalAmount += itemSubtotal + itemTax;

        itemsToCredit.push({
          codeReference: itemDto.codeReference,
          name: matchingInvoiceItem.product?.name || 'Producto',
          quantity: itemDto.quantity,
          discountRate: 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes: [{ code: '01', rate: '19.00' }],
        });
      }
    } else {
      totalAmount = Number(invoice.totalAmount);
      for (const item of invoice.items) {
        const priceBeforeTax = Number(
          (Number(item.unitPrice) / 1.19).toFixed(2),
        );
        const itemSubtotal = priceBeforeTax * Number(item.quantity);
        const itemTax = Number((itemSubtotal * 0.19).toFixed(2));
        factusTotalAmount += itemSubtotal + itemTax;

        itemsToCredit.push({
          codeReference: item.product?.sku || item.productId,
          name: item.product?.name || 'Producto',
          quantity: Number(item.quantity),
          discountRate: 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes: [{ code: '01', rate: '19.00' }],
        });
      }
    }

    const referenceCode = `NC-${invoice.invoiceNumber}-${Date.now()}`;

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
          amount: factusTotalAmount.toFixed(2),
        },
      ],
      customer: this.mapCustomerToFactus(invoice.customer),
      items: itemsToCredit,
    };

    try {
      const factusResponse =
        await this.factusGateway.createCreditNote(factusPayload);

      const creditNote = this.creditNoteRepository.create({
        referenceCode,
        noteNumber: factusResponse.data.number || `NC-PEND-${Date.now()}`,
        cude: factusResponse.data.cude || null,
        correctionConceptCode: dto.correctionConceptCode,
        amount: totalAmount,
        observation: dto.observation,
        qrUrl:
          factusResponse.data.qrUrl || factusResponse.data.links?.qr || null,
        publicUrl:
          factusResponse.data.publicUrl ||
          factusResponse.data.links?.publicUrl ||
          null,
        invoiceId,
      });

      const savedNote = await this.creditNoteRepository.save(creditNote);

      if (dto.correctionConceptCode === '2') {
        invoice.status = InvoiceStatus.CANCELLED;
        await this.invoiceRepository.save(invoice);
      }

      return savedNote;
    } catch (error) {
      throw new BadRequestException(
        `Error al emitir Nota de Crédito en Factus: ${error.message}`,
      );
    }
  }

  async createDebitNote(
    invoiceId: string,
    dto: CreateSalesNoteDto,
  ): Promise<DebitNote> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['customer', 'items', 'items.product'],
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${invoiceId} no encontrada`);
    }

    // --- Determinar si la nota es electrónica ---
    const isElectronicNote = dto.isElectronic ?? invoice.isElectronic;

    // Guard: reject electronic note for manual invoice
    this.validateNoteElectronicStatus(isElectronicNote, invoice);

    if (!isElectronicNote) {
      return this.createDebitNoteLocal(invoice, dto);
    }

    // --- Electronic invoice path (unchanged) ---
    const itemsToDebit: any[] = [];
    let totalAmount = 0;
    let factusTotalAmount = 0;

    if (dto.items && dto.items.length > 0) {
      for (const itemDto of dto.items) {
        const matchingInvoiceItem = invoice.items.find(
          (ii) =>
            ii.product?.sku === itemDto.codeReference ||
            ii.productId === itemDto.codeReference,
        );

        if (!matchingInvoiceItem) {
          throw new BadRequestException(
            `El ítem con código ${itemDto.codeReference} no pertenece a esta factura`,
          );
        }

        if (itemDto.quantity > matchingInvoiceItem.quantity) {
          throw new BadRequestException(
            `La cantidad a debitar (${itemDto.quantity}) supera la cantidad facturada (${matchingInvoiceItem.quantity})`,
          );
        }

        const price =
          itemDto.price !== undefined
            ? Number(itemDto.price)
            : Number(matchingInvoiceItem?.unitPrice || 0);

        totalAmount += itemDto.quantity * price;

        const priceBeforeTax = Number((Number(price) / 1.19).toFixed(2));
        const itemSubtotal = priceBeforeTax * itemDto.quantity;
        const itemTax = Number((itemSubtotal * 0.19).toFixed(2));
        factusTotalAmount += itemSubtotal + itemTax;

        itemsToDebit.push({
          codeReference: itemDto.codeReference,
          name: matchingInvoiceItem?.product?.name || 'Producto',
          quantity: itemDto.quantity,
          discountRate: 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes: [{ code: '01', rate: '19.00' }],
        });
      }
    } else {
      totalAmount = Number(invoice.totalAmount);
      for (const item of invoice.items) {
        const priceBeforeTax = Number(
          (Number(item.unitPrice) / 1.19).toFixed(2),
        );
        const itemSubtotal = priceBeforeTax * Number(item.quantity);
        const itemTax = Number((itemSubtotal * 0.19).toFixed(2));
        factusTotalAmount += itemSubtotal + itemTax;

        itemsToDebit.push({
          codeReference: item.product?.sku || item.productId,
          name: item.product?.name || 'Producto',
          quantity: Number(item.quantity),
          discountRate: 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes: [{ code: '01', rate: '19.00' }],
        });
      }
    }

    const referenceCode = `ND-${invoice.invoiceNumber}-${Date.now()}`;

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
          amount: factusTotalAmount.toFixed(2),
        },
      ],
      customer: this.mapCustomerToFactus(invoice.customer),
      items: itemsToDebit,
    };

    try {
      const factusResponse =
        await this.factusGateway.createDebitNote(factusPayload);

      const debitNote = this.debitNoteRepository.create({
        referenceCode,
        noteNumber: factusResponse.data.number || `ND-PEND-${Date.now()}`,
        cude: factusResponse.data.cude || null,
        correctionConceptCode: dto.correctionConceptCode,
        amount: totalAmount,
        observation: dto.observation,
        qrUrl:
          factusResponse.data.qrUrl || factusResponse.data.links?.qr || null,
        publicUrl:
          factusResponse.data.publicUrl ||
          factusResponse.data.links?.publicUrl ||
          null,
        invoiceId,
      });

      return await this.debitNoteRepository.save(debitNote);
    } catch (error) {
      throw new BadRequestException(
        `Error al emitir Nota de Débito en Factus: ${error.message}`,
      );
    }
  }

  async findNotesByInvoice(invoiceId: string) {
    const creditNotes = await this.creditNoteRepository.find({
      where: { invoiceId },
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

  async downloadAdjustmentNotePdf(
    id: string,
    type: 'Credit' | 'Debit',
  ): Promise<{ pdfBase64Encoded: string; fileName: string }> {
    let note: any;
    let invoice: any;

    if (type === 'Credit') {
      note = await this.creditNoteRepository.findOne({
        where: { id },
        relations: ['invoice', 'invoice.customer'],
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
        relations: ['invoice', 'invoice.customer'],
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
    const baseStr = (Number(note.amount) / 1.19).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const taxStr = (
      Number(note.amount) -
      Number(note.amount) / 1.19
    ).toLocaleString('en-US', {
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
      `IVA 19%: $${taxStr}`,
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

import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceElectronicEmission } from '../sales/entities/invoice-electronic-emission.entity';
import { Invoice } from '../sales/entities/invoice.entity';
import { Product } from '../inventory/entities/product.entity';
import type {
  IFactusInvoicingGateway,
  FactusCustomer,
  FactusItem,
} from '../factus/interfaces/factus-invoicing-gateway.interface';
import { CreateElectronicBillDto } from './dto/create-electronic-bill.dto';
import { CreateElectronicCreditNoteDto } from './dto/create-electronic-credit-note.dto';
import { ElectronicBillResponseDto } from './dto/electronic-bill-response.dto';
import type { FactusCreditNoteRequest } from '../factus/interfaces/factus-invoicing-gateway.interface';

@Injectable()
export class ElectronicBillsService {
  private readonly logger = new Logger(ElectronicBillsService.name);

  constructor(
    @InjectRepository(InvoiceElectronicEmission)
    private readonly emissionRepository: Repository<InvoiceElectronicEmission>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @Inject('IFactusInvoicingGateway')
    private readonly factusGateway: IFactusInvoicingGateway,
  ) {}

  async create(dto: CreateElectronicBillDto): Promise<ElectronicBillResponseDto> {
    // 1. Build Factus payload from either manual invoice or DTO
    const referenceCode = `FAC-REF-${Date.now()}`;
    const factusCustomer: FactusCustomer = {
      identificationDocumentCode: '13',
      identification: dto.customer.identification,
      legalOrganizationCode: '2',
      names: dto.customer.names,
      address: dto.customer.address || 'calle 1 # 1-1',
      email: dto.customer.email || 'cliente@correo.com',
      phone: dto.customer.phone || '1234567890',
      municipalityCode: '68679',
    };

    let factusItems: FactusItem[];
    let linkedInvoiceId: string | null = null;
    let warning: string | undefined;
    let paymentForm = '1';
    let paymentMethodCode = '10';
    let amount: string;

    // Prevent double emission: check if manual invoice already has an electronic emission
    if (dto.manualInvoiceId) {
      const existingEmission = await this.emissionRepository.findOne({
        where: { invoiceId: dto.manualInvoiceId },
      });
      if (existingEmission) {
        throw new ConflictException(
          `La factura manual ya fue emitida electrónicamente (emisión #${existingEmission.number}).`,
        );
      }
    }

    // Resolve manual invoice if provided
    if (dto.manualInvoiceId) {
      const manualInvoice = await this.invoiceRepository.findOne({
        where: { id: dto.manualInvoiceId },
        relations: [
          'customer', 'items', 'items.product', 'items.product.taxes',
          'paymentMethod', 'paymentType',
        ],
      });

      if (manualInvoice) {
        // Consistency check: compare DTO values with manual invoice
        const dtoTotal = dto.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        const invoiceTotal = (manualInvoice.items ?? []).reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.product?.sellingPrice || 0),
          0,
        );

        const invPrefix = manualInvoice.emission ? 'FAC' : 'MAN';
        const invNumber = `${invPrefix}-${String(manualInvoice.sequentialNumber).padStart(6, '0')}`;
        if (Math.abs(dtoTotal - invoiceTotal) > 0.01) {
          warning = `Los valores han cambiado. La factura NO quedará vinculada a la factura manual ${invNumber}.`;
          linkedInvoiceId = null;
        } else {
          linkedInvoiceId = dto.manualInvoiceId;
        }
      }
    }

    // Build items
    if (linkedInvoiceId) {
      // ---------------------------------------------------------------
      // Path A: Use manual invoice data from DB
      // ---------------------------------------------------------------
      const manualInvoice = await this.invoiceRepository.findOne({
        where: { id: linkedInvoiceId },
        relations: ['items', 'items.product', 'items.product.taxes', 'paymentMethod', 'paymentType'],
      });

      if (!manualInvoice) {
        throw new NotFoundException(
          `Factura manual con ID ${linkedInvoiceId} no encontrada`,
        );
      }

      factusItems = manualInvoice.items.map((item) => {
        const rawUnitPrice = Number(item.product?.sellingPrice || 0);
        const sellTaxes = (item.product?.taxes ?? []).filter((t) => t.isSell);
        const totalRate = sellTaxes.reduce((sum, t) => sum + Number(t.percentage), 0);
        const priceBeforeTax = Math.round(rawUnitPrice / (1 + totalRate / 100) * 100) / 100;
        const productTaxes = sellTaxes.map((t) => ({
          code: t.code,
          rate: Number(t.percentage).toFixed(2),
          isExcluded: false,
        }));

        return {
          codeReference: item.product?.sku || item.productId,
          name: item.product?.name || 'Producto',
          quantity: Number(item.quantity),
          discountRate: 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes: productTaxes,
        };
      });

      // Payment details: amount = sum of (net + tax) per item, matching Factus calculation
      const invoiceItemsTotal = factusItems.reduce((sum, fi) => {
        const netAmount = fi.price * fi.quantity;
        const taxAmount = (fi.taxes ?? []).reduce((t, tax) => {
          if (tax.isExcluded) return t;
          return t + Math.round(netAmount * Number(tax.rate) / 100 * 100) / 100;
        }, 0);
        return sum + Math.round((netAmount + taxAmount) * 100) / 100;
      }, 0);
      amount = invoiceItemsTotal.toFixed(2);
      paymentForm = manualInvoice.paymentType?.code || '1';
      paymentMethodCode = manualInvoice.paymentMethod?.code || '10';
    } else {
      // ---------------------------------------------------------------
      // Path B: Build from DTO
      // ---------------------------------------------------------------
      factusItems = await Promise.all(
        dto.items.map(async (item) => {
          let productTaxes: { code: string; rate: string; isExcluded: boolean }[] = [];
          let priceBeforeTax = item.price;

          if (item.productId) {
            const product = await this.productRepository.findOne({
              where: { id: item.productId },
              relations: ['taxes'],
            });
            if (product) {
              const sellTaxes = (product.taxes ?? []).filter((t) => t.isSell);
              const totalRate = sellTaxes.reduce((sum, t) => sum + Number(t.percentage), 0);
              priceBeforeTax = Math.round(item.price / (1 + totalRate / 100) * 100) / 100;
              productTaxes = sellTaxes.map((t) => ({
                code: t.code,
                rate: Number(t.percentage).toFixed(2),
                isExcluded: false,
              }));
            }
          }

          return {
            codeReference: item.codeReference,
            name: item.name,
            quantity: item.quantity,
            discountRate: item.discountRate ?? 0,
            price: priceBeforeTax,
            unitMeasureCode: '94',
            standardCode: '999',
            taxes: productTaxes,
          };
        }),
      );

      // Payment details from DTO or Factus-matching calculation
      if (dto.paymentDetails && dto.paymentDetails.length > 0) {
        const pd = dto.paymentDetails[0];
        paymentForm = pd.paymentForm;
        paymentMethodCode = pd.paymentMethodCode;
        amount = pd.amount.toFixed(2);
      } else {
        // Total matching Factus calculation: sum of (net + tax) per item
        const itemsTotal = factusItems.reduce((sum, fi) => {
          const netAmount = fi.price * fi.quantity;
          const taxAmount = (fi.taxes ?? []).reduce((t, tax) => {
            if (tax.isExcluded) return t;
            return t + Math.round(netAmount * Number(tax.rate) / 100 * 100) / 100;
          }, 0);
          return sum + Math.round((netAmount + taxAmount) * 100) / 100;
        }, 0);
        amount = itemsTotal.toFixed(2);
      }
    }

    // 3. Call Factus API — only persist if successful
    try {
      const factusResponse = await this.factusGateway.createInvoice({
        referenceCode,
        paymentDetails: [
          {
            paymentForm,
            paymentMethodCode,
            amount,
          },
        ],
        customer: factusCustomer,
        items: factusItems,
      });

      // 4. Save emission record ONLY after Factus confirms success
      const emission = this.emissionRepository.create({
        invoice: linkedInvoiceId ? ({ id: linkedInvoiceId } as any) : null,
        invoiceId: linkedInvoiceId,
        number: factusResponse.data.number,
        cude:
          factusResponse.data.cude || factusResponse.data.cufe || undefined,
        qrUrl: factusResponse.data.qrUrl || undefined,
        publicUrl: factusResponse.data.publicUrl || undefined,
        isValidated: factusResponse.data.isValidated ?? false,
        validatedAt: (() => {
          if (!factusResponse.data.validatedAt) return undefined;
          const d = new Date(factusResponse.data.validatedAt);
          return isNaN(d.getTime()) ? undefined : d;
        })(),
        numberingRange:
          factusResponse.data.numberingRange || undefined,
        items: factusResponse.data.items || undefined,
        taxes: factusResponse.data.taxes || undefined,
        totals: factusResponse.data.totals || undefined,
        links: factusResponse.data.links || undefined,
        status: 'emitted',
      });
      const savedEmission = await this.emissionRepository.save(emission);

      return {
        id: savedEmission.id,
        number: savedEmission.number,
        cufe: savedEmission.cude,
        qrUrl: savedEmission.qrUrl,
        publicUrl: savedEmission.publicUrl,
        status: 'emitted',
        warning,
      };
    } catch (error) {
      this.logger.error(
        `Factus emission failed: ${error.message}`,
        error.stack,
      );
      // No database record created — Factus did not confirm the emission
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Create an electronic credit note via Factus API.
   * Resolves the emission by bill number, resolves customer from linked invoice or DTO,
   * builds the Factus payload, and calls factusGateway.createCreditNote().
   * No local DB save — the response is returned directly.
   */
  async createCreditNote(
    dto: CreateElectronicCreditNoteDto,
  ): Promise<any> {
    // 1. Resolve emission by billNumber
    const emission = await this.emissionRepository.findOne({
      where: { number: dto.billNumber },
    });

    if (!emission) {
      throw new NotFoundException(
        `Emisión electrónica con número ${dto.billNumber} no encontrada`,
      );
    }

    // 2. Extract numberingRangeId from emission's numberingRange
    const numberingRangeId: number | undefined =
      emission.numberingRange?.id ?? undefined;

    // 3. Resolve customer — linked invoice takes precedence over DTO
    let factusCustomer: FactusCustomer | undefined;

    if (emission.invoiceId) {
      const invoice = await this.invoiceRepository.findOne({
        where: { id: emission.invoiceId },
        relations: ['customer'],
      });
      if (invoice?.customer) {
        factusCustomer = {
          identificationDocumentCode: '13',
          identification: invoice.customer.documentNumber,
          legalOrganizationCode: '2',
          names: invoice.customer.name,
          address: invoice.customer.address || 'calle 1 # 1-1',
          email: invoice.customer.email || 'cliente@correo.com',
          phone: invoice.customer.phone || '1234567890',
          municipalityCode: '68679',
        };
      }
    }

    // Fall back to DTO customer when no linked invoice or invoice has no customer
    if (!factusCustomer && dto.customer) {
      factusCustomer = {
        identificationDocumentCode: '13',
        identification: dto.customer.identification,
        legalOrganizationCode: '2',
        names: dto.customer.names,
        address: dto.customer.address || 'calle 1 # 1-1',
        email: dto.customer.email || 'cliente@correo.com',
        phone: dto.customer.phone || '1234567890',
        municipalityCode: '68679',
      };
    }

    // 4. Resolve taxes for each item — product taxes or default IVA 19%
    const factusItems: FactusItem[] = await Promise.all(
      dto.items.map(async (item) => {
        let taxes: { code: string; rate: string; isExcluded: boolean }[] = [];

        if (item.productId) {
          const product = await this.productRepository.findOne({
            where: { id: item.productId },
            relations: ['taxes'],
          });
          if (product) {
            const sellTaxes = (product.taxes ?? []).filter((t) => t.isSell);
            if (sellTaxes.length > 0) {
              taxes = sellTaxes.map((t) => ({
                code: t.code,
                rate: Number(t.percentage).toFixed(2),
                isExcluded: false,
              }));
            }
          }
        }

        // Default fallback: Colombian IVA 19% when no product taxes are available
        if (taxes.length === 0) {
          taxes = [{ code: '01', rate: '19.00', isExcluded: false }];
        }

        // Convert price to pre-tax (Factus expects pre-tax price and adds tax itself)
        const totalRate = taxes.reduce((sum, t) => sum + Number(t.rate), 0);
        const priceBeforeTax =
          Math.round((item.price / (1 + totalRate / 100)) * 100) / 100;

        return {
          codeReference: item.codeReference,
          name: item.name,
          quantity: item.quantity,
          discountRate: item.discountRate ?? 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes,
        };
      }),
    );

    // Compute total matching Factus's internal calculation (net + tax per item)
    const computedTotal = factusItems
      .reduce((sum, item) => {
        const netAmount = item.price * item.quantity;
        const taxAmount = item.taxes.reduce(
          (taxSum, t) =>
            taxSum + Math.round(netAmount * (Number(t.rate) / 100) * 100) / 100,
          0,
        );
        return sum + Math.round((netAmount + taxAmount) * 100) / 100;
      }, 0)
      .toFixed(2);

    // 5. Build FactusCreditNoteRequest
    const payload: FactusCreditNoteRequest = {
      referenceCode: dto.referenceCode,
      correctionConceptCode: dto.correctionConceptCode,
      billNumber: dto.billNumber,
      numberingRangeId,
      observation: dto.observation,
      paymentDetails: dto.paymentDetails.map((pd) => ({
        paymentForm: pd.paymentForm,
        paymentMethodCode: pd.paymentMethodCode,
        amount: computedTotal, // Must match Factus's item total
      })),
      customer: factusCustomer,
      items: factusItems,
    };

    // 6. Call Factus API — return response directly (no local DB save)
    try {
      const response = await this.factusGateway.createCreditNote(payload);
      return response;
    } catch (error) {
      this.logger.error(
        `Factus credit note creation failed: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }

  /** Look up the local invoice ID for a given Factus document number */
  async findByDocumentNumber(
    documentNumber: string,
  ): Promise<{ invoiceId: string | null } | null> {
    const emission = await this.emissionRepository.findOne({
      where: { number: documentNumber },
      select: ['invoiceId'],
    });
    return emission ? { invoiceId: emission.invoiceId } : null;
  }
}

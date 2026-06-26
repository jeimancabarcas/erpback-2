import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
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
import { QueryElectronicBillsDto } from './dto/query-electronic-bills.dto';
import { ElectronicBillResponseDto } from './dto/electronic-bill-response.dto';
import { ElectronicBillListDto } from './dto/electronic-bill-list.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { computeFactusItemTaxes } from '../sales/helpers/factus-tax-helper';

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

  async findAll(
    query: QueryElectronicBillsDto,
  ): Promise<PaginatedResult<ElectronicBillListDto>> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 10;
    const skip = (page - 1) * perPage;

    const [emissions, total] = await this.emissionRepository.findAndCount({
      skip,
      take: perPage,
      order: { createdAt: 'DESC' },
    });

    const data: ElectronicBillListDto[] = emissions.map((em) => ({
      id: em.id,
      number: em.number,
      status: em.status,
      cufe: em.cude || em.cude,
      invoiceId: em.invoiceId,
      createdAt: em.createdAt,
    }));

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / perPage),
        limit: perPage,
      },
    };
  }

  async create(dto: CreateElectronicBillDto): Promise<ElectronicBillResponseDto> {
    // 1. Resolve manual invoice linkage
    let linkedInvoiceId: string | null = null;
    let warning: string | undefined;

    if (dto.manualInvoiceId) {
      const manualInvoice = await this.invoiceRepository.findOne({
        where: { id: dto.manualInvoiceId },
        relations: ['customer', 'items', 'items.product', 'items.product.taxes'],
      });

      if (manualInvoice) {
        // Consistency check: compare DTO values with manual invoice
        const dtoTotal = dto.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        const invoiceTotal = Number(manualInvoice.totalAmount);

        if (Math.abs(dtoTotal - invoiceTotal) > 0.01) {
          warning = `Los valores han cambiado. La factura NO quedará vinculada a la factura manual ${manualInvoice.invoiceNumber}.`;
          linkedInvoiceId = null;
        } else {
          linkedInvoiceId = dto.manualInvoiceId;
        }
      }
      // If manualInvoice not found, treat as standalone (linkedInvoiceId stays null)
    }

    // 2. Build Factus payload
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

    // Build Factus items with tax computation
    let factusItems: FactusItem[];
    let totalAmount = 0;

    if (linkedInvoiceId) {
      // ---------------------------------------------------------------
      // Path A: Build from manual invoice items with product.taxes
      // ---------------------------------------------------------------
      const manualInvoice = await this.invoiceRepository.findOne({
        where: { id: linkedInvoiceId },
        relations: ['items', 'items.product', 'items.product.taxes'],
      });

      if (!manualInvoice) {
        throw new NotFoundException(
          `Factura manual con ID ${linkedInvoiceId} no encontrada`,
        );
      }

      factusItems = manualInvoice.items.map((item) => {
        const grossUnitPrice = Number(item.unitPrice);
        const { priceBeforeTax, factusTaxes } = computeFactusItemTaxes(
          item.product,
          grossUnitPrice,
        );
        return {
          codeReference: item.product?.sku || item.productId,
          name: item.product?.name || 'Producto',
          quantity: Number(item.quantity),
          discountRate: 0,
          price: priceBeforeTax,
          unitMeasureCode: '94',
          standardCode: '999',
          taxes: factusTaxes,
        };
      });
    } else {
      // ---------------------------------------------------------------
      // Path B: Build from DTO items, resolving product taxes per item
      // ---------------------------------------------------------------
      factusItems = await Promise.all(
        dto.items.map(async (item) => {
          if (item.productId) {
            const product = await this.productRepository.findOne({
              where: { id: item.productId },
              relations: ['taxes'],
            });

            if (product) {
              const { priceBeforeTax, factusTaxes } = computeFactusItemTaxes(
                product,
                item.price,
              );
              return {
                codeReference: item.codeReference,
                name: item.name,
                quantity: item.quantity,
                discountRate: item.discountRate ?? 0,
                price: priceBeforeTax,
                unitMeasureCode: '94',
                standardCode: '999',
                taxes: factusTaxes,
              };
            }
          }

          // Fallback: no productId or product not found → backward compatible
          return {
            codeReference: item.codeReference,
            name: item.name,
            quantity: item.quantity,
            discountRate: item.discountRate ?? 0,
            price: item.price,
            unitMeasureCode: '94',
            standardCode: '999',
            taxes: [],
          };
        }),
      );
    }

    // Recompute total from factusItems to match Factus's calculation exactly:
    // total = sum(round(price * quantity + taxes)) for each item
    totalAmount = Number(
      factusItems
        .reduce((sum, fi) => {
          const netAmount = fi.price * fi.quantity;
          const taxAmount = (fi.taxes ?? []).reduce((t, tax) => {
            if (tax.isExcluded) return t;
            return t + Math.round(netAmount * Number(tax.rate) / 100 * 100) / 100;
          }, 0);
          return Math.round((sum + netAmount + taxAmount) * 100) / 100;
        }, 0)
        .toFixed(2),
    );

    // 3. Call Factus API — only persist if successful
    try {
      const factusResponse = await this.factusGateway.createInvoice({
        referenceCode,
        paymentDetails: [
          {
            paymentForm: '1',
            paymentMethodCode: '10',
            amount: totalAmount.toFixed(2),
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
        validatedAt: factusResponse.data.validatedAt
          ? new Date(factusResponse.data.validatedAt)
          : undefined,
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
}

import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Tax, TaxType } from '../entities/tax.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentType } from '../entities/payment-type.entity';

@Injectable()
export class SeedService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async seed(): Promise<{ taxes: number; paymentMethods: number; paymentTypes: number }> {
    return this.entityManager.transaction(async (em) => {
      // Truncate tables — order matters for FK references
      await em.query(`TRUNCATE TABLE "taxes" CASCADE`);
      await em.query(`TRUNCATE TABLE "payment_methods" CASCADE`);
      await em.query(`TRUNCATE TABLE "payment_types" CASCADE`);

      // Seed Taxes
      const taxData = [
        { name: 'IVA 19%', code: '01', percentage: 19.0, type: TaxType.PERCENTAGE, isPurchase: true, isSell: true, isActive: true, sortOrder: 1 },
        { name: 'IVA 5%', code: '02', percentage: 5.0, type: TaxType.PERCENTAGE, isPurchase: true, isSell: true, isActive: true, sortOrder: 2 },
        { name: 'IVA Exento', code: '03', percentage: 0.0, type: TaxType.PERCENTAGE, isPurchase: true, isSell: true, isActive: true, sortOrder: 3 },
        { name: 'INC', code: '04', percentage: 0.0, type: TaxType.PERCENTAGE, isPurchase: true, isSell: true, isActive: true, sortOrder: 4 },
        { name: 'ICA', code: '05', percentage: 0.0, type: TaxType.PERCENTAGE, isPurchase: false, isSell: true, isActive: true, sortOrder: 5 },
      ];
      const taxes = await em.insert(Tax, taxData);

      // Seed Payment Methods
      const pmData = [
        { name: 'Efectivo', code: '10', description: 'Pago en efectivo', isActive: true, sortOrder: 1 },
        { name: 'Consignación', code: '42', description: 'Consignación bancaria', isActive: true, sortOrder: 2 },
        { name: 'Tarjeta Débito', code: '48', description: 'Pago con tarjeta débito', isActive: true, sortOrder: 3 },
        { name: 'Tarjeta Crédito', code: '49', description: 'Pago con tarjeta crédito', isActive: true, sortOrder: 4 },
        { name: 'Transferencia', code: '55', description: 'Transferencia bancaria', isActive: true, sortOrder: 5 },
        { name: 'Cheque', code: '79', description: 'Pago con cheque', isActive: true, sortOrder: 6 },
      ];
      const paymentMethods = await em.insert(PaymentMethod, pmData);

      // Seed Payment Types
      const ptData = [
        { name: 'Contado', code: '1', description: 'Pago de contado', isActive: true, sortOrder: 1 },
        { name: 'Crédito', code: '2', description: 'Pago a crédito/plazo', isActive: true, sortOrder: 2 },
      ];
      const paymentTypes = await em.insert(PaymentType, ptData);

      return {
        taxes: taxes.identifiers?.length || taxData.length,
        paymentMethods: paymentMethods.identifiers?.length || pmData.length,
        paymentTypes: paymentTypes.identifiers?.length || ptData.length,
      };
    });
  }
}

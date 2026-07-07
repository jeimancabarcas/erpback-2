import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Tax, TaxType } from '../entities/tax.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentType } from '../entities/payment-type.entity';
import { Municipality } from '../entities/municipality.entity';
import { InventoryCategory } from '../../inventory/entities/inventory-category.entity';
import { Product } from '../../inventory/entities/product.entity';

@Injectable()
export class SeedService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async seed(): Promise<{
    taxes: number;
    paymentMethods: number;
    paymentTypes: number;
    categories: number;
    products: number;
    municipalities: number;
  }> {
    return this.entityManager.transaction(async (em) => {
      await em.query(`TRUNCATE TABLE "taxes" CASCADE`);
      await em.query(`TRUNCATE TABLE "payment_methods" CASCADE`);
      await em.query(`TRUNCATE TABLE "payment_types" CASCADE`);
      await em.query(`TRUNCATE TABLE "products_taxes" CASCADE`);
      await em.query(`TRUNCATE TABLE "products" CASCADE`);
      await em.query(`TRUNCATE TABLE "inventory_categories" CASCADE`);
      await em.query(`TRUNCATE TABLE "municipalities" CASCADE`);

      const taxData = [
        {
          name: 'IVA 19%',
          code: '01',
          percentage: 19.0,
          type: TaxType.PERCENTAGE,
          isPurchase: true,
          isSell: true,
          isActive: true,
          sortOrder: 1,
        },
        {
          name: 'IVA 5%',
          code: '02',
          percentage: 5.0,
          type: TaxType.PERCENTAGE,
          isPurchase: true,
          isSell: true,
          isActive: true,
          sortOrder: 2,
        },
        {
          name: 'IVA Exento',
          code: '03',
          percentage: 0.0,
          type: TaxType.PERCENTAGE,
          isPurchase: true,
          isSell: true,
          isActive: true,
          sortOrder: 3,
        },
        {
          name: 'INC',
          code: '04',
          percentage: 0.0,
          type: TaxType.PERCENTAGE,
          isPurchase: true,
          isSell: true,
          isActive: true,
          sortOrder: 4,
        },
        {
          name: 'ICA',
          code: '05',
          percentage: 0.0,
          type: TaxType.PERCENTAGE,
          isPurchase: false,
          isSell: true,
          isActive: true,
          sortOrder: 5,
        },
      ];
      const taxes = await em.insert(Tax, taxData);
      const iva19Id = taxes.identifiers[0].id;

      const pmData = [
        {
          name: 'Efectivo',
          code: '10',
          description: 'Pago en efectivo',
          isActive: true,
          sortOrder: 1,
        },
        {
          name: 'Consignación',
          code: '42',
          description: 'Consignación bancaria',
          isActive: true,
          sortOrder: 2,
        },
        {
          name: 'Tarjeta Débito',
          code: '48',
          description: 'Pago con tarjeta débito',
          isActive: true,
          sortOrder: 3,
        },
        {
          name: 'Tarjeta Crédito',
          code: '49',
          description: 'Pago con tarjeta crédito',
          isActive: true,
          sortOrder: 4,
        },
        {
          name: 'Transferencia',
          code: '55',
          description: 'Transferencia bancaria',
          isActive: true,
          sortOrder: 5,
        },
        {
          name: 'Cheque',
          code: '79',
          description: 'Pago con cheque',
          isActive: true,
          sortOrder: 6,
        },
      ];
      const paymentMethods = await em.insert(PaymentMethod, pmData);

      const ptData = [
        {
          name: 'Contado',
          code: '1',
          description: 'Pago de contado',
          isActive: true,
          sortOrder: 1,
        },
        {
          name: 'Crédito',
          code: '2',
          description: 'Pago a crédito/plazo',
          isActive: true,
          sortOrder: 2,
        },
      ];
      const paymentTypes = await em.insert(PaymentType, ptData);

      const municipalityData = [
        { code: '11001', name: 'Bogotá D.C.', department: 'Bogotá D.C.' },
        { code: '05001', name: 'Medellín', department: 'Antioquia' },
        { code: '76001', name: 'Cali', department: 'Valle del Cauca' },
        { code: '08001', name: 'Barranquilla', department: 'Atlántico' },
        { code: '13001', name: 'Cartagena', department: 'Bolívar' },
        { code: '54001', name: 'Cúcuta', department: 'Norte de Santander' },
        { code: '68001', name: 'Bucaramanga', department: 'Santander' },
        { code: '17001', name: 'Manizales', department: 'Caldas' },
        { code: '66001', name: 'Pereira', department: 'Risaralda' },
        { code: '52001', name: 'Pasto', department: 'Nariño' },
      ];
      const municipalities = await em.insert(Municipality, municipalityData);

      const categoryData = [
        {
          name: 'Analgésicos',
          description: 'Medicamentos para el alivio del dolor',
        },
        {
          name: 'Antibióticos',
          description: 'Medicamentos para infecciones bacterianas',
        },
        {
          name: 'Antiinflamatorios',
          description: 'Medicamentos antiinflamatorios',
        },
        {
          name: 'Vitaminas y Suplementos',
          description: 'Vitaminas y complementos nutricionales',
        },
        {
          name: 'Cuidado de la Piel',
          description: 'Productos para el cuidado dermatológico',
        },
        {
          name: 'Salud Digestiva',
          description: 'Productos para la salud digestiva',
        },
        {
          name: 'Respiratorio',
          description: 'Medicamentos para el sistema respiratorio',
        },
        { name: 'Alergias', description: 'Medicamentos antialérgicos' },
        {
          name: 'Cardiovascular',
          description: 'Medicamentos cardiovasculares',
        },
        {
          name: 'Primeros Auxilios',
          description: 'Insumos de primeros auxilios',
        },
      ];
      const categories = await em.insert(InventoryCategory, categoryData);
      const categoryIds = categories.identifiers.map((i) => i.id);

      const productsByCategory = [
        [
          {
            name: 'Acetaminofén 500mg',
            sku: 'ANA-001',
            currentStock: 100,
            minStock: 20,
            maxStock: 200,
            averagePurchasePrice: 1500,
            sellingPrice: 3500,
          },
          {
            name: 'Ibuprofeno 400mg',
            sku: 'ANA-002',
            currentStock: 80,
            minStock: 15,
            maxStock: 150,
            averagePurchasePrice: 2000,
            sellingPrice: 4500,
          },
          {
            name: 'Naproxeno 550mg',
            sku: 'ANA-003',
            currentStock: 60,
            minStock: 10,
            maxStock: 120,
            averagePurchasePrice: 3000,
            sellingPrice: 6500,
          },
        ],
        [
          {
            name: 'Amoxicilina 500mg',
            sku: 'ANT-001',
            currentStock: 90,
            minStock: 20,
            maxStock: 180,
            averagePurchasePrice: 2500,
            sellingPrice: 5500,
          },
          {
            name: 'Azitromicina 500mg',
            sku: 'ANT-002',
            currentStock: 50,
            minStock: 10,
            maxStock: 100,
            averagePurchasePrice: 8000,
            sellingPrice: 18000,
          },
          {
            name: 'Cefalexina 500mg',
            sku: 'ANT-003',
            currentStock: 70,
            minStock: 15,
            maxStock: 140,
            averagePurchasePrice: 3500,
            sellingPrice: 7500,
          },
        ],
        [
          {
            name: 'Meloxicam 15mg',
            sku: 'AIF-001',
            currentStock: 55,
            minStock: 10,
            maxStock: 110,
            averagePurchasePrice: 4000,
            sellingPrice: 8500,
          },
          {
            name: 'Piroxicam 20mg',
            sku: 'AIF-002',
            currentStock: 45,
            minStock: 10,
            maxStock: 100,
            averagePurchasePrice: 3500,
            sellingPrice: 7500,
          },
          {
            name: 'Celecoxib 200mg',
            sku: 'AIF-003',
            currentStock: 40,
            minStock: 8,
            maxStock: 80,
            averagePurchasePrice: 12000,
            sellingPrice: 25000,
          },
        ],
        [
          {
            name: 'Vitamina C 1000mg',
            sku: 'VIT-001',
            currentStock: 120,
            minStock: 25,
            maxStock: 250,
            averagePurchasePrice: 3000,
            sellingPrice: 6500,
          },
          {
            name: 'Complejo B',
            sku: 'VIT-002',
            currentStock: 90,
            minStock: 20,
            maxStock: 180,
            averagePurchasePrice: 5000,
            sellingPrice: 11000,
          },
          {
            name: 'Vitamina D3 2000 UI',
            sku: 'VIT-003',
            currentStock: 70,
            minStock: 15,
            maxStock: 140,
            averagePurchasePrice: 4500,
            sellingPrice: 9500,
          },
        ],
        [
          {
            name: 'Crema Hidratante',
            sku: 'PEL-001',
            currentStock: 60,
            minStock: 10,
            maxStock: 120,
            averagePurchasePrice: 8000,
            sellingPrice: 18000,
          },
          {
            name: 'Protector Solar SPF 50',
            sku: 'PEL-002',
            currentStock: 40,
            minStock: 8,
            maxStock: 80,
            averagePurchasePrice: 15000,
            sellingPrice: 32000,
          },
          {
            name: 'Crema Antifúngica',
            sku: 'PEL-003',
            currentStock: 35,
            minStock: 5,
            maxStock: 70,
            averagePurchasePrice: 10000,
            sellingPrice: 22000,
          },
        ],
        [
          {
            name: 'Omeprazol 20mg',
            sku: 'DIG-001',
            currentStock: 110,
            minStock: 25,
            maxStock: 220,
            averagePurchasePrice: 2000,
            sellingPrice: 5000,
          },
          {
            name: 'Domperidona 10mg',
            sku: 'DIG-002',
            currentStock: 75,
            minStock: 15,
            maxStock: 150,
            averagePurchasePrice: 3500,
            sellingPrice: 7500,
          },
          {
            name: 'Loperamida 2mg',
            sku: 'DIG-003',
            currentStock: 65,
            minStock: 10,
            maxStock: 130,
            averagePurchasePrice: 2500,
            sellingPrice: 5500,
          },
        ],
        [
          {
            name: 'Salbutamol Inhalador',
            sku: 'RES-001',
            currentStock: 30,
            minStock: 5,
            maxStock: 60,
            averagePurchasePrice: 12000,
            sellingPrice: 28000,
          },
          {
            name: 'Ambroxol 30mg',
            sku: 'RES-002',
            currentStock: 85,
            minStock: 15,
            maxStock: 170,
            averagePurchasePrice: 2000,
            sellingPrice: 4500,
          },
          {
            name: 'Acetilcisteína 600mg',
            sku: 'RES-003',
            currentStock: 50,
            minStock: 10,
            maxStock: 100,
            averagePurchasePrice: 5000,
            sellingPrice: 11000,
          },
        ],
        [
          {
            name: 'Loratadina 10mg',
            sku: 'ALE-001',
            currentStock: 95,
            minStock: 20,
            maxStock: 190,
            averagePurchasePrice: 1500,
            sellingPrice: 3500,
          },
          {
            name: 'Cetirizina 10mg',
            sku: 'ALE-002',
            currentStock: 80,
            minStock: 15,
            maxStock: 160,
            averagePurchasePrice: 1800,
            sellingPrice: 4000,
          },
          {
            name: 'Fexofenadina 120mg',
            sku: 'ALE-003',
            currentStock: 45,
            minStock: 10,
            maxStock: 90,
            averagePurchasePrice: 7000,
            sellingPrice: 15000,
          },
        ],
        [
          {
            name: 'Losartán 50mg',
            sku: 'CAR-001',
            currentStock: 100,
            minStock: 20,
            maxStock: 200,
            averagePurchasePrice: 3000,
            sellingPrice: 6500,
          },
          {
            name: 'Enalapril 10mg',
            sku: 'CAR-002',
            currentStock: 90,
            minStock: 15,
            maxStock: 180,
            averagePurchasePrice: 2500,
            sellingPrice: 5500,
          },
          {
            name: 'Atorvastatina 20mg',
            sku: 'CAR-003',
            currentStock: 70,
            minStock: 15,
            maxStock: 140,
            averagePurchasePrice: 6000,
            sellingPrice: 13000,
          },
        ],
        [
          {
            name: 'Venda Elástica 3x5yds',
            sku: 'AUX-001',
            currentStock: 150,
            minStock: 30,
            maxStock: 300,
            averagePurchasePrice: 2000,
            sellingPrice: 4500,
          },
          {
            name: 'Gasas Estériles 10x10',
            sku: 'AUX-002',
            currentStock: 200,
            minStock: 40,
            maxStock: 400,
            averagePurchasePrice: 1000,
            sellingPrice: 2500,
          },
          {
            name: 'Alcohol Antiséptico 500ml',
            sku: 'AUX-003',
            currentStock: 80,
            minStock: 15,
            maxStock: 160,
            averagePurchasePrice: 3000,
            sellingPrice: 6500,
          },
        ],
      ];

      const productInserts: any[] = [];
      for (let catIdx = 0; catIdx < productsByCategory.length; catIdx++) {
        for (const p of productsByCategory[catIdx]) {
          productInserts.push({ ...p, categoryId: categoryIds[catIdx] });
        }
      }

      const products = await em.insert(Product, productInserts);

      const productTaxValues = products.identifiers
        .map((id) => `('${id.id}', '${iva19Id}')`)
        .join(', ');
      if (productTaxValues) {
        await em.query(
          `INSERT INTO products_taxes (product_id, tax_id) VALUES ${productTaxValues}`,
        );
      }

      return {
        taxes: taxes.identifiers?.length || taxData.length,
        paymentMethods: paymentMethods.identifiers?.length || pmData.length,
        paymentTypes: paymentTypes.identifiers?.length || ptData.length,
        categories: categories.identifiers?.length || categoryData.length,
        products: products.identifiers?.length || productInserts.length,
        municipalities:
          municipalities.identifiers?.length || municipalityData.length,
      };
    });
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppLoggerService } from '../logging/app-logger.service';
import { CustomersService } from '../customers/customers.service';
import { CategoriesService } from './categories/categories.service';
import { ItemsService } from './items/items.service';
import { ITEM_STATUS } from './inventory.constants';

/**
 * Seeds demo categories / customers / items when the catalog is empty.
 * Skip with JUMAN_SEED_DEMO=0. Force re-check only when zero live categories.
 */
@Injectable()
export class DemoDataBootstrapService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly customers: CustomersService,
    private readonly items: ItemsService,
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.JUMAN_SEED_DEMO === '0') {
      this.logger.startup('Demo seed skipped (JUMAN_SEED_DEMO=0)');
      return;
    }
    await this.ensureDemoData();
  }

  async ensureDemoData(): Promise<void> {
    const existing = await this.prisma.category.count({
      where: { deletedAt: null },
    });
    if (existing > 0) {
      this.logger.startup('Demo seed skipped (categories already present)', {
        categories: existing,
      });
      return;
    }

    this.logger.startup('Seeding demo catalog data…');

    const catEvening = await this.categories.create({
      name: 'فساتين سهرة',
      nameEn: 'Evening',
      sortOrder: 1,
      isActive: true,
    });
    const catWedding = await this.categories.create({
      name: 'فساتين زفاف',
      nameEn: 'Wedding',
      sortOrder: 2,
      isActive: true,
    });
    const catEngagement = await this.categories.create({
      name: 'فساتين خطوبة',
      nameEn: 'Engagement',
      sortOrder: 3,
      isActive: true,
    });

    const c1 = await this.customers.create({
      fullName: 'سارة أحمد',
      phone: '07501234567',
      city: 'بغداد',
      notes: 'عميلة تجريبية',
    });
    const c2 = await this.customers.create({
      fullName: 'نور حسين',
      phone: '07709876543',
      city: 'البصرة',
    });
    const c3 = await this.customers.create({
      fullName: 'مريم علي',
      phone: '07801112233',
      city: 'أربيل',
    });

    // Prices in fils (IQD × 1000)
    await this.items.create({
      displayName: 'فستان سهرة أسود مطرز',
      categoryId: catEvening.id,
      purchasePrice: 800_000_000,
      rentalPrice: 150_000_000,
      salePrice: 900_000_000,
      status: ITEM_STATUS.ACTIVE,
      generateBarcode: true,
      description: 'بيانات تجريبية',
    });
    await this.items.create({
      displayName: 'فستان زفاف أبيض كلاسيك',
      categoryId: catWedding.id,
      purchasePrice: 1_500_000_000,
      rentalPrice: 350_000_000,
      salePrice: 1_800_000_000,
      status: ITEM_STATUS.ACTIVE,
      generateBarcode: true,
    });
    await this.items.create({
      displayName: 'فستان خطوبة وردي',
      categoryId: catEngagement.id,
      purchasePrice: 600_000_000,
      rentalPrice: 120_000_000,
      salePrice: 700_000_000,
      status: ITEM_STATUS.ACTIVE,
      generateBarcode: true,
    });
    await this.items.create({
      displayName: 'فستان سهرة ذهبي',
      categoryId: catEvening.id,
      purchasePrice: 700_000_000,
      rentalPrice: 180_000_000,
      salePrice: 850_000_000,
      status: ITEM_STATUS.ACTIVE,
      generateBarcode: true,
    });

    this.logger.startup('Demo seed complete', {
      categories: 3,
      customers: [c1.customerNumber, c2.customerNumber, c3.customerNumber],
      items: 4,
    });
  }
}

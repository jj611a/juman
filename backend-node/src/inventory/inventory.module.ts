import { Module } from '@nestjs/common';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesRepository } from './categories/categories.repository';
import { CategoriesService } from './categories/categories.service';
import { BrandsController } from './brands/brands.controller';
import { BrandsRepository } from './brands/brands.repository';
import { BrandsService } from './brands/brands.service';
import { ColorsController } from './colors/colors.controller';
import { ColorsRepository } from './colors/colors.repository';
import { ColorsService } from './colors/colors.service';
import { SizesController } from './sizes/sizes.controller';
import { SizesRepository } from './sizes/sizes.repository';
import { SizesService } from './sizes/sizes.service';
import { ItemsController } from './items/items.controller';
import { ItemsRepository } from './items/items.repository';
import { ItemsService } from './items/items.service';
@Module({
  controllers: [
    CategoriesController,
    BrandsController,
    ColorsController,
    SizesController,
    ItemsController,
  ],
  providers: [
    CategoriesRepository,
    CategoriesService,
    BrandsRepository,
    BrandsService,
    ColorsRepository,
    ColorsService,
    SizesRepository,
    SizesService,
    ItemsRepository,
    ItemsService,
  ],
  exports: [
    CategoriesService,
    BrandsService,
    ColorsService,
    SizesService,
    ItemsService,
  ],
})
export class InventoryModule {}

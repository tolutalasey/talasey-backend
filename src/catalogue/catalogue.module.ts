import { Module } from '@nestjs/common';
import { CatalogueChanges } from './catalogue-changes.service.js';
import { CatalogueTransferController } from './catalogue-transfer.controller.js';
import { ColourSetAdminController } from './colour-sets/colour-set-admin.controller.js';
import { ColourSetRepository } from './colour-sets/colour-set.repository.js';
import { ColourSetService } from './colour-sets/colour-set.service.js';
import { CatalogueImporter } from './import/catalogue-import.js';
import { ProductAdminController } from './product-admin.controller.js';
import { ProductAdminService } from './product-admin.service.js';
import { ProductRepository } from './product.repository.js';
import { StoreCatalogueController } from './store-catalogue.controller.js';
import { StoreCatalogueService } from './store-catalogue.service.js';

@Module({
  controllers: [
    StoreCatalogueController,
    ProductAdminController,
    ColourSetAdminController,
    CatalogueTransferController,
  ],
  providers: [
    ProductRepository,
    ColourSetRepository,
    CatalogueChanges,
    ProductAdminService,
    ColourSetService,
    StoreCatalogueService,
    CatalogueImporter,
  ],
  exports: [
    ProductRepository,
    ColourSetRepository,
    StoreCatalogueService,
    CatalogueChanges,
    CatalogueImporter,
  ],
})
export class CatalogueModule {}

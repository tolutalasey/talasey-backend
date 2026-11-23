import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { EnquiriesModule } from '../enquiries/enquiries.module.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { APP_CONFIG } from '../config/config.module.js';
import { ANSWER_MODEL, answerModelFor } from './answer-model.js';
import { AssistantPhotos } from './assistant-photos.js';
import { StoreAssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { fetchKnowledge, KNOWLEDGE_FETCH, SiteKnowledgeService } from './site-knowledge.service.js';

@Module({
  imports: [CatalogueModule, UploadsModule, EnquiriesModule],
  controllers: [StoreAssistantController],
  providers: [
    { provide: ANSWER_MODEL, inject: [APP_CONFIG], useFactory: answerModelFor },
    { provide: KNOWLEDGE_FETCH, useValue: fetchKnowledge },
    SiteKnowledgeService,
    AssistantPhotos,
    AssistantService,
  ],
})
export class AssistantModule {}

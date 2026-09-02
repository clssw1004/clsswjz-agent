import { Module } from '@nestjs/common';
import { ItemRelationController } from './item-relation.controller';
import { ItemRelationService } from './item-relation.service';

@Module({
  controllers: [ItemRelationController],
  providers: [ItemRelationService],
})
export class ItemRelationModule {}

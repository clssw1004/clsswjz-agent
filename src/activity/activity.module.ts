import { Module } from '@nestjs/common';
import {
  ActivityDefinitionController,
  ActivityRecordController,
} from './activity.controller';
import { ActivityService } from './activity.service';

@Module({
  controllers: [ActivityDefinitionController, ActivityRecordController],
  providers: [ActivityService],
})
export class ActivityModule {}

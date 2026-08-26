import { Module } from '@nestjs/common';
import { UserShareController } from './user-share.controller';
import { UserShareService } from './user-share.service';

@Module({
  controllers: [UserShareController],
  providers: [UserShareService],
})
export class UserShareModule {}

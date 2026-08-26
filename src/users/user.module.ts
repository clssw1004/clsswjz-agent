import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AttachmentModule } from '../attachments/attachment.module';

@Module({
  imports: [AttachmentModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}

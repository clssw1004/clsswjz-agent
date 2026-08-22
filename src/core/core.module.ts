import { Global, Module } from '@nestjs/common';
import { ConnectionManager } from './connection-manager';

@Global()
@Module({
  providers: [ConnectionManager],
  exports: [ConnectionManager],
})
export class CoreModule {}

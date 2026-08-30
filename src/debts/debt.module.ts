import { Module } from '@nestjs/common';
import { ItemModule } from '../items/item.module';
import { DebtController } from './debt.controller';
import { DebtService } from './debt.service';

@Module({
  imports: [ItemModule],
  controllers: [DebtController],
  providers: [DebtService],
})
export class DebtModule {}

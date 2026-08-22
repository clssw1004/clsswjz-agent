import { Entity, Column } from 'typeorm';
import { BaseBusinessEntity } from './base.entity';
import { Currency } from '../enums/currency.enum';

@Entity('account_books')
export class AccountBook extends BaseBusinessEntity {
  @Column({ length: 50 })
  name: string;

  @Column({ length: 200, nullable: true })
  description: string;

  @Column({ length: 32, nullable: true })
  defaultFundId: string;

  @Column({ type: 'varchar', default: Currency.CNY })
  currencySymbol: Currency;

  @Column({ nullable: true })
  icon: string;
}

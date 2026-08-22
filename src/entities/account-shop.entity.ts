import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';

@Entity('account_shops')
export class AccountShop extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 128 })
  name: string;

  @Column({ length: 16 })
  code: string;
}

import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';
import { ItemType } from '../enums/item-type.enum';

@Entity('account_categories')
export class AccountCategory extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 128 })
  name: string;

  @Column({ length: 16 })
  code: string;

  @Column({ type: 'varchar', length: 10 })
  categoryType: ItemType;

  @Column({ nullable: true })
  lastAccountItemAt: Date;
}

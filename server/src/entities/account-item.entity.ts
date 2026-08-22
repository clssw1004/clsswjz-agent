import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';
import { ItemType } from '../enums/item-type.enum';

@Entity('account_items')
export class AccountItem extends BaseBusinessEntityWithAccountBook {
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 10, default: ItemType.EXPENSE })
  type: ItemType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  categoryCode: string;

  @Column({ type: 'varchar', length: 32 })
  accountDate: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  fundId: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  shopCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tagCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  projectCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  source: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  sourceId: string;
}

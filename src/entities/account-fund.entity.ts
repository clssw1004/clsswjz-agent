import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';

@Entity('account_funds')
export class AccountFund extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  fundType: string;

  @Column({ type: 'text', nullable: true })
  fundRemark: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fundBalance: number;

  @Column({ default: false })
  isDefault: boolean;
}

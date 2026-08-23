import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';

/** 债务（对齐 gui account_debt_table） */
@Entity('account_debts')
export class AccountDebt extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 20 })
  debtType: string;

  @Column({ length: 50 })
  debtor: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ length: 32 })
  fundId: string;

  @Column({ length: 32 })
  debtDate: string;

  @Column({ length: 32, nullable: true })
  clearDate: string;

  @Column({ length: 32, nullable: true })
  expectedClearDate: string;

  @Column({ length: 20, nullable: true })
  clearState: string;
}

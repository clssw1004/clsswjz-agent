import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';

/** 记账规则（对齐 gui bookkeeping_rule_table） */
@Entity('bookkeeping_rules')
export class BookkeepingRule extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 50 })
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'text', nullable: true })
  conditionsJson: string;

  @Column({ type: 'text', nullable: true })
  actionsJson: string;
}

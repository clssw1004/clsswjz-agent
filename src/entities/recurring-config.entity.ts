import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';

/** 固定收支配置（对齐 gui recurring_config_table） */
@Entity('recurring_configs')
export class RecurringConfig extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 20 })
  type: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 32, nullable: true })
  categoryCode: string;

  @Column({ length: 32, nullable: true })
  fundId: string;

  @Column({ length: 32, nullable: true })
  shopCode: string;

  @Column({ length: 32, nullable: true })
  tagCode: string;

  @Column({ length: 32, nullable: true })
  projectCode: string;

  @Column({ length: 20 })
  frequencyType: string;

  @Column({ length: 20 })
  frequencyValue: string;

  @Column({ length: 32 })
  startDate: string;

  @Column({ length: 20 })
  endType: string;

  @Column({ length: 32, nullable: true })
  endDate: string;

  @Column({ type: 'int', nullable: true })
  endCount: number;

  @Column({ type: 'int', nullable: true })
  generatedCount: number;

  @Column({ length: 32, nullable: true })
  lastGeneratedAt: string;

  @Column({ default: true })
  isActive: boolean;
}

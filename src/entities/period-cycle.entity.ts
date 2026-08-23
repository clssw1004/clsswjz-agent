import { Entity, Column } from 'typeorm';
import { BaseBusinessEntity } from './base.entity';

/** 经期周期（对齐 gui period_cycle_table，无账本归属） */
@Entity('period_cycles')
export class PeriodCycle extends BaseBusinessEntity {
  @Column({ length: 32 })
  startDate: string;

  @Column({ length: 32, nullable: true })
  endDate: string;

  @Column({ type: 'int', nullable: true })
  typicalPeriodDays: number;

  @Column({ type: 'int', nullable: true })
  typicalCycleDays: number;
}

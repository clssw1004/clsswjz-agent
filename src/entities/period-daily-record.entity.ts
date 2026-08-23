import { Entity, Column } from 'typeorm';
import { BaseBusinessEntity } from './base.entity';

/** 经期每日明细（对齐 gui period_daily_record_table，无账本归属；symptoms 为 JSON 字符串） */
@Entity('period_daily_records')
export class PeriodDailyRecord extends BaseBusinessEntity {
  @Column({ length: 32 })
  cycleId: string;

  @Column({ length: 32 })
  recordDate: string;

  @Column({ length: 20, nullable: true })
  flowLevel: string;

  @Column({ type: 'text', nullable: true })
  symptoms: string;

  @Column({ length: 20, nullable: true })
  mood: string;

  @Column({ type: 'text', nullable: true })
  remark: string;
}

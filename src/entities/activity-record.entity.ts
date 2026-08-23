import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';

/** 活动打卡记录（对齐 gui activity_record_table） */
@Entity('activity_records')
export class ActivityRecord extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 50 })
  activityName: string;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ length: 32 })
  recordDate: string;

  @Column({ length: 32, nullable: true })
  activityDefId: string;

  @Column({ type: 'int', nullable: true })
  maxDailyCount: number;

  @Column({ type: 'text', nullable: true })
  remark: string;
}

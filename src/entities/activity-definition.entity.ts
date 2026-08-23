import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';

/** 活动定义（对齐 gui activity_definition_table） */
@Entity('activity_definitions')
export class ActivityDefinition extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 50 })
  name: string;

  @Column({ length: 16 })
  emoji: string;

  @Column({ type: 'int', default: 0 })
  color: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'int', nullable: true })
  maxDailyCount: number;
}

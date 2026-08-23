import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * 账目关联字段（对齐移动端 item_rel_field 表）。
 * 多标签存储：一条记录 = item 与一个标签 code 的关联（fieldCode='TAG'）。
 * AccountItem.tagCode 为历史遗留兼容字段，不再作为多标签的唯一事实来源。
 */
@Entity('item_rel_field')
@Index(['itemId', 'fieldCode'])
export class ItemRelField extends BaseEntity {
  @Column({ length: 32 })
  itemId: string;

  @Column({ length: 32 })
  fieldCode: string;

  @Column({ length: 64 })
  fieldValue: string;

  @Column({ type: 'int', nullable: true })
  sortOrder: number;
}

import { Entity, Column } from 'typeorm';
import { BaseBusinessEntity } from './base.entity';

/** 账目关联（对齐 gui item_relation_table） */
@Entity('item_relations')
export class ItemRelation extends BaseBusinessEntity {
  @Column({ length: 32 })
  itemId: string;

  @Column({ length: 32 })
  accountBookId: string;

  @Column({ length: 32 })
  relationCode: string;

  @Column({ length: 32 })
  relationId: string;
}

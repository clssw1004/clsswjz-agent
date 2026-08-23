import { Entity, Column, Unique } from 'typeorm';
import { BaseBusinessEntity } from './base.entity';

/** 用户模块共享（对齐 gui user_share_table，无账本归属；同一 owner+target+business 唯一） */
@Entity('user_shares')
@Unique(['ownerUserId', 'targetUserId', 'businessType'])
export class UserShare extends BaseBusinessEntity {
  @Column({ length: 32 })
  ownerUserId: string;

  @Column({ length: 32 })
  targetUserId: string;

  @Column({ length: 32 })
  businessType: string;

  @Column({ default: false })
  isEnabled: boolean;
}

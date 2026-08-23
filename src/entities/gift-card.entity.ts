import { Entity, Column } from 'typeorm';
import { BaseBusinessEntity } from './base.entity';

/** 礼物卡（对齐 gui gift_card_table，无账本归属） */
@Entity('gift_cards')
export class GiftCard extends BaseBusinessEntity {
  @Column({ length: 64 })
  fromUserId: string;

  @Column({ length: 64 })
  toUserId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'bigint', default: 0 })
  expiredTime: number;

  @Column({ type: 'bigint', default: 0 })
  sentTime: number;

  @Column({ type: 'bigint', default: 0 })
  receivedTime: number;

  @Column({ length: 20, nullable: true })
  status: string;
}

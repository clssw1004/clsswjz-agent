import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';

@Entity('account_notes')
export class AccountNote extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 200, nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ length: 20 })
  noteType: string;

  @Column({ length: 50, nullable: true })
  groupCode: string;

  @Column({ length: 20, default: 'book' })
  scope: string;

  @Column({ type: 'text', nullable: true })
  template: string;
}

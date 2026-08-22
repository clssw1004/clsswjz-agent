import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('rel_accountbook_user')
export class AccountBookUser extends BaseEntity {
  @Column({ length: 32 })
  userId: string;

  @Column({ length: 32 })
  accountBookId: string;

  @Column({ default: true })
  canViewBook: boolean;

  @Column({ default: false })
  canEditBook: boolean;

  @Column({ default: false })
  canDeleteBook: boolean;

  @Column({ default: true })
  canViewItem: boolean;

  @Column({ default: false })
  canEditItem: boolean;

  @Column({ default: false })
  canDeleteItem: boolean;
}

import { PrimaryColumn, Column, BeforeInsert, BeforeUpdate } from 'typeorm';
import { generateId } from '../core/id.util';

export abstract class StringIdEntity {
  @PrimaryColumn({ length: 32 })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = generateId();
  }
}

export abstract class BaseEntity extends StringIdEntity {
  @Column({ type: 'bigint', default: 0 })
  createdAt: number;

  @Column({ type: 'bigint', default: 0 })
  updatedAt: number;

  @BeforeInsert()
  setTimestamps() {
    const now = Date.now();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = Date.now();
  }
}

export abstract class BaseBusinessEntity extends BaseEntity {
  @Column({ length: 32, default: '' })
  createdBy: string;

  @Column({ length: 32, default: '' })
  updatedBy: string;
}

export abstract class BaseBusinessEntityWithAccountBook extends BaseBusinessEntity {
  @Column({ length: 32, default: '' })
  accountBookId: string;
}

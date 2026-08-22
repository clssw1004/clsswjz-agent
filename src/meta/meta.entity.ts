import { Entity, Column, PrimaryColumn, BeforeInsert, BeforeUpdate } from 'typeorm';

@Entity('users')
export class MetaUser {
  @PrimaryColumn({ length: 32 })
  id: string;

  @Column({ length: 50, default: '' })
  nickname: string;

  @Column({ length: 255, default: '' })
  mainServerUrl: string;

  @Column({ type: 'text', default: '' })
  mainToken: string;

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

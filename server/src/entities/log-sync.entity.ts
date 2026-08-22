import { Entity, Column, Unique } from 'typeorm';
import { StringIdEntity } from './base.entity';
import { BusinessType } from '../enums/business-type.enum';
import { OperateType } from '../enums/operate-type.enum';
import { SyncState } from '../enums/sync-state.enum';

@Entity('log_sync')
@Unique(['parentType', 'parentId', 'businessType', 'businessId', 'operatorId', 'operatedAt'])
export class LogSync extends StringIdEntity {
  @Column({ type: 'varchar', length: 32 })
  businessType: BusinessType;

  @Column({ type: 'varchar', length: 32 })
  operateType: OperateType;

  @Column({ type: 'varchar', length: 32, nullable: true })
  parentType: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  parentId: string;

  @Column({ type: 'varchar', length: 32 })
  operatorId: string;

  @Column({ type: 'bigint' })
  operatedAt: number;

  @Column({ type: 'varchar', length: 32 })
  businessId: string;

  @Column({ type: 'text', nullable: true })
  operateData: string;

  @Column({ type: 'varchar', length: 32, default: SyncState.UNSYNCED })
  syncState: SyncState;

  @Column({ type: 'bigint', nullable: true })
  syncTime: number;

  @Column({ type: 'text', nullable: true })
  syncError: string;

  @Column({ type: 'bigint', nullable: true })
  materializedAt: number;

  @Column({ type: 'text', nullable: true })
  materializeError: string;
}

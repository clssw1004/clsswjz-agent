import { Entity, Column } from 'typeorm';
import { BaseBusinessEntity } from './base.entity';

/** 加油记录（对齐 gui fuel_record_table，无账本归属） */
@Entity('fuel_records')
export class FuelRecord extends BaseBusinessEntity {
  @Column({ length: 32 })
  vehicleId: string;

  @Column({ type: 'int', default: 0 })
  mileage: number;

  @Column({ length: 10 })
  energyType: string;

  @Column({ length: 10 })
  fuelGrade: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  volume: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'int', default: 0 })
  isFullTank: number;

  @Column({ type: 'int', nullable: true })
  isFuelLightOn: number;

  @Column({ type: 'text', nullable: true })
  station: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column({ type: 'bigint', default: 0 })
  refuelTime: number;

  @Column({ length: 32, nullable: true })
  linkedBookId: string;

  @Column({ length: 32, nullable: true })
  linkedItemId: string;
}

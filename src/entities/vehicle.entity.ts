import { Entity, Column } from 'typeorm';
import { BaseBusinessEntity } from './base.entity';

/** 车辆（对齐 gui vehicle_table，无账本归属） */
@Entity('vehicles')
export class Vehicle extends BaseBusinessEntity {
  @Column({ length: 20 })
  plateNumber: string;

  @Column({ length: 30 })
  brand: string;

  @Column({ length: 30 })
  model: string;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column({ length: 10, nullable: true })
  defaultFuelGrade: string;

  @Column({ type: 'int', default: 1 })
  isActive: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}

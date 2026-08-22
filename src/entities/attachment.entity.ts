import { Entity, Column } from 'typeorm';
import { BaseBusinessEntity } from './base.entity';

@Entity('attachment')
export class AttachmentEntity extends BaseBusinessEntity {
  @Column({ name: 'origin_name' })
  originName: string;

  @Column({ name: 'file_length' })
  fileLength: number;

  @Column({ name: 'extension' })
  extension: string;

  @Column({ name: 'content_type' })
  contentType: string;

  @Column({ type: 'varchar', length: 20, name: 'business_code' })
  businessCode: string;

  @Column({ name: 'business_id' })
  businessId: string;
}

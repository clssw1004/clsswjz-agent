import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * 业务用户实体（per-user 库，与 meta.db 的 users 连接凭证表是不同数据库，无冲突）。
 * 对齐 gui user_table：同步日志中 businessType=user 的 operateData 回放落库。
 */
@Entity('users')
export class AppUser extends BaseEntity {
  @Column({ length: 50 })
  username: string;

  @Column({ length: 50 })
  nickname: string;

  @Column({ type: 'text', nullable: true })
  avatar: string;

  @Column({ type: 'text' })
  password: string;

  @Column({ type: 'text', nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  phone: string;

  @Column({ length: 32, default: '' })
  inviteCode: string;

  @Column({ length: 20, default: 'zh-CN' })
  language: string;

  @Column({ length: 40, default: 'Asia/Shanghai' })
  timezone: string;

  /** 用户偏好（JSON 字符串），仅本 agent 持久化，不同步到主端 */
  @Column({ type: 'text', nullable: true })
  preferences: string;
}

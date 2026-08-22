import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { MetaUser } from './meta.entity';
import { UserService } from './user.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqlite',
        database: `${config.get('dataPath') || './data'}/meta.db`,
        entities: [MetaUser],
        synchronize: true,
        // WAL 允许读写并发；busy_timeout 让写锁冲突时等待而不是立刻抛 SQLITE_BUSY
        enableWAL: true,
        busyTimeout: 5000,
      }),
    }),
    TypeOrmModule.forFeature([MetaUser]),
  ],
  providers: [UserService],
  exports: [UserService],
})
export class MetaModule {}

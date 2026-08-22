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
      }),
    }),
    TypeOrmModule.forFeature([MetaUser]),
  ],
  providers: [UserService],
  exports: [UserService],
})
export class MetaModule {}

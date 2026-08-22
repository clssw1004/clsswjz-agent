import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import configuration from './config/configuration';
import { CoreModule } from './core/core.module';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { MetaModule } from './meta/meta.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { SyncModule } from './sync/sync.module';
import { ItemModule } from './items/item.module';
import { BookModule } from './books/book.module';
import { CategoryModule } from './categories/category.module';
import { FundModule } from './funds/fund.module';
import { ShopModule } from './shops/shop.module';
import { TagModule } from './tags/tag.module';
import { ProjectModule } from './projects/project.module';
import { NoteModule } from './notes/note.module';
import { AttachmentModule } from './attachments/attachment.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      exclude: ['/api/(.*)'],
    }),
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    CoreModule,
    MetaModule,
    AuthModule,
    SyncModule,
    ItemModule,
    BookModule,
    CategoryModule,
    FundModule,
    ShopModule,
    TagModule,
    ProjectModule,
    NoteModule,
    AttachmentModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}

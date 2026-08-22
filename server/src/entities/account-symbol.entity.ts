import { Entity, Column } from 'typeorm';
import { BaseBusinessEntityWithAccountBook } from './base.entity';
import { SymbolType } from '../enums/symbol-type.enum';

@Entity('account_symbols')
export class AccountSymbol extends BaseBusinessEntityWithAccountBook {
  @Column({ length: 128 })
  name: string;

  @Column({ length: 16 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  symbolType: SymbolType;
}

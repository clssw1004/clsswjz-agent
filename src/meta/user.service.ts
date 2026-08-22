import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetaUser } from './meta.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(MetaUser)
    private readonly userRepo: Repository<MetaUser>,
  ) {}

  async findAll(): Promise<MetaUser[]> {
    return this.userRepo.find();
  }

  async findById(id: string): Promise<MetaUser | null> {
    return this.userRepo.findOneBy({ id });
  }

  async upsertUser(data: {
    id: string;
    nickname: string;
    mainServerUrl: string;
    mainToken: string;
  }): Promise<MetaUser> {
    let user = await this.userRepo.findOneBy({ id: data.id });
    if (user) {
      user.nickname = data.nickname;
      user.mainServerUrl = data.mainServerUrl;
      user.mainToken = data.mainToken;
    } else {
      user = this.userRepo.create(data);
    }
    return this.userRepo.save(user);
  }
}

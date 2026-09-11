import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuracao } from './entities/configuracao.entity';
import { ConfiguracoesService } from './configuracoes.service';
import { ConfiguracoesController } from './configuracoes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Configuracao])],
  controllers: [ConfiguracoesController],
  providers: [ConfiguracoesService],
  exports: [ConfiguracoesService],
})
export class ConfiguracoesModule {}

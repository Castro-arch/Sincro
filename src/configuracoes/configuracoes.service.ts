import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CHAVE_IMPOSTO, Configuracao } from './entities/configuracao.entity';

@Injectable()
export class ConfiguracoesService {
  constructor(
    @InjectRepository(Configuracao)
    private readonly repo: Repository<Configuracao>,
  ) {}

  async ler(chave: string, padrao: string): Promise<string> {
    const linha = await this.repo.findOne({ where: { chave } });
    return linha?.valor ?? padrao;
  }

  async gravar(chave: string, valor: string): Promise<Configuracao> {
    const linha = (await this.repo.findOne({ where: { chave } })) ?? this.repo.create({ chave });
    linha.valor = valor;
    return this.repo.save(linha);
  }

  /** Percentual de imposto que o usuario informa. 0 quando nao configurado. */
  async impostoPercentual(): Promise<number> {
    const bruto = await this.ler(CHAVE_IMPOSTO, '0');
    const numero = Number(bruto);
    return Number.isFinite(numero) ? numero : 0;
  }

  async definirImposto(percentual: number): Promise<number> {
    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      throw new BadRequestException('O percentual de imposto deve ficar entre 0 e 100.');
    }
    await this.gravar(CHAVE_IMPOSTO, String(percentual));
    return percentual;
  }
}

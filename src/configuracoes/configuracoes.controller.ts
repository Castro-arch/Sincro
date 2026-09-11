import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsNumber, Max, Min } from 'class-validator';
import { ConfiguracoesService } from './configuracoes.service';

export class DefinirImpostoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentual!: number;
}

@Controller('configuracoes')
export class ConfiguracoesController {
  constructor(private readonly service: ConfiguracoesService) {}

  @Get('imposto')
  async ler(): Promise<{ percentual: number }> {
    return { percentual: await this.service.impostoPercentual() };
  }

  @Put('imposto')
  async definir(@Body() dto: DefinirImpostoDto): Promise<{ percentual: number }> {
    return { percentual: await this.service.definirImposto(dto.percentual) };
  }
}

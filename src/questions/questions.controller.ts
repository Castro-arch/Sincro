import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { QuestionsService, ResultadoSincronizacaoPerguntas } from './questions.service';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { Question } from './entities/question.entity';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  /** GET /questions?status=pendentes (padrao) | todas */
  @Get()
  async listar(@Query('status') status?: string): Promise<Question[]> {
    return this.questionsService.listar(status !== 'todas');
  }

  /** Leve, para o selo da sidebar. */
  @Get('pending-count')
  async pendentes(): Promise<{ pendentes: number }> {
    return { pendentes: await this.questionsService.contarPendentes() };
  }

  /** Forca a rodada do polling agora. */
  @Post('sync')
  async sincronizar(): Promise<ResultadoSincronizacaoPerguntas> {
    return this.questionsService.sincronizar();
  }

  @Post(':id/answer')
  async responder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerQuestionDto,
  ): Promise<Question> {
    return this.questionsService.responder(id, dto.texto);
  }
}

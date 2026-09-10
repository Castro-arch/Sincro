import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnswerQuestionDto {
  /** Limite documentado do ML: 2.000 caracteres. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  texto!: string;
}

import { IsIn } from 'class-validator';

/** Status que o Mercado Livre aceita receber num PUT /items/{id}. */
export type StatusMl = 'active' | 'paused' | 'closed';

export class UpdateStatusDto {
  /**
   * `closed` encerra o anuncio e nao tem volta pelo mesmo item -- para tirar
   * de circulacao temporariamente, use `paused`.
   */
  @IsIn(['active', 'paused', 'closed'])
  status!: StatusMl;
}

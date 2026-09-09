import { BadRequestException, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import FormData from 'form-data';
import { MlHttpService } from '../ml-http.service';
import { MlPictureUploadResponse } from '../ml-api.types';

export interface ImagemEnviada {
  /** Id da imagem no ML -- e isso que vai em picture_ids do anuncio. */
  id: string;
  url: string | null;
  tamanhoOriginal: number;
  nomeArquivo: string;
}

/**
 * Formatos que o Mercado Livre aceita para imagens de anuncio: a documentacao
 * lista JPG, JPEG e PNG, e so isso. Nada de webp ou gif -- aceitar aqui o que
 * o ML recusa la nao ajuda ninguem: o upload pareceria funcionar e a imagem
 * so apareceria quebrada depois, na publicacao.
 */
const MIME_ACEITOS = ['image/jpeg', 'image/jpg', 'image/png'];

/** Limite do ML por imagem. */
export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

/**
 * Proxy de upload de imagens.
 *
 * O usuario envia o arquivo direto para o Sincro e o backend repassa em
 * multipart para POST /pictures/items/upload. Nada de hospedagem externa: o
 * binario so transita, quem guarda a imagem e o proprio Mercado Livre, e o
 * Sincro guarda apenas o id retornado.
 */
@Injectable()
export class MlPictureService {
  private readonly logger = new Logger(MlPictureService.name);

  constructor(private readonly http: MlHttpService) {}

  async enviarImagem(arquivo: Express.Multer.File): Promise<ImagemEnviada> {
    this.validarArquivo(arquivo);

    const form = new FormData();
    form.append('file', arquivo.buffer, {
      filename: arquivo.originalname,
      contentType: arquivo.mimetype,
      knownLength: arquivo.size,
    });

    const resposta = await this.http.post<MlPictureUploadResponse>(
      '/pictures/items/upload',
      form,
      {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    );

    const maiorVariacao = resposta.variations?.[0];
    this.logger.log(`Imagem "${arquivo.originalname}" enviada ao ML com id ${resposta.id}.`);

    return {
      id: resposta.id,
      url: maiorVariacao?.secure_url ?? maiorVariacao?.url ?? null,
      tamanhoOriginal: arquivo.size,
      nomeArquivo: arquivo.originalname,
    };
  }

  async enviarVarias(arquivos: Express.Multer.File[]): Promise<ImagemEnviada[]> {
    if (!arquivos?.length) {
      throw new BadRequestException('Nenhum arquivo recebido.');
    }
    // Sequencial de proposito: o volume e baixo e evita rate limit no ML.
    const enviadas: ImagemEnviada[] = [];
    for (const arquivo of arquivos) {
      enviadas.push(await this.enviarImagem(arquivo));
    }
    return enviadas;
  }

  private validarArquivo(arquivo: Express.Multer.File): void {
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException('Arquivo vazio ou ausente no campo "file".');
    }
    if (!MIME_ACEITOS.includes(arquivo.mimetype.toLowerCase())) {
      throw new BadRequestException(
        `Formato ${arquivo.mimetype} nao aceito. Use: ${MIME_ACEITOS.join(', ')}.`,
      );
    }
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      throw new PayloadTooLargeException(
        `Imagem com ${(arquivo.size / 1024 / 1024).toFixed(1)}MB excede o limite de 10MB do Mercado Livre.`,
      );
    }
  }
}

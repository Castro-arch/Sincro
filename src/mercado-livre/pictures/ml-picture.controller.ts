import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ImagemEnviada, MlPictureService, TAMANHO_MAXIMO_BYTES } from './ml-picture.service';

/**
 * Upload de imagem feito direto no Sincro. O arquivo fica em memoria apenas
 * durante o repasse ao Mercado Livre -- nada e gravado em disco.
 */
@Controller('ml/pictures')
export class MlPictureController {
  constructor(private readonly pictureService: MlPictureService) {}

  /** POST /ml/pictures/upload  (multipart, campo "file") */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TAMANHO_MAXIMO_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File): Promise<ImagemEnviada> {
    return this.pictureService.enviarImagem(file);
  }

  /** POST /ml/pictures/upload-multiple  (multipart, campo "files", ate 12) */
  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 12, { limits: { fileSize: TAMANHO_MAXIMO_BYTES } }))
  async uploadVarias(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ imagens: ImagemEnviada[] }> {
    return { imagens: await this.pictureService.enviarVarias(files) };
  }
}

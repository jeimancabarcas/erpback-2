import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly allowedMimes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed',
  ];

  private readonly maxSize = 10 * 1024 * 1024; // 10MB

  transform(
    file: Express.Multer.File | undefined,
  ): Express.Multer.File | undefined {
    if (!file) return undefined;

    if (!this.allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}. Permitidos: PDF, PNG, JPG, ZIP`,
      );
    }

    if (file.size > this.maxSize) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo de 10MB`,
      );
    }

    return file;
  }
}

/**
 * File management module
 *
 * Responsibilities:
 * - Manages prediction image files
 * - Serves files securely behind authentication
 * - Deletes files when their records are deleted
 *
 * Exports:
 * - FilesService: for use in other modules (e.g. ResultsModule)
 */

import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  imports: [],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

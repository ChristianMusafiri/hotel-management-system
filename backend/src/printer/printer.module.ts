import { Module } from '@nestjs/common';
import { PrinterService } from './printer.service';

@Module({
  providers: [PrinterService],
  exports: [PrinterService], //pour injection OrderModule
})
export class PrinterModule {}

import { Test, TestingModule } from '@nestjs/testing';
import { PrinterService } from './printer.service';
import { describe, expect, it, beforeEach } from '@jest/globals';

describe('PrinterService', () => {
  let service: PrinterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrinterService],
    }).compile();

    service = module.get<PrinterService>(PrinterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

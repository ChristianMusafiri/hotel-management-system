import { Test, TestingModule } from '@nestjs/testing';
import { PosShiftController } from './pos-shift.controller';
import { describe, expect, it, beforeEach } from '@jest/globals';

describe('PosShiftController', () => {
  let controller: PosShiftController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosShiftController],
    }).compile();

    controller = module.get<PosShiftController>(PosShiftController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

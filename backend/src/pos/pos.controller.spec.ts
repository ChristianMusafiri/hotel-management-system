import { Test, TestingModule } from '@nestjs/testing';
import { PosController } from './pos.controller';
import { describe, expect, it, beforeEach } from '@jest/globals';

describe('PosController', () => {
  let controller: PosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PosController],
    }).compile();

    controller = module.get<PosController>(PosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

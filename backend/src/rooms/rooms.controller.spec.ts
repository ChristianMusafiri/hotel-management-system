import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller';
import { describe, expect, it, beforeEach } from '@jest/globals';

describe('RoomsController', () => {
  let controller: RoomsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
    }).compile();

    controller = module.get<RoomsController>(RoomsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

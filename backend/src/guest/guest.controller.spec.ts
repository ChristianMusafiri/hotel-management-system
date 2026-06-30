import { Test, TestingModule } from '@nestjs/testing';
import { GuestController } from './guest.controller';
import { describe, expect, it, beforeEach } from '@jest/globals';

describe('GuestController', () => {
  let controller: GuestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GuestController],
    }).compile();

    controller = module.get<GuestController>(GuestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

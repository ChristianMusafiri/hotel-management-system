import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { describe, expect, it, beforeEach } from '@jest/globals';

describe('OrderController', () => {
  let controller: OrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
    }).compile();

    controller = module.get<OrderController>(OrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

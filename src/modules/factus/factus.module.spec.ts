import { Test, TestingModule } from '@nestjs/testing';
import { FactusModule } from './factus.module';
import { ConfigModule } from '@nestjs/config';

describe('FactusModule (Task 1.3)', () => {
  const FACTUS_QUERY_GATEWAY = 'IFactusQueryGateway';

  it('should register IFactusQueryGateway as a provider', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), FactusModule],
    }).compile();

    const gateway = module.get(FACTUS_QUERY_GATEWAY);
    expect(gateway).toBeDefined();
  });

  it('should export IFactusQueryGateway for other modules to use', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), FactusModule],
    }).compile();

    const gateway = module.get(FACTUS_QUERY_GATEWAY);

    // Verify it has the expected method signatures
    expect(typeof gateway.listBills).toBe('function');
    expect(typeof gateway.listCreditNotes).toBe('function');
  });
});

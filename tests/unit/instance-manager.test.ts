/**
 * @file tests/unit/instance-manager.test.ts
 */

import { getTreblleInstance, clearInstances, getInstanceCount } from '../../src/core/instance-manager';

describe('Instance Manager', () => {
  const baseOptions = {
    sdkToken: 'test-sdk-token',
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    clearInstances();
  });

  test('should start with zero instances', () => {
    expect(getInstanceCount()).toBe(0);
  });

  test('should create and reuse same instance for same options', () => {
    const a = getTreblleInstance(baseOptions as any);
    const b = getTreblleInstance({ ...baseOptions } as any);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(getInstanceCount()).toBe(1);
    expect(a).toBe(b);
  });

  test('should create separate instances for different options', () => {
    const a = getTreblleInstance(baseOptions as any);
    const b = getTreblleInstance({ ...baseOptions, includePaths: ['/api/*'] } as any);
    expect(a).not.toBe(b);
    expect(getInstanceCount()).toBe(2);
  });
});


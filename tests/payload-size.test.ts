/**
 * @file tests/payload-size.test.ts
 * @description Tests for payload size checking functionality
 */

import {
  estimateObjectSize,
  checkPayloadSize,
  createPayloadReplacement,
  processPayloadWithSizeCheck
} from '../src/core/payload-size';

describe('Payload Size Checking', () => {
  describe('estimateObjectSize', () => {
    it('should estimate size for primitives', () => {
      expect(estimateObjectSize('hello')).toBe(5);
      expect(estimateObjectSize(42)).toBe(8);
      expect(estimateObjectSize(true)).toBe(1);
      expect(estimateObjectSize(null)).toBe(0);
      expect(estimateObjectSize(undefined)).toBe(0);
    });

    it('should estimate size for arrays', () => {
      const smallArray = [1, 2, 3];
      const size = estimateObjectSize(smallArray);
      expect(size).toBeGreaterThan(24); // Array overhead + numbers
    });

    it('should estimate size for objects', () => {
      const smallObject = { name: 'test', age: 30 };
      const size = estimateObjectSize(smallObject);
      expect(size).toBeGreaterThan(24); // Object overhead + properties
    });

    it('should handle buffers', () => {
      const buffer = Buffer.from('hello world');
      expect(estimateObjectSize(buffer)).toBe(11);
    });

    it('should limit depth to prevent infinite recursion', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      const size = estimateObjectSize(circular, 2);
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(1000); // Should not explode
    });
  });

  describe('checkPayloadSize', () => {
    it('should handle small payloads', () => {
      const smallData = { message: 'hello' };
      const result = checkPayloadSize(smallData);
      
      expect(result.exceedsLimit).toBe(false);
      expect(result.isLarge).toBe(false);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should detect large payloads', () => {
      // Create a large object
      const largeData = {
        data: 'x'.repeat(3 * 1024 * 1024) // 3MB string
      };
      
      const result = checkPayloadSize(largeData, { warningSize: 1024 * 1024 });
      
      expect(result.isLarge).toBe(true);
      expect(result.size).toBeGreaterThan(1024 * 1024);
    });

    it('should detect payloads exceeding limit', () => {
      const hugeData = {
        data: 'x'.repeat(6 * 1024 * 1024) // 6MB string
      };
      
      const result = checkPayloadSize(hugeData);
      
      expect(result.exceedsLimit).toBe(true);
      expect(result.size).toBeGreaterThan(5 * 1024 * 1024);
    });

    it('should use custom size limits', () => {
      const data = { data: 'x'.repeat(2000) }; // 2KB
      
      const result = checkPayloadSize(data, {
        maxSize: 1000,
        warningSize: 500
      });
      
      expect(result.exceedsLimit).toBe(true);
      expect(result.isLarge).toBe(true);
    });
  });

  describe('createPayloadReplacement', () => {
    it('should create replacement for large objects', () => {
      const sizeInfo = {
        size: 6 * 1024 * 1024,
        isLarge: true,
        exceedsLimit: true,
        estimatedSize: 6 * 1024 * 1024
      };
      
      const replacement = createPayloadReplacement({ test: 'data' }, sizeInfo);
      
      expect(replacement.__type).toBe('large_payload');
      expect(replacement.size).toBe(6 * 1024 * 1024);
      expect(replacement.maxSize).toBe(5 * 1024 * 1024);
      expect(replacement.originalType).toBe('object');
    });

    it('should include type-specific metadata', () => {
      const arrayData = [1, 2, 3, 4, 5];
      const sizeInfo = {
        size: 6 * 1024 * 1024,
        isLarge: true,
        exceedsLimit: true
      };
      
      const replacement = createPayloadReplacement(arrayData, sizeInfo);
      
      expect(replacement.originalType).toBe('array');
      expect(replacement.length).toBe(5);
    });

    it('should handle buffer data', () => {
      const bufferData = Buffer.from('test');
      const sizeInfo = {
        size: 6 * 1024 * 1024,
        isLarge: true,
        exceedsLimit: true
      };
      
      const replacement = createPayloadReplacement(bufferData, sizeInfo);
      
      expect(replacement.originalType).toBe('buffer');
      expect(replacement.length).toBe(4);
    });
  });

  describe('processPayloadWithSizeCheck', () => {
    it('should pass through small payloads unchanged', () => {
      const smallData = { message: 'hello' };
      const result = processPayloadWithSizeCheck(smallData);
      
      expect(result).toEqual(smallData);
    });

    it('should replace large payloads with metadata', () => {
      const largeData = {
        data: 'x'.repeat(6 * 1024 * 1024) // 6MB
      };
      
      const result = processPayloadWithSizeCheck(largeData);
      
      expect(result.__type).toBe('large_payload');
      expect(result.size).toBeGreaterThan(5 * 1024 * 1024);
    });

    it('should respect custom size options', () => {
      const data = { data: 'x'.repeat(2000) }; // 2KB
      
      const result = processPayloadWithSizeCheck(data, {
        maxSize: 1000
      });
      
      expect(result.__type).toBe('large_payload');
    });
  });

  describe('Memory efficiency', () => {
    it('should not crash with very large objects when using estimation', () => {
      // Create a genuinely large object that will exceed 5MB
      const largeData = 'x'.repeat(6 * 1024 * 1024); // 6MB string
      const largeObject = { 
        data: largeData,
        metadata: { type: 'test', size: largeData.length }
      };
      
      const result = processPayloadWithSizeCheck(largeObject, {
        enableEstimation: true,
        maxSize: 5 * 1024 * 1024
      });
      
      expect(result.__type).toBe('large_payload');
      expect(result.size).toBeGreaterThan(5 * 1024 * 1024);
    });
  });
});

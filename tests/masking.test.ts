/**
 * @file tests/masking.test.ts
 * @description Tests for the data masking functionality
 */

import { maskSensitiveData } from '../src/masking';
// import { DEFAULT_MASKED_FIELDS } from '../src/types';

describe('Data Masking', () => {
  test('should mask sensitive fields', () => {
    const testData = {
      username: 'testuser',
      password: 'secret123',
      api_key: 'sk_test_123456789',
      data: {
        creditScore: 750,
        normalField: 'not-masked'
      }
    };
    
    const masked = maskSensitiveData(testData);
    
    // Check that sensitive fields are masked
    expect(masked.password).toBe('*********');
    expect(masked.api_key).toBe('*****************'); // 17 characters
    expect(masked.data.creditScore).toBe('*****');
    
    // Check that normal fields are not masked
    expect(masked.username).toBe('testuser');
    expect(masked.data.normalField).toBe('not-masked');
  });

  test('should handle null and undefined values', () => {
    const testData = {
      password: null,
      api_key: undefined,
      normalField: 'test'
    };
    
    const masked = maskSensitiveData(testData);
    
    expect(masked.password).toBeNull();
    expect(masked.api_key).toBeUndefined();
    expect(masked.normalField).toBe('test');
  });

  test('should mask additional fields', () => {
    const testData = {
      password: 'secret',
      customSecret: 'hide-this',
      normalField: 'keep-this'
    };
    
    const masked = maskSensitiveData(testData, ['customSecret']);
    
    expect(masked.password).toBe('******');
    expect(masked.customSecret).toBe('*********');
    expect(masked.normalField).toBe('keep-this');
  });

  test('should handle nested objects and arrays', () => {
    const testData = {
      user: {
        password: 'secret',
        profile: {
          api_key: 'secret-key'
        }
      },
      items: [
        { api_key: 'key-1' },
        { normalField: 'normal' }
      ]
    };
    
    const masked = maskSensitiveData(testData);
    
    expect(masked.user.password).toBe('******');
    expect(masked.user.profile.api_key).toBe('**********');
    expect(masked.items[0].api_key).toBe('*****');
    expect(masked.items[1].normalField).toBe('normal');
  });

  test('should handle file objects', () => {
    const fileObj = {
      fieldname: 'profile',
      originalname: 'profile.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake image data')
    };

    const masked = maskSensitiveData(fileObj);
    // Buffer objects are converted to file metadata by the masking function
    expect(masked.buffer).toEqual(expect.objectContaining({
      __type: 'file'
    }));
  });
});

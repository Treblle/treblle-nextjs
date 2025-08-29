/**
 * @file tests/masking.test.ts
 * @description Comprehensive tests for the data masking functionality
 */

import { maskSensitiveData } from '../src/masking';
import { DEFAULT_MASKED_FIELDS } from '../src/types';

describe('Data Masking Comprehensive Tests', () => {
  describe('Default Field Masking', () => {
    test('should mask all default sensitive fields', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        pwd: 'password',
        secret: 'mysecret',
        password_confirmation: 'secret123',
        passwordConfirmation: 'secret123',
        cc: '1234567890123456',
        card_number: '1234567890123456',
        cardNumber: '1234567890123456',
        ccv: '123',
        ssn: '123-45-6789',
        credit_score: '750',
        creditScore: '750',
        api_key: '[REDACTED:api-key]',
        normalField: 'normalValue'
      };

      const masked = maskSensitiveData(data);

      // Should mask all default fields
      expect(masked.password).toBe('*********');
      expect(masked.pwd).toBe('********');
      expect(masked.secret).toBe('********');
      expect(masked.password_confirmation).toBe('*********');
      expect(masked.passwordConfirmation).toBe('*********');
      expect(masked.cc).toBe('****************');
      expect(masked.card_number).toBe('****************');
      expect(masked.cardNumber).toBe('****************');
      expect(masked.ccv).toBe('***');
      expect(masked.ssn).toBe('***********');
      expect(masked.credit_score).toBe('***');
      expect(masked.creditScore).toBe('***');
      expect(masked.api_key).toBe('******************');
      
      // Should not mask normal fields
      expect(masked.username).toBe('testuser');
      expect(masked.normalField).toBe('normalValue');
    });

    test('should preserve original length when masking', () => {
      const data = {
        password: 'a',
        api_key: 'very-long-api-key-string-here',
        secret: 'medium'
      };

      const masked = maskSensitiveData(data);

      expect(masked.password).toBe('*');
      expect(masked.api_key).toBe('*****************************');
      expect(masked.secret).toBe('******');
    });

    test('should mask sensitive fields with correct character count', () => {
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
  });

  describe('Custom Field Masking', () => {
    test('should mask additional custom fields', () => {
      const data = {
        username: 'testuser',
        customSecret: 'secret123',
        userToken: 'token456',
        normalField: 'normal'
      };

      const masked = maskSensitiveData(data, ['customSecret', 'userToken']);

      expect(masked.username).toBe('testuser');
      expect(masked.customSecret).toBe('*********');
      expect(masked.userToken).toBe('********');
      expect(masked.normalField).toBe('normal');
    });

    test('should combine default and custom masked fields', () => {
      const data = {
        password: 'secret123',
        customField: 'customValue',
        api_key: 'apiKey123',
        normalField: 'normal'
      };

      const masked = maskSensitiveData(data, ['customField']);

      expect(masked.password).toBe('*********'); // Default masked
      expect(masked.customField).toBe('***********'); // Custom masked
      expect(masked.api_key).toBe('*********'); // Default masked
      expect(masked.normalField).toBe('normal'); // Not masked
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

    test('should handle case insensitive matching', () => {
      const data = {
        Password: 'secret123',
        PASSWORD: 'secret456',
        password: 'secret789'
      };

      const masked = maskSensitiveData(data);

      expect(masked.Password).toBe('*********'); // Masked (case insensitive)
      expect(masked.PASSWORD).toBe('*********'); // Masked (case insensitive)
      expect(masked.password).toBe('*********'); // Masked (exact match)
    });
  });

  describe('Nested Object Masking', () => {
    test('should mask fields in nested objects', () => {
      const data = {
        user: {
          name: 'testuser',
          password: 'secret123',
          profile: {
            email: 'test@example.com',
            api_key: '[REDACTED:api-key]'
          }
        },
        config: {
          database: {
            host: 'localhost',
            secret: 'dbsecret'
          }
        }
      };

      const masked = maskSensitiveData(data);

      expect(masked.user.name).toBe('testuser');
      expect(masked.user.password).toBe('*********');
      expect(masked.user.profile.email).toBe('test@example.com');
      expect(masked.user.profile.api_key).toBe('******************');
      expect(masked.config.database.host).toBe('localhost');
      expect(masked.config.database.secret).toBe('********');
    });

    test('should handle deeply nested structures', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              level4: {
                password: 'deepSecret',
                normalField: 'normal'
              }
            }
          }
        }
      };

      const masked = maskSensitiveData(data);

      expect(masked.level1.level2.level3.level4.password).toBe('**********');
      expect(masked.level1.level2.level3.level4.normalField).toBe('normal');
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
  });

  describe('Array Handling', () => {
    test('should mask fields in array elements', () => {
      const data = {
        users: [
          { name: 'user1', password: 'pass1' },
          { name: 'user2', password: 'pass2' },
          { name: 'user3', api_key: 'key3' }
        ]
      };

      const masked = maskSensitiveData(data);

      expect(masked.users[0].name).toBe('user1');
      expect(masked.users[0].password).toBe('*****');
      expect(masked.users[1].name).toBe('user2');
      expect(masked.users[1].password).toBe('*****');
      expect(masked.users[2].name).toBe('user3');
      expect(masked.users[2].api_key).toBe('****');
    });

    test('should handle arrays of nested objects', () => {
      const data = {
        accounts: [
          {
            user: { name: 'user1', password: 'secret1' },
            settings: { api_key: 'key1' }
          },
          {
            user: { name: 'user2', password: 'secret2' },
            settings: { api_key: 'key2' }
          }
        ]
      };

      const masked = maskSensitiveData(data);

      expect(masked.accounts[0].user.name).toBe('user1');
      expect(masked.accounts[0].user.password).toBe('*******');
      expect(masked.accounts[0].settings.api_key).toBe('****');
      expect(masked.accounts[1].user.name).toBe('user2');
      expect(masked.accounts[1].user.password).toBe('*******');
      expect(masked.accounts[1].settings.api_key).toBe('****');
    });

    test('should handle mixed arrays', () => {
      const data = {
        mixedArray: [
          'string',
          123,
          { password: 'secret' },
          [{ api_key: '[REDACTED:api-key]' }],
          null
        ]
      };

      const masked = maskSensitiveData(data);

      expect(masked.mixedArray[0]).toBe('string');
      expect(masked.mixedArray[1]).toBe(123);
      expect(masked.mixedArray[2].password).toBe('******');
      expect(masked.mixedArray[3][0].api_key).toBe('******************');
      expect(masked.mixedArray[4]).toBe(null);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined values', () => {
      const data = {
        password: null,
        api_key: undefined,
        secret: '',
        normal: 'value'
      };

      const masked = maskSensitiveData(data);

      expect(masked.password).toBe(null);
      expect(masked.api_key).toBe(undefined);
      expect(masked.secret).toBe('');
      expect(masked.normal).toBe('value');
    });

    test('should handle null and undefined values in test data', () => {
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

    test('should handle empty objects and arrays', () => {
      const data = {
        emptyObject: {},
        emptyArray: [],
        password: 'secret'
      };

      const masked = maskSensitiveData(data);

      expect(masked.emptyObject).toEqual({});
      expect(masked.emptyArray).toEqual([]);
      expect(masked.password).toBe('******');
    });

    test('should handle circular references gracefully', () => {
      const data: any = {
        name: 'test',
        password: 'secret'
      };
      data.self = data; // Create circular reference

      // Should not crash and return a fallback
      const masked = maskSensitiveData(data);

      // The function should handle circular references gracefully
      expect(masked.__type).toBe('unprocessable');
      expect(masked.message).toBe('Unable to process object');
    });

    test('should preserve data types', () => {
      const data = {
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        object: { key: 'value' },
        password: 'secret',
        nullValue: null,
        undefinedValue: undefined
      };

      const masked = maskSensitiveData(data);

      expect(typeof masked.string).toBe('string');
      expect(typeof masked.number).toBe('number');
      expect(typeof masked.boolean).toBe('boolean');
      expect(Array.isArray(masked.array)).toBe(true);
      expect(typeof masked.object).toBe('object');
      expect(masked.password).toBe('******');
      expect(masked.nullValue).toBe(null);
      expect(masked.undefinedValue).toBe(undefined);
    });

    test('should handle non-string sensitive values', () => {
      const data = {
        password: 123456,
        api_key: true,
        secret: { nested: 'value' },
        normal: 'string'
      };

      const masked = maskSensitiveData(data);

      // Non-string sensitive values should be converted to fixed length mask
      expect(typeof masked.password).toBe('string');
      expect(masked.password).toBe('*****');
      expect(typeof masked.api_key).toBe('string');
      expect(masked.api_key).toBe('*****');
      expect(typeof masked.secret).toBe('string');
      expect(masked.secret).toBe('*****');
      expect(masked.normal).toBe('string');
    });

    test('should handle very large objects without performance issues', () => {
      const largeData: any = {
        password: 'secret'
      };
      
      // Create large object
      for (let i = 0; i < 1000; i++) {
        largeData[`field_${i}`] = `value_${i}`;
      }

      const startTime = Date.now();
      const masked = maskSensitiveData(largeData);
      const endTime = Date.now();

      expect(masked.password).toBe('******');
      expect(masked.field_0).toBe('value_0');
      expect(masked.field_999).toBe('value_999');
      
      // Should complete within reasonable time (1 second)
      expect(endTime - startTime).toBeLessThan(1000);
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

  describe('Masking Algorithm', () => {
    test('should use asterisks for masking', () => {
      const data = {
        password: 'secret123',
        api_key: 'key'
      };

      const masked = maskSensitiveData(data);

      expect(masked.password).toMatch(/^\*+$/);
      expect(masked.api_key).toMatch(/^\*+$/);
    });

    test('should maintain exact character count', () => {
      const data = {
        shortPassword: 'a',
        mediumPassword: 'password',
        longPassword: 'this-is-a-very-long-password-string'
      };

      const masked = maskSensitiveData(data);

      expect(masked.shortPassword.length).toBe(1);
      expect(masked.mediumPassword.length).toBe(8);
      expect(masked.longPassword.length).toBe(35);
    });
  });

  describe('Integration with DEFAULT_MASKED_FIELDS', () => {
    test('should include all fields from DEFAULT_MASKED_FIELDS', () => {
      const data: any = {};
      
      // Create test data with all default masked fields
      DEFAULT_MASKED_FIELDS.forEach(field => {
        data[field] = `${field}_value`;
      });
      
      const masked = maskSensitiveData(data);
      
      // Verify all default fields are masked
      DEFAULT_MASKED_FIELDS.forEach(field => {
        expect(masked[field]).toMatch(/^\*+$/);
        expect(masked[field].length).toBe(`${field}_value`.length);
      });
    });
  });

  describe('Security Tests', () => {
    test('should mask sensitive data in headers', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer secret-token',
        'X-API-Key': 'api-key-123',
        'api_key': 'another-key'
      };

      const masked = maskSensitiveData(headers, ['Authorization', 'X-API-Key']);

      expect(masked['Content-Type']).toBe('application/json');
      expect(masked['Authorization']).toBe('*******************');
      expect(masked['X-API-Key']).toBe('***********');
      expect(masked['api_key']).toBe('***********'); // Default masked field
    });

    test('should mask JWT tokens', () => {
      const data = {
        jwt: '[REDACTED:jwt-token]',
        username: 'john.doe'
      };

      const masked = maskSensitiveData(data, ['jwt']);

      expect(masked.jwt).toMatch(/^\*+$/);
      expect(masked.jwt.length).toBe(data.jwt.length);
      expect(masked.username).toBe('john.doe');
    });

    test('should mask database connection strings', () => {
      const config = {
        database: 'myapp',
        connectionString: 'postgresql://user:password@localhost:5432/myapp',
        host: 'localhost'
      };

      const masked = maskSensitiveData(config, ['connectionString']);

      expect(masked.database).toBe('myapp');
      expect(masked.connectionString).toMatch(/^\*+$/);
      expect(masked.host).toBe('localhost');
    });
  });
});

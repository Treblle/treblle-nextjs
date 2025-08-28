/**
 * @file src/core/payload.ts
 * @description Shared payload builder for Treblle integrations
 */

import { TreblleOptions, TreblleError } from '../types';
import { maskSensitiveData } from '../masking';
import { getServerIp, calculateResponseSize } from '../utils';
import { processPayloadWithSizeCheck, PayloadSizeOptions } from './payload-size';
import { getSdkVersionFloat } from './version';

export interface PayloadRequest {
  timestamp: string;
  ip: string;
  url: string;
  route_path: string;
  user_agent: string;
  method: string;
  headers: Record<string, any>;
  body: any;
}

export interface PayloadResponse {
  headers: Record<string, any>;
  code: number;
  size: number;
  load_time: number;
  body: any;
}

export interface PayloadInput {
  sdkToken: string;
  apiKey: string;
  request: PayloadRequest;
  response: PayloadResponse;
  errors: TreblleError[];
  options: TreblleOptions;
  responseObject?: any; // For calculateResponseSize compatibility
  sizeOptions?: PayloadSizeOptions; // Payload size checking options
}

/**
 * Builds a standardized Treblle payload
 * @param input - Payload input data
 * @returns Treblle API payload
 */
export function buildTrebllePayload(input: PayloadInput): any {
  const sizeOptions = input.sizeOptions || {};
  
  // Process request and response bodies with size checking
  const processedRequestBody = processPayloadWithSizeCheck(
    maskSensitiveData(input.request.body, input.options.additionalMaskedFields),
    sizeOptions
  );
  
  const processedResponseBody = processPayloadWithSizeCheck(
    maskSensitiveData(input.response.body, input.options.additionalMaskedFields),
    sizeOptions
  );
  
  const hasProcess = typeof process !== 'undefined';

  return {
    api_key: input.sdkToken,
    project_id: input.apiKey,
    sdk: 'nextjs',
    version: getSdkVersionFloat(),
    data: {
      server: {
        ip: getServerIp(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        os: {
          name: hasProcess ? (process as any).platform : 'edge',
          release: hasProcess ? ((process as any).release?.name || '') : '',
          architecture: hasProcess ? (process as any).arch : 'unknown'
        },
        software: hasProcess ? (process as any).version : 'edge',
        language: {
          name: "nodejs",
          version: hasProcess ? (process as any).version : 'edge'
        }
      },
      request: {
        timestamp: input.request.timestamp,
        ip: input.request.ip,
        url: input.request.url,
        route_path: input.request.route_path,
        user_agent: input.request.user_agent,
        method: input.request.method,
        headers: maskSensitiveData(input.request.headers, input.options.additionalMaskedFields),
        body: processedRequestBody
      },
      response: {
        headers: maskSensitiveData(input.response.headers, input.options.additionalMaskedFields),
        code: input.response.code,
        size: input.responseObject ? 
          calculateResponseSize(input.response.body, input.responseObject) : 
          input.response.size,
        load_time: input.response.load_time,
        body: processedResponseBody
      },
      errors: input.errors
    }
  };
}

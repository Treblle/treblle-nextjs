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
  query: Record<string, string>;
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
  const isEmptyObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0;
  
  // Process request and response bodies with size checking
  const rawRequestBody = (input.request.method === 'GET' && isEmptyObject(input.request.body))
    ? input.request.query
    : input.request.body;
  const processedRequestBody = processPayloadWithSizeCheck(
    maskSensitiveData(rawRequestBody, input.options.additionalMaskedFields),
    sizeOptions
  );
  
  const processedResponseBody = processPayloadWithSizeCheck(
    maskSensitiveData(input.response.body, input.options.additionalMaskedFields),
    sizeOptions
  );
  
  const hasProcess = typeof process !== 'undefined';

  const payload: any = {
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
        query: maskSensitiveData(input.request.query, input.options.additionalMaskedFields),
        body: isEmptyObject(processedRequestBody) ? null : processedRequestBody
      },
      response: {
        headers: maskSensitiveData(input.response.headers, input.options.additionalMaskedFields),
        code: input.response.code,
        size: input.responseObject ? 
          calculateResponseSize(input.response.body, input.responseObject) : 
          input.response.size,
        load_time: input.response.load_time,
        body: isEmptyObject(processedResponseBody) ? null : processedResponseBody
      },
      errors: input.errors
    }
  };

  // Promote user and tracing info from headers when present
  try {
    const hdrs = input.request.headers || {};
    const userId = hdrs['treblle-user-id'] || hdrs['x-treblle-user-id'] || hdrs['x-user-id'];
    const traceparent = hdrs['traceparent'];
    const baggage = hdrs['baggage'];
    if (userId) {
      (payload.data as any).user = { id: String(userId) };
    }
    if (traceparent || baggage) {
      (payload.data as any).trace = {
        ...(traceparent ? { traceparent } : {}),
        ...(baggage ? { baggage } : {}),
      };
    }
  } catch { /* no-op */ }

  return payload;
}

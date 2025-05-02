/**
 * @file src/integrations/index.ts
 * @description Exports all framework integrations
 */

// Export Express integration functions
import * as expressIntegration from './express';
export const express = expressIntegration;

// Export NestJS integration components
import * as nestjsIntegration from './nestjs';
export const nestjs = nestjsIntegration;

// Default export with all integrations
export default {
  express,
  nestjs
};
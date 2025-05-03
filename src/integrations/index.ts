/**
 * @file src/integrations/index.ts
 * @description Exports all framework integrations
 */

// Import Express integration directly
import expressIntegration from './express';
// Import NestJS integration directly
import nestjsIntegration from './nestjs';

// Named exports for each integration
export const express = expressIntegration;
export const nestjs = nestjsIntegration;

// Default export with all integrations
export default {
  express: expressIntegration,
  nestjs: nestjsIntegration
};
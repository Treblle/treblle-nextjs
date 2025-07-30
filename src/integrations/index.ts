/**
 * @file src/integrations/index.ts
 * @description Exports all framework integrations
 */

// Import Express integration directly
import expressIntegration from './express';
// Import NestJS integration directly
import nestjsIntegration from './nestjs';
// Import Next.js integration directly
import nextjsIntegration from './nextjs';

// Named exports for each integration
export const express = expressIntegration;
export const nestjs = nestjsIntegration;
export const nextjs = nextjsIntegration;

// Default export with all integrations
export default {
  express: expressIntegration,
  nestjs: nestjsIntegration,
  nextjs: nextjsIntegration
};
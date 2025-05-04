/**
 * @file src/integrations/index.ts
 * @description Exports all framework integrations
 */

// Import integrations
import expressIntegration from './express';
import nestjsIntegration from './nestjs';
import { TreblleInstanceManager } from './instance-manager';

// Named exports for each integration
export const express = expressIntegration;
export const nestjs = nestjsIntegration;
export const instanceManager = TreblleInstanceManager;

// Default export with all integrations
export default {
  express: expressIntegration,
  nestjs: nestjsIntegration,
  instanceManager: TreblleInstanceManager
};
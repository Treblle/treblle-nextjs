/**
 * @file src/integrations/index.ts
 * @description Exports all framework integrations
 */

import expressIntegration from './express';
import nestjsIntegration from './nestjs';

export const express = expressIntegration;
export const nestjs = nestjsIntegration;

export default {
  express,
  nestjs
};
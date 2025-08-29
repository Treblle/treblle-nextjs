/**
 * @file src/core/instance-manager.ts
 * @description Shared Treblle instance management
 */

import Treblle from '../index';
import { TreblleOptions } from '../types';

// Store instances by config hash to avoid creating duplicate instances
const instances = new Map<string, Treblle>();

/**
 * Helper to get or create a Treblle instance based on config
 * @param options - Treblle configuration options
 * @returns Treblle instance
 */
export function getTreblleInstance(options: TreblleOptions): Treblle {
  // Create a simple hash of the options object
  const hash = JSON.stringify({
    sdkToken: options.sdkToken,
    apiKey: options.apiKey,
    debug: options.debug,
    enabled: options.enabled,
    environments: options.environments,
    additionalMaskedFields: options.additionalMaskedFields,
    excludePaths: options.excludePaths,
    includePaths: options.includePaths
  });
  
  // Check if we already have an instance with these options
  if (!instances.has(hash)) {
    instances.set(hash, new Treblle(options));
  }
  
  return instances.get(hash)!;
}

/**
 * Clear all instances (for testing purposes)
 */
export function clearInstances(): void {
  instances.clear();
}

/**
 * Get instance count (for testing purposes)
 */
export function getInstanceCount(): number {
  return instances.size;
}

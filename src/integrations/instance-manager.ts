/**
 * @file src/integrations/instance-manager.ts
 * @description Shared instance manager for Treblle SDK integrations
 */

import Treblle from '../index';
import { TreblleOptions } from '../types';

/**
 * Class to manage Treblle instances across different framework integrations
 */
export class TreblleInstanceManager {
  // Map to store instances by config hash
  private static instances = new Map<string, Treblle>();
  
  // Default instance for frameworks that support dependency injection
  private static defaultInstance: Treblle | null = null;
  
  /**
   * Create a hash from options to use as a cache key
   * @param options - Treblle configuration options
   * @returns A string hash of the options
   */
  private static createOptionsHash(options: TreblleOptions): string {
    return JSON.stringify({
      sdkToken: options.sdkToken,
      apiKey: options.apiKey,
      debug: options.debug,
      enabled: options.enabled,
      environments: options.environments,
      additionalMaskedFields: options.additionalMaskedFields,
      excludePaths: options.excludePaths,
      includePaths: options.includePaths
    });
  }
  
  /**
   * Get or create a Treblle instance for the given options
   * @param options - Treblle configuration options
   * @param context - Optional context for logging (e.g., 'express', 'nestjs')
   * @returns A Treblle instance
   */
  public static getInstance(options: TreblleOptions, context?: string): Treblle {
    // Create a hash of the options to use as a cache key
    const hash = this.createOptionsHash(options);
    
    // Log hash details if in debug mode
    if (options.debug) {
      console.log(`[Treblle SDK${context ? ` ${context}` : ''}] Getting instance with hash ${hash.substring(0, 20)}...`);
      console.log(`[Treblle SDK${context ? ` ${context}` : ''}] Instance exists: ${this.instances.has(hash)}`);
    }
    
    // Create a new instance if one doesn't already exist for these options
    if (!this.instances.has(hash)) {
      if (options.debug) {
        console.log(`[Treblle SDK${context ? ` ${context}` : ''}] Creating new Treblle instance`);
      }
      
      const instance = new Treblle(options);
      this.instances.set(hash, instance);
      
      // Set as default instance if we don't have one yet
      if (!this.defaultInstance) {
        this.defaultInstance = instance;
        
        if (options.debug) {
          console.log(`[Treblle SDK${context ? ` ${context}` : ''}] Set as default instance`);
        }
      }
    }
    
    return this.instances.get(hash)!;
  }
  
  /**
   * Get the default instance, or throw if none exists
   * @param context - Optional context for error messages (e.g., 'express', 'nestjs')
   * @returns The default Treblle instance
   */
  public static getDefaultInstance(context?: string): Treblle {
    if (!this.defaultInstance) {
      throw new Error(`No Treblle instance found. ${context ? `In ${context}: ` : ''}Create an instance with options first or provide options directly.`);
    }
    return this.defaultInstance;
  }
  
  /**
   * Get the latest created instance
   * @returns The most recently created Treblle instance or null if none exists
   */
  public static getLatestInstance(): Treblle | null {
    if (this.instances.size === 0) {
      return null;
    }
    
    // Convert map values to array and get the last one
    return Array.from(this.instances.values())[this.instances.size - 1];
  }
  
  /**
   * Clear all cached instances (mainly for testing purposes)
   */
  public static clearInstances(): void {
    this.instances.clear();
    this.defaultInstance = null;
  }
}

export default TreblleInstanceManager;
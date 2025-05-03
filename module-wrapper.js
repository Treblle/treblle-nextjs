/**
 * @file module-wrapper.js
 * @description Wrapper to enable CommonJS require and ES Module imports
 * 
 * This file should be referenced in package.json as the "main" entry point
 */

// Get all exports from the compiled file
const compiledModule = require('./dist/index.js');
const TreblleImport = compiledModule.default;

// Export default class as the main export to enable: const Treblle = require('treblle-js');
module.exports = TreblleImport;

// Also attach it as a property to support: const TreblleModule = require('treblle-js'); const Treblle = TreblleModule.default;
module.exports.default = TreblleImport;

// Re-export all named exports including integrations
Object.assign(module.exports, compiledModule);

// Create integrations submodule - ensure the integrations object is properly exposed
// This makes integrations available directly from the main module
module.exports.integrations = compiledModule.integrations;

// Log debug message about available exports (can be removed in production)
if (process.env.DEBUG) {
  console.log('[Treblle SDK] Available exports:', Object.keys(module.exports));
}
/**
 * @file module-wrapper.js
 * @description Wrapper to enable CommonJS require and ES Module imports
 * 
 * This file should be referenced in package.json as the "main" entry point
 */

// Get the compiled default export
const TreblleImport = require('./dist/index.js').default;

// Export default class as the main export to enable: const Treblle = require('treblle-js');
module.exports = TreblleImport;

// Also attach it as a property to support: const TreblleModule = require('treblle-js'); const Treblle = TreblleModule.default;
module.exports.default = TreblleImport;

// Re-export other named exports
Object.assign(module.exports, require('./dist/index.js'));
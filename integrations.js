/**
 * @file integrations.js
 * @description Entry point for the integrations subpath
 * 
 * This file enables importing integrations directly via:
 * import { nextjs } from 'treblle-nextjs/integrations';
 */

// Get the integrations from the dist directory
const integrations = require('./dist/integrations/index.js');

// Export the integrations object as the default export
module.exports = integrations;

// Also export named exports for each integration
Object.keys(integrations).forEach(key => {
  module.exports[key] = integrations[key];
});

// Log debug message about available exports (can be removed in production)
if (process.env.DEBUG) {
  console.log('[Treblle SDK] Available integrations:', Object.keys(module.exports));
}

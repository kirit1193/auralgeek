/**
 * Musical analysis barrel export (backward compatibility)
 * Re-exports from modular structure
 */

export {
  computeMusicalFeatures,
  computeStreamingSimulation,
  detectBPM,
  detectKey,
  computeChromagram,
  computeKeyStability,
  computeTempoDriftIndex
} from './musical/index.js';

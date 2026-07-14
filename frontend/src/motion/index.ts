// =============================================================================
// Motion Engine v4 — Public API
// -----------------------------------------------------------------------------
// Единственная точка импорта для всех компонентов приложения.
//
//   import { motion, getFlip, resolveTheme } from '$motion';
//
// Все внутренние файлы motion/* не должны импортироваться напрямую из UI.
// =============================================================================

export {
  motion,
  getMotion,
  resolveTheme,
  currentResolved,
  type MotionParams,
} from './engine';

export { getFlip, motionFlip } from './flip';

export { capability } from './capability';

export { planPageTransition, type ChoreographyPlan } from './choreography';

export { computeStagger } from './stagger';

export { THEMES, THEME_NAMES } from './themes';

export { PRESETS } from './presets';

export type {
  AnimTarget,
  AnimPhase,
  MotionSpec,
  MotionState,
  MotionPreset,
  MotionTheme,
  ElementProfile,
  ResolvedMotion,
  TransitionConfig,
  FlipConfig,
  MotionContext,
  PanelKind,
  QualityLevel,
  QualityState,
  EasingSpec,
  EasingFn,
} from './types';

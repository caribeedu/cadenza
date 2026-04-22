/**
 * Public API for the Three.js waterfall visualiser. Import from
 * ``@shared/lib/waterfall``; implementation lives in ``./renderer`` and sibling
 * modules.
 */
export {
  WaterfallRenderer,
  type NoteUserData,
  type WaterfallOptions,
  type WaterfallTheme,
} from "./renderer";

export { PIANO_KEY_CSS } from "./visual-theme";

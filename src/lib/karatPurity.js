export { KARATS } from '../config/karats.js';
import { KARATS } from '../config/karats.js';

// Derived from the canonical KARATS array — single source of truth
export const KARAT_PURITY_MAP = Object.fromEntries(KARATS.map((k) => [k.code, k.purity]));

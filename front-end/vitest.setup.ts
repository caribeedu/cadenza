// Vitest setup file. Extends `expect` with Testing Library's DOM
// matchers (available only when a test opts into jsdom — node-env
// tests import this module harmlessly since jest-dom only registers
// matchers, it doesn't require DOM APIs at import time).
import "@testing-library/jest-dom/vitest";

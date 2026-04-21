import js from "@eslint/js";
import perfectionist from "eslint-plugin-perfectionist";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Flat ESLint config (ESLint 9 + typescript-eslint 8). The order below
// matters: base JS → TS-aware rules → perfectionist (opinionated
// sorting) → React & React-Hooks for component files → per-layer
// overrides. Perfectionist's `recommended-natural` enables all 20+
// sort-* rules; we disable the invasive ones (sort-classes,
// sort-modules, sort-objects, sort-switch-case) because they would
// churn semantic orderings (lifecycle, message dispatch, reducer
// cases) for no readability gain.
export default tseslint.config(
  {
    ignores: [
      "out/**",
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".vite/**",
      ".tsbuildinfo/**",
      "**/*.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  perfectionist.configs["recommended-natural"],
  {
    languageOptions: {
      ecmaVersion: 2024,
      globals: { ...globals.browser, ...globals.node },
      sourceType: "module",
    },
    rules: {
      "perfectionist/sort-classes": "off",
      "perfectionist/sort-modules": "off",
      "perfectionist/sort-objects": "off",
      "perfectionist/sort-switch-case": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ...react.configs.flat.recommended,
    rules: {
      ...(react.configs.flat.recommended.rules ?? {}),
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
    settings: { react: { version: "detect" } },
  },
  {
    files: ["src/**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);

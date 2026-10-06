import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { RAW_COLOR_LITERAL_SELECTORS } from './eslint/colorLiteralGate.js'

// stareSDK's lint gate (#31): the same base rules as the app, plus the D-15 raw-color-literal gate
// that keeps every color on the design tokens this package owns.
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...RAW_COLOR_LITERAL_SELECTORS],
    },
  },
  {
    // D-15 allowlist — files whose ENTIRE purpose is to hold raw color literals (moved here with
    // the files from openstare's own allowlist, #31). A genuine domain-color exception anywhere
    // else gets a per-site `eslint-disable-next-line no-restricted-syntax` naming it instead.
    files: [
      // The TS-side single source of truth for the dark/light chrome palette itself (D-11).
      'src/styles/chromeTheme.ts',
      // User-facing color-picker swatches — D-13 named exclusion (the colors ARE the feature).
      'src/components/ColorPicker.tsx',
      // BADGE_BG per-theme map — the standing raw-hex exception (D-14): contrastText() parses
      // these as WCAG luminance numbers, so a var() string would parse as NaN.
      'src/components/badgeTokens.ts',
      // Data-viz ramps — the private copy of openstare's allowlisted analysis/colorRamps.ts.
      'src/internal/colorRamps.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Test files assert against literal expected values by construction (D-13).
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
])

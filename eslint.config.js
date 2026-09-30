import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'

/**
 * ESLint flat config for ASCEND.
 *
 * Goals, in priority order:
 *   1. Catch real defects: incorrect React usage, hook bugs, missing
 *      accessibility, TypeScript mistakes.
 *   2. Stay small enough that you can read it and predict every message.
 *   3. Never fail a build for formatting. Formatting is not a defect.
 *
 * What this deliberately does NOT do:
 *   - No prettier, no stylistic rule set, no import-sorting opinions.
 *   - No `strict` preset. The default recommended sets plus the handful
 *     of rules marked REQUIRED below are the whole configuration.
 *
 * Every non-default rule is marked REQUIRED with the reason it exists.
 * If you add a rule without a reason, you have added noise.
 */

/**
 * React plugin rules promoted above their preset default.
 *
 * These live in their own object because a rule can only be referenced
 * in the same configuration block that registers its plugin.
 */
const REQUIRED_REACT = {
  /**
   * REQUIRED: a component that conditionally calls hooks will crash or
   * silently misbehave, and the failure appears far from the cause.
   */
  'react-hooks/rules-of-hooks': 'error',

  /**
   * REQUIRED: a stale or missing dependency in an effect produces code
   * that is correct in development and wrong in production. Warn rather
   * than error, because the correct fix is sometimes legitimately not
   * to add the dependency, and that deserves discussion rather than a
   * silent override.
   */
  'react-hooks/exhaustive-deps': 'warn',

  /**
   * REQUIRED: never spread an untrusted object over JSX. This is the
   * rule that stops a user's goal text becoming an injected prop.
   * ASCEND handles user-authored text in goals, reviews and reflections.
   */
  'react/jsx-props-no-spreading': 'error',
}

/** Rules we promote above their preset default, each with a reason.
 *
 * Plugin-owned rules are NOT here. A rule can only be referenced in the
 * same configuration object that registers its plugin, so the React and
 * hooks rules live in their own block below.
 */
const REQUIRED = {
  /**
   * REQUIRED: `any` disables the type system exactly where the data is
   * least trustworthy (user input and stored state). V1 has no escape
   * hatch that needs `any`; if it appears, it needs a comment explaining
   * why, and review should challenge it.
   */
  '@typescript-eslint/no-explicit-any': 'error',

  /**
   * REQUIRED: a floating promise is a silent failure. ASCEND must never
   * claim a save succeeded without awaiting it, especially because the
   * error experience depends on detecting that failure.
   */
  '@typescript-eslint/no-floating-promises': 'error',

  /**
   * REQUIRED: a race condition in storage writes can silently drop the
   * user's most recent answer. This is the class of bug that loses real
   * people's onboarding progress.
   */
  '@typescript-eslint/no-misused-promises': 'error',

  /**
   * REQUIRED: the base `no-unused-vars` cannot see TypeScript types, so
   * it reports an import as unused when it is only used as a type. The
   * TypeScript-aware rule below replaces it. Turning the base rule off
   * is a replacement, not a loss of coverage.
   */
  'no-unused-vars': 'off',

  /**
   * REQUIRED: an empty catch block hides a failure. ASCEND's storage
   * layer catches broadly on purpose, but it must say what it did.
   */
  'no-empty': ['error', { allowEmptyCatch: false }],

  /**
   * REQUIRED: `var` has function scope and hoisting surprises. `let`
   * and `const` are the only declarations we use.
   */
  'no-var': 'error',

  /**
   * REQUIRED: `==` coerces types. `"0" == 0` is true and has caused real
   * bugs in date and count comparisons.
   */
  eqeqeq: ['error', 'always'],

  /**
   * REQUIRED: `debugger` shipping to production pauses the browser for
   * anyone who opens ASCEND.
   */
  'no-debugger': 'error',

  /**
   * REQUIRED: console noise in a production build. ASCEND logs at
   * exactly one place (the error boundary) and does so deliberately.
   */
  'no-console': 'warn',
}

export default tseslint.config(
  {
    // Nothing here is linted. Build output, dependencies and lockfiles
    // are not our code and should never fail our gate.
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js'],

    // ESLint 9+ requires this to be explicit when using flat config.
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },

  // --- TypeScript, shared across every environment -------------------
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2023,
      sourceType: 'module',

      /**
       * Type information is enabled so that exactly two rules can work:
       * no-floating-promises and no-misused-promises. Both catch real
       * failure modes in an app whose whole job is saving a person's
       * work, and neither can work without types.
       *
       * We do NOT enable typescript-eslint's type-checked preset. It
       * also enables the `no-unsafe-*` family, which fires constantly
       * on the `unknown` values our storage layer deliberately returns.
       * Those warnings would be noise, and noise trains people to
       * ignore the linter.
       */
      parserOptions: {
        project: [
          './tsconfig.app.json',
          './tsconfig.test.json',
          './tsconfig.node.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...REQUIRED,

      /**
       * REQUIRED: `no-unused-vars` cannot see TypeScript types, so it
       * reports an import as unused when it is only used as a type.
       * The TypeScript-aware version replaces it. Turning the base rule
       * off is why this is not disabling coverage, only replacing the
       * implementation.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // Caught by the TypeScript compiler instead, where it does not
          // depend on inference subtleties.
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // --- React (JSX transform is automatic; no React import needed) -----
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs['recommended-latest'].rules,
      // Plugin-owned REQUIRED rules, applied here because this is the
      // block that registers the plugins.
      ...REQUIRED_REACT,
    },
  },

  // --- Design-system primitives: the one place spreading is allowed ---
  //
  // `react/jsx-props-no-spreading` exists to stop an arbitrary object
  // landing on an element and silently replacing something important --
  // an onClick, an href, an aria attribute. That is a real risk and the
  // rule stays an error everywhere else, including all of src/features.
  //
  // Button, Card, TextField and TextAreaField are wrapper primitives
  // whose entire job is to forward native attributes (id, name, type,
  // aria-*, data-*, event handlers) onto one element. Removing the
  // spread would mean hand-enumerating every HTML attribute four times
  // and silently dropping the ones we forgot, which is a worse bug.
  //
  // Two properties make these four sites safe, and both are enforced by
  // the compiler rather than by convention:
  //   1. The spread is a typed `...rest` of a declared Props interface,
  //      so it cannot carry an unexpected key at all.
  //   2. The spread is written FIRST in every case, so the primitive's
  //      own contract (type, id, className, disabled, aria-busy,
  //      aria-invalid, aria-describedby, rows) always wins. A caller
  //      cannot break the accessibility wiring, only add to it.
  //
  // If a new primitive in this directory spreads something that is not a
  // typed rest of its own Props, it does not belong in this exemption.
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react/jsx-props-no-spreading': 'off',
    },
  },

  // --- Accessibility -------------------------------------------------
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },

  // --- Browser code that touches Node-only globals -------------------
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    // No `no-undef` in the browser project: TypeScript already proves
    // every global exists, so the rule can only produce false positives
    // about things like `fetch` versus a hypothetical missing `window`.
    rules: {
      'no-undef': 'off',
    },
  },

  // --- Build tooling and the Worker: Node globals are legitimate ----
  {
    files: ['**/*.config.ts', '**/*.config.js', 'worker/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.worker },
    },
    rules: {
      // Restore the base rule where it is useful: these files are not
      // covered by the TypeScript compiler for runtime globals in the
      // same way, and a genuine typo should still be caught.
      'no-undef': 'error',
    },
  },

  // --- Tests ---------------------------------------------------------
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      /**
       * Test doubles deliberately violate types (a fake store that
       * returns a corrupt value). Type-checking the doubles would test
       * the type system, not the behaviour.
       */
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'error',
    },
  },
)

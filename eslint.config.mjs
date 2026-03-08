import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "backend/reference/**",
      "frontend/src/routeTree.gen.ts",
      "frontend/dist/**",
      "frontend/dist-electron/**",
      "backend/tsconfig.tsbuildinfo",
      "frontend/tsconfig.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  {
    files: [
      "backend/src/core/**/*.ts",
      "backend/src/dagger/**/*.ts",
      "frontend/src/**/*.ts",
      "frontend/src/**/*.tsx",
      "frontend/electron/**/*.ts",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

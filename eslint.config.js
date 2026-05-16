import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: [
      "class_management.js",
      "class_management_core.js",
      "eslint.config.js",
      "playwright.config.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["*.js"],
    ignores: [
      "class_management.js",
      "class_management_core.js",
      "eslint.config.js",
      "playwright.config.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];

import nextPlugin from "@next/eslint-plugin-next";
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import i18next from "eslint-plugin-i18next";
import importPlugin from "eslint-plugin-import-x";
import jsdoc from "eslint-plugin-jsdoc";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-plugin-prettier/recommended";
import reactPlugin from "eslint-plugin-react";
// eslint-disable-next-line import-x/default
import reactHooksPlugin from "eslint-plugin-react-hooks";
import {
  configs as tsConfigs,
  plugin as tsPlugin,
  parser as tsParser,
} from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  {
    ignores: [
      "**/dist/",
      "**/.next/",
      "**/.plans/",
      "**/.vercel/",
      "**/.yarn/",
      "**/.vscode/",
      "**/.idea/",
      "build-config/",
      "public/*.js",
    ],
  },
  js.configs.recommended,
  ...tsConfigs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    settings: {
      "import-x/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
  },
  jsdoc.configs["flat/recommended-typescript"],
  {
    plugins: {
      jsdoc,
      "@stylistic": stylistic,
      "@typescript-eslint": tsPlugin,
      "unused-imports": unusedImports,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "*.js",
            "*.mjs",
            "*.cjs",
            "*.ts",
            "scripts/*.mjs",
            "scripts/sports/*.mjs",
          ],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING:
            Infinity,
        },
      },
    },
  },
  prettier,
  {
    rules: {
      "prettier/prettier": "off",
      "no-unused-vars": "off",
      "no-underscore-dangle": "off",
      "no-plusplus": "off",
      "class-method-use-this": "off",
      "max-classes-per-file": "off",
      "no-console": ["warn", { allow: ["debug", "info", "warn", "error"] }],
      "import-x/no-named-as-default": "off",
      "import-x/no-named-as-default-member": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-param": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  reactPlugin.configs.flat?.recommended,
  reactPlugin.configs.flat?.["jsx-runtime"],
  jsxA11y.flatConfigs.recommended,
  i18next.configs["flat/recommended"],
  {
    plugins: {
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      "i18next/no-literal-string": "warn",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "react/display-name": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  { plugins: { "@next/next": nextPlugin } },
  {
    files: ["*.cjs", "*.mjs", "scripts/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["node_modules", "dist"],
  },
  {
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Keep inherited diagnostics visible. The zero-warning script reports remaining debt; it must not hide it.
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
      "@next/next/no-img-element": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "warn",
      "react/no-children-prop": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  globalIgnores([
    ".keystone/**",
    ".next/**",
    "build/**",
    "coverage/**",
    "out/**",
    "next-env.d.ts",
  ]),
]);

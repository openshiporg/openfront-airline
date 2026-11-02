import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Scope to the files eslint-config-next registers its plugins for; otherwise
    // this block also hits .cjs files where the react/react-hooks plugins are absent.
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
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
  {
    // .cjs test files are CommonJS: require/module.exports are correct there, not debt.
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: Object.fromEntries(["require", "module", "exports", "__dirname", "__filename", "process", "console", "Buffer"].map((n) => [n, "readonly"])) },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-assign-module-variable": "off",
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

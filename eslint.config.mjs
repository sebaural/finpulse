import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/server/**/*.ts", "src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/api/*", "@/app/api/**"],
              message:
                "Server/lib code must not depend on App Router API internals. Import from '@/server/*' or '@/lib/*' instead.",
            },
            {
              group: ["../app/api/*", "../app/api/**", "../../app/api/*", "../../app/api/**", "../../../app/api/*", "../../../app/api/**"],
              message:
                "Server/lib code must not import from src/app/api internals via relative paths.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

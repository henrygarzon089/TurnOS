import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // NFR-009: 100 % de ramas en la lógica de dominio de posición/tiempo, comisión, cierre y dinero.
    // `pnpm test:coverage` (CI) falla si baja.
    coverage: {
      provider: "v8",
      include: [
        "src/lib/domain/queue-estimate.ts",
        "src/lib/domain/commission.ts",
        "src/lib/domain/cash-closure.ts",
        "src/lib/domain/money.ts",
      ],
      reporter: ["text"],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // Las pruebas de integración hablan con Postgres: en serie.
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});

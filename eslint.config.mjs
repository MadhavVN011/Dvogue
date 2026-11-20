import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', 'out/**', 'artifacts/**', 'cache/**', 'coverage/**', 'playwright-report/**', 'test-results/**']),
]);

import { defineConfig } from 'tsup';

export default defineConfig([
    {
        entry: { index: 'src/index.ts' },
        outDir: 'dist/esm',
        format: ['esm'],
        dts: true,
        outExtension: () => ({ js: '.mjs' }),
        clean: true,
        splitting: false,
        sourcemap: true,
        external: ['react', 'react-dom', 'vali-valid'],
    },
    {
        entry: { index: 'src/index.ts' },
        outDir: 'dist/cjs',
        format: ['cjs'],
        dts: false,
        clean: false,
        splitting: false,
        sourcemap: true,
        external: ['react', 'react-dom', 'vali-valid'],
    },
]);

import * as esbuild from 'esbuild';

try {
  await esbuild.build({
    entryPoints: ['server.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
    outfile: 'dist/server.cjs',
  });
  console.log('Server built successfully');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
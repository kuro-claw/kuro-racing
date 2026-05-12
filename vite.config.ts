import { defineConfig } from 'vite';

export default defineConfig({
  // Base path — deployed at kuro-racing.pages.dev (root)
  base: '/',

  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false, // disable source maps in production (reduces size)
    minify: 'esbuild',

    rollupOptions: {
      output: {
        // Manual chunks: split babylon core, GUI, and physics
        manualChunks: (id) => {
          if (id.includes('node_modules/@babylonjs/core')) {
            return 'babylon-core';
          }
          if (id.includes('node_modules/@babylonjs/gui')) {
            return 'babylon-gui';
          }
          if (id.includes('node_modules/@babylonjs/loaders')) {
            return 'babylon-loaders';
          }
          if (id.includes('node_modules/@babylonjs/serializers')) {
            return 'babylon-serializers';
          }
          // Physics, track, and game logic together
          if (
            id.includes('/src/physics/') ||
            id.includes('/src/track/') ||
            id.includes('/src/tracks/')
          ) {
            return 'game-physics';
          }
          // UI, audio, game systems
          if (
            id.includes('/src/ui/') ||
            id.includes('/src/audio/') ||
            id.includes('/src/game/') ||
            id.includes('/src/rendering/')
          ) {
            return 'game-systems';
          }
        },
        // Asset naming
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },

    // Raise chunk size warning to 1MB (Babylon.js is inherently large)
    chunkSizeWarningLimit: 1000,
  },

  server: {
    port: 5173,
    open: true,
  },
});

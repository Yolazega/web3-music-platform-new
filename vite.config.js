import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    optimizeDeps: {
        exclude: ['wagmi/chains'],
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    wagmi: ['wagmi', '@rainbow-me/rainbowkit', 'viem'],
                    ui: ['@mui/material', '@emotion/react', '@emotion/styled'],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
    },
    server: {
        port: 3000,
        host: true,
    },
    preview: {
        port: 3000,
        host: true,
    },
});

import { defineConfig } from "vite";
export default defineConfig({
  root: "test/legacy-ui",
  publicDir: "../../ui/public",
  build: {
    rolldownOptions: {
      output: {
        minify: {
          mangle: { keepNames: true },
          compress: { keepNames: { function: true, class: true } },
        },
      },
    },
    sourcemap: true,
    outDir: "../../.fallow/legacy-ui",
    emptyOutDir: true,
  },
});

import { defineConfig } from "vite";
export default defineConfig({
  root: "ui",
  plugins: [
    {
      name: "native-task-theme",
      enforce: "pre",
      transform(source, id) {
        if (id.split("?")[0].endsWith("/ui/style.css"))
          return `@scope (.native-task) { ${source.replace(":root", ":scope")} }`;
      },
    },
  ],
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
    outDir: "../dist",
    emptyOutDir: true,
  },
});

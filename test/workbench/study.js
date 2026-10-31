import { startWorkbench } from "../../ui/workbench/app.js";
const native = new URLSearchParams(location.search).has("native");
await startWorkbench(
  native
    ? {}
    : {
        staticData: () => fetch("./data.json").then((response) => response.json()),
        staticDatabases: async () => {
          try {
            const response = await fetch("../../output/product-identity/native-projects.json", {
              cache: "no-store",
            });
            return response.ok ? await response.json() : [];
          } catch {
            return [];
          }
        },
      },
);

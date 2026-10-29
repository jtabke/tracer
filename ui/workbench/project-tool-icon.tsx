import type { NativeTask } from "../native-task.tsx";

const paths: Record<NativeTask | "refresh" | "map" | "close", string> = {
  "next-work": "m4 6 2 2 3-4M12 6h8M4 13h4m4 0h8M4 20h4m4 0h8",
  configurations: "m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
  assessments: "M9 3h6l1 3h3v15H5V6h3l1-3ZM9 12h6m-6 4h4",
  verification: "m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Zm-4 9 3 3 5-6",
  create: "M14 3H5v18h14V8l-5-5Zm0 0v5h5m-7 3v6m-3-3h6",
  item: "m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z",
  references:
    "m10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
  evaluations: "M5 3h10l4 4v14H5V3Zm10 0v5h4M9 17v-3m3 3V9m3 8v-5",
  schema: "M9 3h6v6H9V3ZM3 15h6v6H3v-6Zm12 0h6v6h-6v-6ZM12 9v3M6 15v-3h12v3",
  import: "M4 15v6h16v-6M12 3v12m-5-5 5 5 5-5",
  export: "M4 15v6h16v-6M12 15V3m-5 5 5-5 5 5",
  docs: "M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15",
  refresh: "M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5m-4 7a8 8 0 0 0 14 4l3-3m0 5v-5h-5",
  map: "M8 3 2 6v15l6-3 8 3 6-3V3l-6 3-8-3Zm0 0v15m8-12v15",
  close: "m6 6 12 12M6 18 18 6",
};

export function ProjectToolIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}

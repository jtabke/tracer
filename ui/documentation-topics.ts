import readmeUrl from "../README.md?url";
import architectureUrl from "../docs/architecture.md?url";
import checkpointUrl from "../docs/checkpoint.md?url";
import developer from "../docs/developer-reference.md?raw";
import gettingStarted from "../docs/getting-started.md?raw";
import workspaceGuide from "../docs/workspace-guide.md?raw";
import csvImport from "../docs/csv-import.md?raw";
import projectExport from "../docs/project-export.md?raw";
import nextWork from "../docs/next-work.md?raw";
import customModel from "../docs/custom-model.md?raw";
import graphImage from "../docs/images/aster-workbench-graph.png?url";
import matrixImage from "../docs/images/aster-workbench-matrix.png?url";
import historyImage from "../docs/images/aster-workbench-history.png?url";
import assessmentImage from "../docs/images/aster-workbench-assessment.png?url";
import searchImage from "../docs/images/aster-workbench-search.png?url";
import editorImage from "../docs/images/aster-workbench-editor.png?url";
import connectionImage from "../docs/images/aster-workbench-connection-mobile.png?url";
import orbitImage from "../docs/images/aster-development-map.jpg?url";
import industry from "../docs/industry-workflows/README.md?raw";
import aerospace from "../docs/industry-workflows/aerospace.md?raw";
import automotive from "../docs/industry-workflows/automotive.md?raw";
import common from "../docs/industry-workflows/common-development-model.md?raw";
import companies from "../docs/industry-workflows/company-practices.md?raw";
import hardware from "../docs/industry-workflows/hardware-and-integrated-products.md?raw";
import medical from "../docs/industry-workflows/medical-devices.md?raw";
import software from "../docs/industry-workflows/software-products.md?raw";
import workspaceUrl from "../docs/industry-workspace-slice.md?url";
import examples from "../docs/realistic-examples.md?raw";

export type DocumentationTopic = {
  id: string;
  title: string;
  path: string;
  group: string;
  markdown: string;
};
export const documentationTopics: DocumentationTopic[] = [
  {
    id: "getting-started",
    title: "Getting started",
    path: "docs/getting-started.md",
    group: "Use Tracer",
    markdown: gettingStarted,
  },
  {
    id: "workspace-guide",
    title: "Workspace reference",
    path: "docs/workspace-guide.md",
    group: "Reference",
    markdown: workspaceGuide,
  },
  {
    id: "csv-import",
    title: "CSV import",
    path: "docs/csv-import.md",
    group: "Reference",
    markdown: csvImport,
  },
  {
    id: "project-export",
    title: "Project export",
    path: "docs/project-export.md",
    group: "Reference",
    markdown: projectExport,
  },
  {
    id: "next-work",
    title: "Next work",
    path: "docs/next-work.md",
    group: "Reference",
    markdown: nextWork,
  },
  {
    id: "custom-model",
    title: "Define a custom model",
    path: "docs/custom-model.md",
    group: "Reference",
    markdown: customModel,
  },
  {
    id: "examples",
    title: "Realistic examples",
    path: "docs/realistic-examples.md",
    group: "Reference",
    markdown: examples,
  },
  {
    id: "industries",
    title: "Industry overview",
    path: "docs/industry-workflows/README.md",
    group: "Development workflows",
    markdown: industry,
  },
  {
    id: "common",
    title: "Shared development logic",
    path: "docs/industry-workflows/common-development-model.md",
    group: "Development workflows",
    markdown: common,
  },
  {
    id: "medical",
    title: "Medical devices",
    path: "docs/industry-workflows/medical-devices.md",
    group: "Development workflows",
    markdown: medical,
  },
  {
    id: "software",
    title: "Software products",
    path: "docs/industry-workflows/software-products.md",
    group: "Development workflows",
    markdown: software,
  },
  {
    id: "hardware",
    title: "Hardware and software",
    path: "docs/industry-workflows/hardware-and-integrated-products.md",
    group: "Development workflows",
    markdown: hardware,
  },
  {
    id: "automotive",
    title: "Automotive",
    path: "docs/industry-workflows/automotive.md",
    group: "Development workflows",
    markdown: automotive,
  },
  {
    id: "aerospace",
    title: "Aviation and spaceflight",
    path: "docs/industry-workflows/aerospace.md",
    group: "Development workflows",
    markdown: aerospace,
  },
  {
    id: "companies",
    title: "Apple, Tesla and SpaceX",
    path: "docs/industry-workflows/company-practices.md",
    group: "Development workflows",
    markdown: companies,
  },
  {
    id: "developer",
    title: "Developer reference",
    path: "docs/developer-reference.md",
    group: "Reference",
    markdown: developer,
  },
];
const sourceUrls: Record<string, string> = {
  "docs/architecture.md": architectureUrl,
  "docs/industry-workspace-slice.md": workspaceUrl,
  "docs/checkpoint.md": checkpointUrl,
  "README.md": readmeUrl,
};
const imageUrls: Record<string, string> = {
  "docs/images/aster-development-map.jpg": orbitImage,
  "docs/images/aster-workbench-graph.png": graphImage,
  "docs/images/aster-workbench-matrix.png": matrixImage,
  "docs/images/aster-workbench-history.png": historyImage,
  "docs/images/aster-workbench-assessment.png": assessmentImage,
  "docs/images/aster-workbench-search.png": searchImage,
  "docs/images/aster-workbench-editor.png": editorImage,
  "docs/images/aster-workbench-connection-mobile.png": connectionImage,
};
export function documentationDestination(path: string, href: string) {
  const url = new URL(href, `https://documentation.tracer.local/${path}`);
  if (url.origin !== "https://documentation.tracer.local")
    return { kind: "external" as const, href };
  const resolved = decodeURIComponent(url.pathname.slice(1));
  const topic = documentationTopics.find((topic) => topic.path === resolved);
  if (topic)
    return { kind: "topic" as const, topic, heading: decodeURIComponent(url.hash.slice(1)) };
  if (sourceUrls[resolved])
    return { kind: "source" as const, href: sourceUrls[resolved], path: resolved };
  return { kind: "unavailable" as const, path: resolved };
}
export function documentationImage(path: string, src: string) {
  const url = new URL(src, `https://documentation.tracer.local/${path}`);
  return imageUrls[decodeURIComponent(url.pathname.slice(1))];
}

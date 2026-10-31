import readmeUrl from "../README.md?url";
import architectureUrl from "../docs/architecture.md?url";
import checkpointUrl from "../docs/checkpoint.md?url";
import developer from "../docs/reference/developer-reference.md?raw";
import gettingStarted from "../docs/guides/getting-started.md?raw";
import workspaceGuide from "../docs/guides/workspace-guide.md?raw";
import csvImport from "../docs/guides/csv-import.md?raw";
import projectExport from "../docs/guides/project-export.md?raw";
import nextWork from "../docs/guides/next-work.md?raw";
import customModel from "../docs/guides/custom-model.md?raw";
import graphImage from "../docs/images/aster-workbench-graph.png?url";
import matrixImage from "../docs/images/aster-workbench-matrix.png?url";
import historyImage from "../docs/images/aster-workbench-history.png?url";
import assessmentImage from "../docs/images/aster-workbench-assessment.png?url";
import searchImage from "../docs/images/aster-workbench-search.png?url";
import editorImage from "../docs/images/aster-workbench-editor.png?url";
import connectionImage from "../docs/images/aster-workbench-connection-mobile.png?url";
import orbitImage from "../docs/images/aster-development-map.jpg?url";
import industry from "../docs/guides/industry-workflows/README.md?raw";
import aerospace from "../docs/guides/industry-workflows/aerospace.md?raw";
import automotive from "../docs/guides/industry-workflows/automotive.md?raw";
import common from "../docs/guides/industry-workflows/common-development-model.md?raw";
import companies from "../docs/guides/industry-workflows/company-practices.md?raw";
import hardware from "../docs/guides/industry-workflows/hardware-and-integrated-products.md?raw";
import medical from "../docs/guides/industry-workflows/medical-devices.md?raw";
import software from "../docs/guides/industry-workflows/software-products.md?raw";
import archiveUrl from "../docs/development/archive.md?url";
import registerUrl from "../docs/development/register.md?url";
import domainUrl from "../docs/reference/architecture/domain-and-storage.md?url";
import commandsUrl from "../docs/reference/architecture/commands-and-api.md?url";
import evidenceUrl from "../docs/reference/architecture/evidence-and-change.md?url";
import workspaceUrl from "../docs/reference/architecture/workspace.md?url";
import assessmentModelUrl from "../docs/reference/models/change-assessment-model.json?url";
import verificationModelUrl from "../docs/reference/models/requirement-verification-model.json?url";
import examples from "../docs/guides/realistic-examples.md?raw";

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
    path: "docs/guides/getting-started.md",
    group: "Use Tracer",
    markdown: gettingStarted,
  },
  {
    id: "workspace-guide",
    title: "Workspace reference",
    path: "docs/guides/workspace-guide.md",
    group: "Reference",
    markdown: workspaceGuide,
  },
  {
    id: "csv-import",
    title: "CSV import",
    path: "docs/guides/csv-import.md",
    group: "Reference",
    markdown: csvImport,
  },
  {
    id: "project-export",
    title: "Project export",
    path: "docs/guides/project-export.md",
    group: "Reference",
    markdown: projectExport,
  },
  {
    id: "next-work",
    title: "Next work",
    path: "docs/guides/next-work.md",
    group: "Reference",
    markdown: nextWork,
  },
  {
    id: "custom-model",
    title: "Define a custom model",
    path: "docs/guides/custom-model.md",
    group: "Reference",
    markdown: customModel,
  },
  {
    id: "examples",
    title: "Realistic examples",
    path: "docs/guides/realistic-examples.md",
    group: "Reference",
    markdown: examples,
  },
  {
    id: "industries",
    title: "Industry overview",
    path: "docs/guides/industry-workflows/README.md",
    group: "Development workflows",
    markdown: industry,
  },
  {
    id: "common",
    title: "Shared development logic",
    path: "docs/guides/industry-workflows/common-development-model.md",
    group: "Development workflows",
    markdown: common,
  },
  {
    id: "medical",
    title: "Medical devices",
    path: "docs/guides/industry-workflows/medical-devices.md",
    group: "Development workflows",
    markdown: medical,
  },
  {
    id: "software",
    title: "Software products",
    path: "docs/guides/industry-workflows/software-products.md",
    group: "Development workflows",
    markdown: software,
  },
  {
    id: "hardware",
    title: "Hardware and software",
    path: "docs/guides/industry-workflows/hardware-and-integrated-products.md",
    group: "Development workflows",
    markdown: hardware,
  },
  {
    id: "automotive",
    title: "Automotive",
    path: "docs/guides/industry-workflows/automotive.md",
    group: "Development workflows",
    markdown: automotive,
  },
  {
    id: "aerospace",
    title: "Aviation and spaceflight",
    path: "docs/guides/industry-workflows/aerospace.md",
    group: "Development workflows",
    markdown: aerospace,
  },
  {
    id: "companies",
    title: "Apple, Tesla and SpaceX",
    path: "docs/guides/industry-workflows/company-practices.md",
    group: "Development workflows",
    markdown: companies,
  },
  {
    id: "developer",
    title: "Developer reference",
    path: "docs/reference/developer-reference.md",
    group: "Reference",
    markdown: developer,
  },
];
const sourceUrls: Record<string, string> = {
  "docs/architecture.md": architectureUrl,
  "docs/development/archive.md": archiveUrl,
  "docs/development/register.md": registerUrl,
  "docs/reference/architecture/domain-and-storage.md": domainUrl,
  "docs/reference/architecture/commands-and-api.md": commandsUrl,
  "docs/reference/architecture/evidence-and-change.md": evidenceUrl,
  "docs/reference/architecture/workspace.md": workspaceUrl,
  "docs/reference/models/change-assessment-model.json": assessmentModelUrl,
  "docs/reference/models/requirement-verification-model.json": verificationModelUrl,
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

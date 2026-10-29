import type { NativeTask } from "./native-task.tsx";
import "./project-task-navigation.css";

export const projectTaskGroups: {
  title: string;
  navigation?: "work" | "project";
  settings?: boolean;
  tasks: { task: NativeTask; title: string; description: string }[];
}[] = [
  {
    title: "Engineering work",
    navigation: "work",
    tasks: [
      { task: "next-work", title: "Next work", description: "Review gaps and follow-up" },
      {
        task: "configurations",
        title: "Configurations",
        description: "Capture and compare exact states",
      },
      {
        task: "verification",
        title: "Verification",
        description: "Criteria, results and conclusions",
      },
      {
        task: "assessments",
        title: "Change assessments",
        description: "Controlled scope, dispositions and follow-up actions",
      },
    ],
  },
  {
    title: "Records and evidence",
    tasks: [
      { task: "create", title: "Create record", description: "Add an engineering record" },
      {
        task: "item",
        title: "Edit record and connections",
        description: "Update the selected record",
      },
      {
        task: "references",
        title: "References for selected record",
        description: "Sources for the selected record",
      },
    ],
  },
  {
    title: "Import & export",
    settings: true,
    tasks: [
      { task: "import", title: "Import CSV", description: "Bring in records and links" },
      { task: "export", title: "Export project", description: "Download recorded project JSON" },
    ],
  },
  {
    title: "Advanced",
    settings: true,
    tasks: [
      {
        task: "evaluations",
        title: "Evaluation records",
        description: "Inspect recorded outcomes",
      },
    ],
  },
  {
    title: "Project",
    navigation: "project",
    tasks: [
      { task: "schema", title: "Model", description: "Types, fields and connections" },
      { task: "docs", title: "Documentation", description: "Guides and reference material" },
    ],
  },
];

export const projectUtilities = [
  {
    action: "refresh-project",
    icon: "refresh",
    title: "Refresh project",
    description: "Reload the latest recorded project state",
  },
  {
    action: "development-map",
    icon: "map",
    title: "Development map",
    description: "Open the retained map experience",
  },
] as const;

export function selectedRecordTask(task: NativeTask) {
  return task === "item" || task === "references";
}

export function ProjectTaskNavigation({
  task,
  hasEntity,
  onTask,
}: {
  task: NativeTask;
  hasEntity: boolean;
  onTask(task: NativeTask): void;
}) {
  return (
    <nav className="project-task-navigation" aria-label="Project tasks">
      <label>
        Project task
        <select value={task} onChange={(event) => onTask(event.target.value as NativeTask)}>
          {projectTaskGroups.map((group) => (
            <optgroup label={group.title} key={group.title}>
              {group.tasks.map((item) => (
                <option
                  key={item.task}
                  value={item.task}
                  disabled={selectedRecordTask(item.task) && !hasEntity}
                >
                  {item.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </nav>
  );
}

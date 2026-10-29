import type { NativeTask } from "./native-task.tsx";
import "./project-task-navigation.css";

export const projectTaskGroups: {
  title: string;
  tasks: { task: NativeTask; title: string; description: string }[];
}[] = [
  {
    title: "Engineering work",
    tasks: [
      { task: "next-work", title: "Next work", description: "Review gaps and follow-up" },
      {
        task: "configurations",
        title: "Configurations",
        description: "Capture and compare exact states",
      },
      {
        task: "assessments",
        title: "Change assessments",
        description: "Review evidence after changes",
      },
      {
        task: "verification",
        title: "Verification",
        description: "Criteria, results and conclusions",
      },
    ],
  },
  {
    title: "Records and evidence",
    tasks: [
      { task: "create", title: "New item", description: "Add an engineering record" },
      {
        task: "item",
        title: "Edit item and connections",
        description: "Update the selected record",
      },
      {
        task: "references",
        title: "References for selected record",
        description: "Sources for the selected record",
      },
      { task: "evaluations", title: "Evaluations", description: "Inspect recorded outcomes" },
    ],
  },
  {
    title: "Project setup and exchange",
    tasks: [
      { task: "schema", title: "Configure model", description: "Types, fields and connections" },
      { task: "import", title: "Import CSV", description: "Bring in records and links" },
      { task: "export", title: "Export project", description: "Download recorded project JSON" },
    ],
  },
  {
    title: "Help",
    tasks: [{ task: "docs", title: "Documentation", description: "Guides and reference material" }],
  },
];

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

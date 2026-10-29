import type { NativeTask } from "./native-task.tsx";
import "./project-task-navigation.css";

export const projectTaskGroups: {
  title: string;
  tasks: { task: NativeTask; title: string }[];
}[] = [
  {
    title: "Engineering work",
    tasks: [
      { task: "next-work", title: "Next work" },
      { task: "configurations", title: "Configurations" },
      { task: "assessments", title: "Change assessments" },
      { task: "verification", title: "Verification" },
    ],
  },
  {
    title: "Records and evidence",
    tasks: [
      { task: "create", title: "New item" },
      { task: "item", title: "Edit item and connections" },
      { task: "references", title: "References for selected record" },
      { task: "evaluations", title: "Evaluations" },
    ],
  },
  {
    title: "Project setup and exchange",
    tasks: [
      { task: "schema", title: "Configure model" },
      { task: "import", title: "Import CSV" },
      { task: "export", title: "Export project" },
    ],
  },
  { title: "Help", tasks: [{ task: "docs", title: "Documentation" }] },
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

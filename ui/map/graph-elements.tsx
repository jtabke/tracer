import type { Edge, EdgeProps, Node, NodeProps } from "@xyflow/react";
import { BaseEdge, EdgeLabelRenderer, Handle, Position } from "@xyflow/react";
import { edgeRoute } from "./edge-route.ts";
import { PAGE_SIZE, typeNames } from "./model.ts";
import type { EdgeData, NodeData, Point } from "./types.ts";

function Ports({ vertical }: { vertical?: boolean }) {
  return (
    <>
      <Handle type="target" position={vertical ? Position.Top : Position.Left} />
      <Handle type="source" position={vertical ? Position.Bottom : Position.Right} />
    </>
  );
}
function groupProgress(data: NodeData) {
  if (!data.open) return "";
  if (data.childGroups)
    return ` · ${data.childGroups} ${data.childGroups === 1 ? "folder" : "folders"}`;
  return (data.pageCount ?? 0) > 1 ? ` · ${(data.page ?? 0) + 1}/${data.pageCount}` : "";
}
function GroupToggle({ data }: { data: NodeData }) {
  const folder = !!data.path?.length;
  const type = data.type ?? "";
  const action = folder ? "Open" : data.open ? "Collapse" : "Expand";
  const name = folder ? `${data.title} · ${typeNames[type]}` : typeNames[type];
  return (
    <button
      className="nodrag nopan"
      aria-label={`${action} ${name}`}
      aria-expanded={folder ? undefined : data.open}
      title={folder ? "Open folder and direct item traces" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        data.toggle?.(data.groupKey ?? type);
      }}
    >
      {folder ? "→" : data.open ? "−" : "+"}
    </button>
  );
}
function ModelGroup({ data }: NodeProps<Node<NodeData>>) {
  const type = data.type ?? "";
  const total = data.total ?? 0;
  return (
    <div
      className={`model-group ${data.open ? "expanded" : ""} ${data.selected ? "chosen" : ""} ${data.external ? "external-group" : ""}`}
    >
      <Ports vertical={data.vertical} />
      <div className="group-heading">
        <div>
          <strong>{data.title ?? typeNames[type] ?? type}</strong>
          <span>
            {data.external ? "Outside scope · " : data.path?.length ? "Folder · " : ""}
            {total.toLocaleString()} {total === 1 ? "record" : "records"}
            {groupProgress(data)}
          </span>
        </div>
        {!data.external && <GroupToggle data={data} />}
        {data.open && data.enter && (
          <button
            className="nodrag nopan focus-group-button"
            aria-label={`Focus ${data.title ?? typeNames[type]} group`}
            title="Focus group: hide other branches, keep a way back"
            onClick={(event) => {
              event.stopPropagation();
              data.enter?.(data.groupKey ?? type);
            }}
          >
            ↗
          </button>
        )}
      </div>
    </div>
  );
}
function Remainder({ data }: { data: NodeData }) {
  return (
    <div className="remainder">
      <Ports vertical={data.vertical} />
      <span>{data.count?.toLocaleString()} other records</span>
      <button
        className="nodrag nopan"
        onClick={(event) => {
          event.stopPropagation();
          data.next?.(data.pageKey ?? data.type ?? "");
        }}
      >
        Next {PAGE_SIZE} →
      </button>
    </div>
  );
}
function FolderCaption({ data }: { data: NodeData }) {
  const type = data.entity?.type ?? "";
  const folder = data.folderPath?.join(" / ");
  const caption = `${typeNames[type]}${folder && folder !== "Unfiled" ? ` / ${folder}` : ""}`;
  return (
    <span className="walk-folder" title={caption}>
      {data.productContext ? "Product context · Intended use & scope" : caption}
    </span>
  );
}
function RecordNode({ data }: NodeProps<Node<NodeData>>) {
  if (data.kind === "remainder") return <Remainder data={data} />;
  const entity = data.entity;
  if (!entity) throw new Error("A record node requires a native item.");
  return (
    <div
      className={`record-node ${data.onActivePath ? "on-active-path" : ""} ${data.selected ? "chosen" : ""} ${data.root ? "root-record" : ""} ${data.external ? "external-record" : ""}`}
    >
      <Ports vertical={data.vertical} />
      <span className="record-key">
        {entity.key}
        {data.external ? " · Outside scope" : ""}
      </span>
      <strong>{entity.fields.title}</strong>
      {(data.walk || data.showFolder) && <FolderCaption data={data} />}
    </div>
  );
}
function activeEdge(data: EdgeData) {
  return data.onPath || data.selected || (!data.background && data.incident);
}
function edgeStroke(data: EdgeData) {
  if (data.onPath || data.selected) return "#81dfd2";
  if (data.next) return "#8fa9b0";
  return activeEdge(data) ? "#81dfd2" : "#647a81";
}
function edgeOpacity(data: EdgeData) {
  if (data.background) return 0.12;
  if (data.dim) return 0.35;
  return data.next ? 0.7 : 1;
}
function LabelLeader({ origin, position }: { origin?: Point; position: Point }) {
  if (!origin || Math.hypot(origin.x - position.x, origin.y - position.y) <= 2) return null;
  return (
    <path
      d={`M${origin.x},${origin.y} L${position.x},${position.y}`}
      stroke="#647a81"
      strokeWidth={0.8}
      strokeDasharray="3 3"
      fill="none"
      pointerEvents="none"
    />
  );
}
function ConnectionCount({ data }: { data: EdgeData }) {
  if (data.allowed) return <>allowed · 0 links</>;
  if (data.selectedLinks)
    return (
      <>
        {" "}
        · {data.selectedLinks}/{data.linkIds.length} selected
      </>
    );
  return data.linkIds.length > 1 ? <> · {data.linkIds.length}</> : null;
}
function ConnectionLabel({ id, data, position }: { id: string; data: EdgeData; position: Point }) {
  const description = data.allowed
    ? "allowed route, no recorded connections"
    : `${data.linkIds.length} recorded connections`;
  return (
    <EdgeLabelRenderer>
      <button
        className={`edge-label ${data.onPath ? "path-label" : ""} nodrag nopan ${activeEdge(data) ? "active" : ""}`}
        data-bundle-id={id}
        style={{ transform: `translate(-50%, -50%) translate(${position.x}px,${position.y}px)` }}
        onClick={() => data.inspect?.(id)}
        aria-label={`${data.label}, ${description}`}
      >
        {data.label}
        <span>
          <ConnectionCount data={data} />
        </span>
      </button>
    </EdgeLabelRenderer>
  );
}
function RoutedEdge(props: EdgeProps<Edge<EdgeData>>) {
  const { id, data, markerEnd } = props;
  if (!data) throw new Error("A routed edge requires connection data.");
  const { path, labelPosition } = edgeRoute({ ...props, data });
  const position = data.readableLabel?.position ?? labelPosition;
  const active = activeEdge(data);
  return (
    <>
      {data.onPath && (
        <path
          className="trace-path-halo"
          d={path}
          stroke="#151b1f"
          strokeWidth={7}
          fill="none"
          pointerEvents="none"
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={18}
        style={{
          stroke: edgeStroke(data),
          strokeWidth: data.onPath ? 3 : active ? 1.8 : 1.3,
          strokeDasharray: data.allowed ? "5 5" : undefined,
          opacity: edgeOpacity(data),
        }}
      />
      {data.showLabel && position && (
        <>
          <LabelLeader origin={data.readableLabel?.origin} position={position} />
          <ConnectionLabel id={id} data={data} position={position} />
        </>
      )}
    </>
  );
}
export const nodeTypes = { modelGroup: ModelGroup, record: RecordNode };
export const edgeTypes = { routed: RoutedEdge };

import type { Entity } from "../../src/core/model.ts";
import type { SupportReference } from "../../src/core/change-assessment.ts";
import type { Editing } from "../editing.ts";
import { RecordedMaterialChoice } from "../evidence/recorded-material.tsx";
export function SupportMaterialChoice(props: {
  title: string;
  kind: "receipt" | "observation" | "relationship";
  entities: Entity[];
  editing: Editing;
  selected: SupportReference | undefined;
  onChoose(value: SupportReference | undefined): void;
}) {
  return (
    <RecordedMaterialChoice
      {...props}
      onChoose={(item) =>
        props.onChoose(
          !item
            ? undefined
            : "source" in item
              ? { kind: "relationship", id: item.id, version: item.version, mode: "historical" }
              : "entityId" in item
                ? { kind: "observation", id: item.id, mode: "historical" }
                : { kind: "receipt", id: item.id, mode: "historical" },
        )
      }
    />
  );
}

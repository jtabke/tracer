import { useEffect, useEffectEvent, useMemo, useReducer } from "react";
import { indexFixture } from "./model.ts";
import type { Fixture } from "./types.ts";
import { initialView, viewReducer } from "./view-state.ts";

export function useMapView(data: Fixture) {
  const index = useMemo(() => indexFixture(data), [data]);
  const presets = data.scopes,
    defaultPreset = data.defaultScope;
  const relationTypes = Object.keys(data.schema.relationshipTypes);
  const [view, changeView] = useReducer(
    viewReducer,
    { presets, defaultPreset, relationTypes },
    initialView,
  );
  // A new native snapshot must not discard filters. Only an adopted schema version resets the scope.
  const adoptSchemaScope = useEffectEvent(() =>
    changeView({ types: presets[defaultPreset], preset: defaultPreset, relations: relationTypes }),
  );
  useEffect(() => {
    adoptSchemaScope();
  }, [data.schema.version]);
  return { index, view, changeView, presets, defaultPreset, relationTypes };
}

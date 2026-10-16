import { useState, type FormEvent } from "react";
import type { ViewSnapshot } from "./types.ts";
export function useSessionViews(capture: () => ViewSnapshot) {
  const [navigation, setNavigation] = useState<ViewSnapshot[]>([]);
  const [savedViews, setSavedViews] = useState<{ name: string; snapshot: ViewSnapshot }[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState("");
  function saveWorkingView(event: FormEvent) {
    event.preventDefault();
    if (!viewName.trim()) return;
    const snapshot = capture();
    setSavedViews((current) => [...current, { name: viewName.trim(), snapshot }]);
    setViewName("");
    setSavingView(false);
  }
  return {
    navigation,
    setNavigation,
    savedViews,
    savingView,
    viewName,
    setSavingView,
    setViewName,
    saveWorkingView,
  };
}

import { useRef, useState } from "react";
export function useMapTools() {
  const [message, setMessage] = useState("");
  const [browseRail, setBrowseRail] = useState(true);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState("items");
  const mobileDetailsTrigger = useRef<HTMLButtonElement>(null);
  const panelTrigger = useRef<HTMLElement | null>(null);
  return {
    message,
    setMessage,
    browseRail,
    mobileDetailsOpen,
    panel,
    filterTab,
    mobileDetailsTrigger,
    panelTrigger,
    setBrowseRail,
    setMobileDetailsOpen,
    setPanel,
    setFilterTab,
  };
}

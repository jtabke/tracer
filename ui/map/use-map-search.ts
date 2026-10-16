import { useMemo, useRef, useState } from "react";
import { searchItems } from "./model.ts";
import type { MapIndex } from "./types.ts";
export function useMapSearch(index: MapIndex) {
  const [query, setQuery] = useState("");
  const [searchPage, setSearchPage] = useState(0);
  const [searchType, setSearchType] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const search = useMemo(
    () => searchItems(index, query, 8, { offset: searchPage * 8, type: searchType }),
    [index, query, searchPage, searchType],
  );
  return {
    query,
    searchPage,
    searchType,
    search,
    searchRef,
    setQuery,
    setSearchPage,
    setSearchType,
  };
}

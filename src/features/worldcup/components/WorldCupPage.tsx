"use client";

import { GamesTab } from "./games/GamesTab";
import { PropsTab } from "./props/PropsTab";
import { GroupsTab } from "./groups/GroupsTab";
import { BracketTab } from "./bracket/BracketTab";
import type { WcTab } from "../tabs";

/**
 * Active World Cup tab content. The sub-tab nav now lives in the `(list)`
 * layout ({@link WorldCupSubTabs}) so it is not rebuilt on tab switches; this
 * component only renders the content for the active tab.
 */
export function WorldCupPage({ tab }: { tab: WcTab }) {
  return (
    <>
      {tab === "today" && <GamesTab mode="today" />}
      {tab === "games" && <GamesTab />}
      {tab === "props" && <PropsTab />}
      {tab === "groups" && <GroupsTab />}
      {tab === "bracket" && <BracketTab />}
    </>
  );
}

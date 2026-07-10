"use client";

import {
  subscribeCentrifugoJson,
  type CentrifugoJsonStatus,
} from "../../../libs/centrifugoJsonClient";
import type { SmartMoneyLiveActivity } from "../types";
import {
  adaptSmartMoneyLiveActivity,
  isSmartMoneyLiveActivityEnvelopeDto,
} from "./liveFeedAdapter";

const GLOBAL_CHANNEL = "prediction.smart_money.live_feed.global";
const WORLDCUP_CHANNEL = "prediction.smart_money.live_feed.worldcup_2026";

function channelForTag(tag?: string | null): string {
  return tag === "worldcup_2026" ? WORLDCUP_CHANNEL : GLOBAL_CHANNEL;
}

function scopeForTag(tag?: string | null): "global" | "worldcup_2026" {
  return tag === "worldcup_2026" ? "worldcup_2026" : "global";
}

export function subscribeSmartMoneyLiveFeed({
  tag,
  onActivity,
  onStatus,
}: {
  tag?: string | null;
  onActivity: (activity: SmartMoneyLiveActivity) => void;
  onStatus?: (status: CentrifugoJsonStatus) => void;
}): () => void {
  const scope = scopeForTag(tag);
  return subscribeCentrifugoJson({
    channel: channelForTag(tag),
    onStatus,
    onData: (data) => {
      if (!isSmartMoneyLiveActivityEnvelopeDto(data)) return;
      if (data.scope !== scope) return;
      const activity = adaptSmartMoneyLiveActivity(data.activity);
      if (activity) onActivity(activity);
    },
  });
}

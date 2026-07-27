import { num } from "../format";
import type {
  SmartEventRef,
  SmartMarketRef,
  SmartMoneyLiveActivity,
  SmartMoneyLiveActivityType,
  SmartOutcomeRef,
} from "../types";

export interface SmartMoneyLiveFeedDto {
  tag?: string;
  cursor?: string | null;
  limit: number;
  order: "desc";
  retention_days?: number;
  activities: SmartMoneyLiveActivityDto[] | null;
}

export interface SmartMoneyLiveActivityDto {
  activity_id?: string;
  type: string;
  wallet?: string;
  taker?: string;
  taker_name?: string;
  taker_image?: string;
  taker_pseudonym?: string;
  taker_tags?: string[];
  condition_id?: string;
  market_id?: string;
  market_question?: string;
  market_question_trans?: string;
  market_icon?: string;
  event_slug?: string;
  token_id?: string;
  outcome?: string;
  outcome_trans?: string;
  outcomes?: string[] | null;
  price?: string;
  price_per_share?: string;
  quantity?: string;
  amount?: string;
  amount_in_usd?: string;
  timestamp?: number;
  block_number?: number;
  log_index?: number;
  tx_hash?: string;
  seq_index?: string;
  source?: string;
  tags?: string[] | null;
  upstream_tags?: string[] | null;
  event_title?: string;
  event_title_trans?: string;
  event_image_url?: string;
  market_image_url?: string;
  market_description?: string;
  market_description_trans?: string;
  event?: SmartEventRefDto;
  market?: SmartMarketRefDto;
}

export interface SmartMoneyLiveActivityEnvelopeDto {
  type: "activity";
  scope: "global" | "worldcup_2026";
  tag: "" | "worldcup_2026";
  activity: SmartMoneyLiveActivityDto;
}

interface SmartEventRefDto {
  slug?: string;
  title?: string;
  title_trans?: string;
  image_url?: string;
  kind?: string;
  worldcup_match_slug?: string;
}

interface SmartOutcomeRefDto {
  key?: string;
  label?: string;
  label_trans?: string;
}

interface SmartMarketRefDto {
  slug?: string;
  event_slug?: string;
  question?: string;
  question_trans?: string;
  description?: string;
  description_trans?: string;
  image_url?: string;
  outcomes?: SmartOutcomeRefDto[] | null;
  provider_meta?: Record<string, unknown> | null;
}

const LIVE_ACTIVITY_TYPES = new Set<string>([
  "buy",
  "sell",
  "redeem",
  "inventory_adjust",
  "merge",
  "split",
]);

function adaptLiveActivityType(type: string | undefined): SmartMoneyLiveActivityType {
  const lower = (type ?? "").toLowerCase();
  return LIVE_ACTIVITY_TYPES.has(lower) ? (lower as SmartMoneyLiveActivityType) : "unknown";
}

function normalizeTimestampMs(timestamp: number | undefined): number | undefined {
  if (timestamp === undefined || !Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function adaptSmartEventRef(d?: SmartEventRefDto): SmartEventRef | undefined {
  if (!d) return undefined;
  return {
    slug: d.slug,
    title: d.title,
    titleTrans: d.title_trans,
    imageUrl: d.image_url,
    kind: d.kind,
    worldcupMatchSlug: d.worldcup_match_slug,
  };
}

function adaptSmartOutcomeRef(d: SmartOutcomeRefDto): SmartOutcomeRef {
  return {
    key: d.key,
    label: d.label,
    labelTrans: d.label_trans,
  };
}

function adaptSmartMarketRef(d?: SmartMarketRefDto): SmartMarketRef | undefined {
  if (!d) return undefined;
  return {
    slug: d.slug,
    eventSlug: d.event_slug,
    question: d.question,
    questionTrans: d.question_trans,
    description: d.description,
    descriptionTrans: d.description_trans,
    imageUrl: d.image_url,
    outcomes: (d.outcomes ?? []).map(adaptSmartOutcomeRef),
    providerMeta: d.provider_meta ?? undefined,
  };
}

export function adaptSmartMoneyLiveActivity(
  dto: SmartMoneyLiveActivityDto,
): SmartMoneyLiveActivity | null {
  // Without either field the row cannot produce a stable dedupe key.
  if (!dto.activity_id && !dto.tx_hash) return null;

  const event = adaptSmartEventRef(dto.event);
  const market = adaptSmartMarketRef(dto.market);
  const wallet = dto.wallet || dto.taker || "";
  return {
    activityId: dto.activity_id,
    type: adaptLiveActivityType(dto.type),
    wallet,
    taker: dto.taker,
    traderName: dto.taker_name || dto.taker_pseudonym,
    traderImage: dto.taker_image,
    traderTags: dto.taker_tags ?? [],
    conditionId: dto.condition_id,
    marketId: dto.market_id,
    marketQuestion: dto.market_question,
    marketQuestionTrans: dto.market_question_trans,
    marketIcon: dto.market_icon,
    eventSlug: dto.event_slug,
    tokenId: dto.token_id,
    outcome: dto.outcome,
    outcomeTrans: dto.outcome_trans,
    price: num(dto.price_per_share ?? dto.price),
    quantity: num(dto.quantity),
    amount: num(dto.amount),
    amountInUsd: num(dto.amount_in_usd),
    timestamp: normalizeTimestampMs(dto.timestamp),
    logIndex: dto.log_index,
    txHash: dto.tx_hash,
    seqIndex: dto.seq_index,
    source: dto.source,
    tags: uniqueStrings([...(dto.tags ?? []), ...(dto.upstream_tags ?? [])]),
    eventTitle: dto.event_title ?? event?.title,
    eventTitleTrans: dto.event_title_trans ?? event?.titleTrans,
    eventImageUrl: dto.event_image_url ?? event?.imageUrl,
    marketImageUrl: dto.market_image_url ?? market?.imageUrl,
    marketDescription: dto.market_description ?? market?.description,
    marketDescriptionTrans: dto.market_description_trans ?? market?.descriptionTrans,
    event,
    market,
  };
}

export function liveActivityKey(activity: SmartMoneyLiveActivity): string {
  return (
    activity.activityId ||
    [activity.txHash, String(activity.logIndex ?? ""), activity.wallet, activity.tokenId, activity.type]
      .map((part) => part ?? "")
      .join(":")
  );
}

export function isSmartMoneyLiveActivityEnvelopeDto(
  value: unknown,
): value is SmartMoneyLiveActivityEnvelopeDto {
  const envelope = value as SmartMoneyLiveActivityEnvelopeDto;
  const activity = envelope?.activity;
  return (
    envelope?.type === "activity" &&
    (envelope.scope === "global" || envelope.scope === "worldcup_2026") &&
    typeof activity?.type === "string" &&
    Boolean(activity.activity_id || activity.tx_hash)
  );
}

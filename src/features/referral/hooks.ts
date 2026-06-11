"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  referralApi,
  type BindReferralResponse,
  type ClaimResponse,
  type InviteCodeResponse,
  type InviteeSummary,
  type RebateProfile,
  type RebateTradeItem,
  type ReferralConfig,
} from "./api";

const STALE_30S = 30_000;

export const referralKeys = {
  config: ["referral", "config"] as const,
  inviteCode: (eoa?: string) => ["referral", "invite_code", eoa] as const,
  profile: (eoa?: string) => ["referral", "profile", eoa] as const,
  invitees: (eoa?: string, page = 1, pageSize = 50) =>
    ["referral", "invitees", eoa, page, pageSize] as const,
  trades: (eoa?: string, page = 1, pageSize = 50) =>
    ["referral", "trades", eoa, page, pageSize] as const,
};

export function useReferralConfig(): UseQueryResult<ReferralConfig> {
  return useQuery({
    queryKey: referralKeys.config,
    queryFn: ({ signal }) => referralApi.config(signal),
    staleTime: 5 * 60_000,
  });
}

export function useInviteCode(eoa?: string): UseQueryResult<InviteCodeResponse> {
  return useQuery({
    queryKey: referralKeys.inviteCode(eoa),
    queryFn: ({ signal }) => referralApi.inviteCode(eoa as string, signal),
    enabled: Boolean(eoa),
    staleTime: STALE_30S,
  });
}

export function useRebateProfile(eoa?: string): UseQueryResult<RebateProfile> {
  return useQuery({
    queryKey: referralKeys.profile(eoa),
    queryFn: ({ signal }) => referralApi.profile(eoa as string, signal),
    enabled: Boolean(eoa),
    staleTime: STALE_30S,
  });
}

export function useInvitees(
  eoa?: string,
  page = 1,
  pageSize = 50,
): UseQueryResult<InviteeSummary[]> {
  return useQuery({
    queryKey: referralKeys.invitees(eoa, page, pageSize),
    queryFn: ({ signal }) => referralApi.invitees(eoa as string, page, pageSize, signal),
    enabled: Boolean(eoa),
    staleTime: STALE_30S,
  });
}

export function useRebateTrades(
  eoa?: string,
  page = 1,
  pageSize = 50,
): UseQueryResult<RebateTradeItem[]> {
  return useQuery({
    queryKey: referralKeys.trades(eoa, page, pageSize),
    queryFn: ({ signal }) => referralApi.trades(eoa as string, page, pageSize, signal),
    enabled: Boolean(eoa),
    staleTime: STALE_30S,
  });
}

export function useBindReferral() {
  const queryClient = useQueryClient();
  return useMutation<
    BindReferralResponse,
    Error,
    { invite_code: string; user_address: string; safe_address?: string }
  >({
    mutationFn: (params) => referralApi.bind(params),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: referralKeys.inviteCode(vars.user_address) });
    },
  });
}

export function useClaimRebate(eoa?: string) {
  const queryClient = useQueryClient();
  return useMutation<ClaimResponse, Error, void>({
    mutationFn: () => referralApi.claim(eoa as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: referralKeys.profile(eoa) });
      queryClient.invalidateQueries({ queryKey: referralKeys.trades(eoa) });
    },
  });
}

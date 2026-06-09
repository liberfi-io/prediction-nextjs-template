"use client";

/**
 * Portfolio loading skeleton — deliberately kept in its own lightweight module
 * (only the pure leaderboard card skeletons + i18n) so the route-level
 * `app/portfolio/loading.tsx` can render it WITHOUT pulling in the heavy
 * `PredictPortfolioPage` bundle (positions hooks, fund-wallet modal, relay
 * libs). Importing it from the page module made Next.js fall back to the
 * parent `app/loading.tsx` (the markets skeleton) while the big chunk loaded.
 */

import { useTranslation } from "@liberfi.io/i18n";
import {
  PerformanceBiasCardSkeleton,
  TotalValueCardSkeleton,
  YieldRiskCardSkeleton,
} from "../../features/leaderboard/components/skeletons";

/** Shimmer placeholder block driven by the `pf-shimmer` keyframe. */
export function Shimmer({
  delay = 0,
  style,
}: {
  delay?: number;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
        backgroundSize: "200% 100%",
        animation: `pf-shimmer 1.8s ease-in-out infinite ${delay}ms`,
        borderRadius: 6,
        ...style,
      }}
    />
  );
}

export function PortfolioSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <style>{`@keyframes pf-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Title */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("extend.portfolio.title")}
        </h1>
      </div>

      {/* Summary panels — same 3-col grid as PortfolioContent */}
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <TotalValueCardSkeleton />
        <PerformanceBiasCardSkeleton />
        <YieldRiskCardSkeleton />
      </div>

      {/* Tabs — matches actual tab bar */}
      <div style={{ borderBottom: "1px solid rgba(39,39,42,0.5)" }}>
        <div className="flex gap-0">
          {[72, 88, 96].map((w, i) => (
            <div key={i} style={{ padding: "10px 16px" }}>
              <Shimmer delay={i * 100 + 300} style={{ height: 14, width: w }} />
            </div>
          ))}
        </div>
      </div>

      {/* Position rows shimmer */}
      <div
        className="mt-4"
        style={{
          borderRadius: 12,
          border: "1px solid rgba(39,39,42,0.3)",
          background: "rgba(24,24,27,0.2)",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{ borderBottom: i < 3 ? "1px solid rgba(39,39,42,0.3)" : "none" }}
          >
            {/* Desktop row shimmer */}
            <div className="hidden lg:flex items-center gap-3" style={{ padding: "16px 20px" }}>
              <Shimmer delay={i * 120 + 400} style={{ height: 44, width: 44, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Shimmer delay={i * 120 + 450} style={{ height: 14, width: i % 2 === 0 ? "70%" : "55%", marginBottom: 8 }} />
                <Shimmer delay={i * 120 + 500} style={{ height: 10, width: i % 2 === 0 ? "45%" : "35%" }} />
              </div>
              <Shimmer delay={i * 120 + 480} style={{ height: 14, width: 80, flexShrink: 0 }} />
              <Shimmer delay={i * 120 + 520} style={{ height: 20, width: 72, flexShrink: 0 }} />
              <Shimmer delay={i * 120 + 560} style={{ height: 36, width: 64, borderRadius: 8, flexShrink: 0 }} />
            </div>
            {/* Compact row shimmer (tablet + mobile) */}
            <div className="lg:hidden" style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <Shimmer delay={i * 120 + 400} style={{ height: 40, width: 40, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Shimmer delay={i * 120 + 450} style={{ height: 14, width: i % 2 === 0 ? "80%" : "65%", marginBottom: 6 }} />
                  <Shimmer delay={i * 120 + 500} style={{ height: 10, width: "40%" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Shimmer delay={i * 120 + 480} style={{ height: 12, width: 100 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Shimmer delay={i * 120 + 520} style={{ height: 14, width: 60 }} />
                  <Shimmer delay={i * 120 + 560} style={{ height: 28, width: 52, borderRadius: 8 }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Loading() {
  const shimmer: React.CSSProperties = {
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.8s ease-in-out infinite",
    borderRadius: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: "rgba(10,10,11,0.5)" }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}@media(max-width:768px){.loading-card-grid{grid-template-columns:1fr!important}.loading-hero-title{width:280px!important}.loading-stat-grid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
      <div
        style={{
          maxWidth: 1152,
          margin: "0 auto",
          padding: "24px 16px 48px",
        }}
      >
        {/* Hero skeleton */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            paddingTop: 32,
            paddingBottom: 32,
          }}
        >
          {/* Live badge placeholder */}
          <div style={{ ...shimmer, height: 32, width: 140, borderRadius: 9999 }} />
          {/* Title placeholder */}
          <div className="loading-hero-title" style={{ ...shimmer, height: 48, width: 420, borderRadius: 8 }} />
          {/* Subtitle placeholder */}
          <div style={{ ...shimmer, height: 16, width: 320, borderRadius: 4 }} />
          {/* Stat cards — 4 columns */}
          <div
            className="loading-stat-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              width: "100%",
              maxWidth: 672,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 4,
                }}
              >
                <div
                  style={{
                    ...shimmer,
                    height: 20,
                    width: 60,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
                <div
                  style={{
                    ...shimmer,
                    height: 12,
                    width: 80,
                    animationDelay: `${i * 100 + 50}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar skeleton */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 16,
          }}
        >
          <div style={{ ...shimmer, height: 14, width: 180 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ ...shimmer, height: 36, width: 100, borderRadius: 10 }} />
            <div style={{ ...shimmer, height: 36, width: 80, borderRadius: 10 }} />
            <div style={{ ...shimmer, height: 36, width: 36, borderRadius: 10 }} />
          </div>
        </div>

        {/* Card grid skeleton — 2 columns */}
        <div
          className="loading-card-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeletonCard key={i} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeletonCard({ index }: { index: number }) {
  const delay = index * 150;
  const shimmer: React.CSSProperties = {
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)",
    backgroundSize: "200% 100%",
    animation: `shimmer 1.8s ease-in-out infinite ${delay}ms`,
    borderRadius: 6,
  };

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(39,39,42,0.6)",
        background: "rgba(24,24,27,0.4)",
        overflow: "hidden",
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "16px 16px 12px",
        }}
      >
        <div
          style={{
            ...shimmer,
            height: 14,
            width: index % 2 === 0 ? "75%" : "60%",
          }}
        />
        <div
          style={{
            ...shimmer,
            height: 24,
            width: 64,
            borderRadius: 10,
            flexShrink: 0,
            marginLeft: 12,
          }}
        />
      </div>

      {/* Platform blocks — 2 columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          padding: "0 16px",
        }}
      >
        {[0, 1].map((j) => (
          <div
            key={j}
            style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.04)",
              background: "rgba(255,255,255,0.02)",
              padding: 12,
              display: "flex",
              flexDirection: "column" as const,
              gap: 8,
            }}
          >
            <div style={{ ...shimmer, height: 10, width: 72 }} />
            <div style={{ ...shimmer, height: 10, width: 48 }} />
            <div style={{ ...shimmer, height: 20, width: 56 }} />
            <div style={{ ...shimmer, height: 10, width: 60, marginTop: 4 }} />
          </div>
        ))}
      </div>

      {/* CTA placeholder */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ ...shimmer, height: 36, borderRadius: 10, width: "100%" }} />
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(39,39,42,0.5)",
          background: "rgba(39,39,42,0.2)",
          padding: "10px 16px",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...shimmer, height: 10, width: 40 }} />
          <div style={{ ...shimmer, height: 10, width: 50 }} />
        </div>
        <div style={{ ...shimmer, height: 10, width: 56 }} />
      </div>
    </div>
  );
}

/**
 * Minimal loading fallback that mirrors the MatchesPage hero area layout.
 * Constrains the background image to the hero section height to avoid a
 * full-screen flash → hero-only jump on hydration.
 */
export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {/* Hero placeholder — same structure as MatchesPage hero */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid rgba(39,39,42,0.5)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            overflow: "hidden",
          }}
        >
          <img
            src="/matches-bg-wide.png"
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center center",
              opacity: 0.3,
              mixBlendMode: "lighten",
              maskImage:
                "linear-gradient(to bottom, black 50%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 50%, transparent 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.025,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgb(255 255 255) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>
        {/* Reserve the same height as the hero content area */}
        <div style={{ position: "relative", zIndex: 1, padding: "52px 32px 44px", maxWidth: 1152, margin: "0 auto" }}>
          <div style={{ height: 180 }} />
        </div>
      </div>
    </div>
  );
}

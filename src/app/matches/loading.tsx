/**
 * Minimal loading fallback that matches the MatchesPage container layout.
 * The actual component handles its own skeleton states (hero, stat cards, card list),
 * so this only provides the matching background to avoid a visual "jump" during
 * the SSR → client hydration transition.
 */
export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
      }}
    >
      <img
        src="/matches-bg.webp"
        alt=""
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.18,
        }}
      />
    </div>
  );
}

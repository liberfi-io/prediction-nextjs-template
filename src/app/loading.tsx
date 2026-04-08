"use client";

import { EventsPageSkeleton } from "@liberfi.io/ui-predict";

export default function Loading() {
  return (
    <div className="relative min-h-screen w-full">
      {/* Hero background — matches the actual EventsPage hero bg layer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 280,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
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
      </div>
      <div className="relative z-[1]">
        <EventsPageSkeleton />
      </div>
    </div>
  );
}

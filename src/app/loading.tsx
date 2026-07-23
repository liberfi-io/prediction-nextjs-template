"use client";

import { usePathname } from "next/navigation";
import { NavigationPendingFallback } from "../components/NavigationPendingFallback";

export default function Loading() {
  return <NavigationPendingFallback pathname={usePathname()} />;
}

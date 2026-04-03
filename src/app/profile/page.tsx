import { redirect } from "next/navigation";

/** Legacy URL — canonical portfolio lives at `/portfolio` (Matchr-style). */
export default function Page() {
  redirect("/portfolio");
}

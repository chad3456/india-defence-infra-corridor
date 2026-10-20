import type { ReactNode } from "react";
import { StoryShell } from "@/components/stories/StoryShell";

/** The dashboards sit in the story register, so it mounts the shell itself. */
export default function InstagramPoliticsLayout({ children }: { children: ReactNode }) {
  return <StoryShell back={{ href: "/", label: "Home" }}>{children}</StoryShell>;
}

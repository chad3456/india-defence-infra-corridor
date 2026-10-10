import type { ReactNode } from "react";
import { StoryShell } from "@/components/stories/StoryShell";

/** In the story register but not under `/stories`, so it mounts the shell itself. */
export default function ProtestsLayout({ children }: { children: ReactNode }) {
  return <StoryShell back={{ href: "/tracker", label: "News tracker" }}>{children}</StoryShell>;
}

import type { ReactNode } from "react";
import { StoryShell } from "@/components/stories/StoryShell";

/**
 * This page is in the story register but not under `/stories`, so it mounts
 * the shell itself. Without it the register's tone variables are undefined and
 * every sparkline loses its line — see StoryShell for what that looked like.
 */
export default function GrowthLayout({ children }: { children: ReactNode }) {
  return <StoryShell back={{ href: "/world", label: "The world tracker" }}>{children}</StoryShell>;
}

import type { ReactNode } from "react";
import { StoryShell } from "@/components/stories/StoryShell";

/**
 * In the story register but not under `/stories`, so it mounts the shell
 * itself; without it the register's tone variables are undefined.
 */
export default function SatellitesLayout({ children }: { children: ReactNode }) {
  return <StoryShell back={{ href: "/stories", label: "Visual stories" }}>{children}</StoryShell>;
}

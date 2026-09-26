import type { ReactNode } from "react";
import { StoryShell } from "@/components/stories/StoryShell";

/** In the story register but outside `/stories`, so it mounts the shell itself. */
export default function ProjectMavenLayout({ children }: { children: ReactNode }) {
  return <StoryShell back={{ href: "/stories", label: "All stories" }}>{children}</StoryShell>;
}

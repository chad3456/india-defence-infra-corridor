import type { ReactNode } from "react";
import { StoryShell } from "@/components/stories/StoryShell";

/** The page sits in the story register, so it mounts the shell itself. */
export default function SpaceProgrammeLayout({ children }: { children: ReactNode }) {
  return <StoryShell back={{ href: "/", label: "Home" }}>{children}</StoryShell>;
}

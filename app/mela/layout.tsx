import type { ReactNode } from "react";
import { StoryShell } from "@/components/stories/StoryShell";

/**
 * In the story register but outside `/stories`, so it mounts the shell itself.
 * Without it the register's tone variables are undefined, every stroke
 * resolves to `none` and every fill to black — see StoryShell.
 */
export default function MelaLayout({ children }: { children: ReactNode }) {
  return <StoryShell back={{ href: "/stories", label: "Visual stories" }}>{children}</StoryShell>;
}

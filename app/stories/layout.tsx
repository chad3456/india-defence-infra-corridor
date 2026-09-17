import type { ReactNode } from "react";
import { StoryShell } from "@/components/stories/StoryShell";

export default function StoriesLayout({ children }: { children: ReactNode }) {
  return <StoryShell back={{ href: "/stories", label: "Visual stories" }}>{children}</StoryShell>;
}

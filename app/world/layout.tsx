import type { ReactNode } from "react";
import { StoryShell } from "@/components/stories/StoryShell";

export default function WorldLayout({ children }: { children: ReactNode }) {
  return <StoryShell back={{ href: "/growth-100", label: "India, indicator by indicator" }}>{children}</StoryShell>;
}

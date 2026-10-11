import { ElectionsTabs } from "@/components/elections/Dashboards";

/** Every page under /elections carries the section's own tab strip. */
export default function ElectionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ElectionsTabs />
      {children}
    </>
  );
}

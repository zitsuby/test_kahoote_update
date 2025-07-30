"use client";

import { PageTransition } from "@/components/ui/page-transition";
import { usePathname } from "next/navigation";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <PageTransition
      key={pathname}
      animation="slideUp"
      duration={0.5}
      showLoading={true}
      loadingVariant="minimal"
      loadingDuration={1000}
    >
      {children}
    </PageTransition>
  );
}
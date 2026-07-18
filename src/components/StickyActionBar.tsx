import { ReactNode } from "react";

export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky-action">
      <div className="sticky-action-inner">{children}</div>
    </div>
  );
}

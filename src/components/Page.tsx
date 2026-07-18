import { ReactNode } from "react";

export function Page({
  children,
}: {
  children: ReactNode;
  withActionBar?: boolean;
}) {
  return <div className="page">{children}</div>;
}

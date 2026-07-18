import { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  children,
  noPadding,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  noPadding?: boolean;
}) {
  return (
    <section className="surface-card">
      {title ? (
        <div className="surface-card__header">
          <p className="section-label">{title}</p>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      ) : null}
      <div className={noPadding ? undefined : "surface-card__body"}>{children}</div>
    </section>
  );
}

import { LegalSection } from "@/src/content/legal";

export function LegalDoc({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <article className="legal-doc">
      <h1>{title}</h1>
      <p className="legal-updated">Last updated {updated}</p>
      {sections.map((section) => (
        <section key={section.heading} className="legal-section">
          <h2>{section.heading}</h2>
          {section.body.length === 1 ? (
            <p>{section.body[0]}</p>
          ) : (
            <ul>
              {section.body.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}

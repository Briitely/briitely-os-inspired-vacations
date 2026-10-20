import type { ReactNode } from "react";
import { orDash } from "@/lib/format/empty";

/**
 * Briitely OS standard section: a card split in two.
 *
 * Left: eyebrow, heading, a short description and the section's action
 * (usually an Edit button). Right: the information, or the edit form while
 * editing. Use this for every settings, profile and record page so they all
 * look like one system. Styles live in src/styles/briitely-os.css.
 *
 *   <WorkspaceSection eyebrow="Business" title="Business Identity"
 *     description="Your company contact and mailing information."
 *     action={<Button variant="outline">Edit Business Identity</Button>}>
 *     <DetailGroup label="Business & Address">
 *       <DetailItem label="Business Name" value={business.businessName} />
 *     </DetailGroup>
 *   </WorkspaceSection>
 */
export function WorkspaceSection({ eyebrow, title, description, action, children, className }: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={["os-section", className].filter(Boolean).join(" ")}>
      <div className="os-section-grid">
        <SectionIntro eyebrow={eyebrow} title={title} description={description} action={action} />
        <div className="os-section-body">{children}</div>
      </div>
    </section>
  );
}

/** The left column of a WorkspaceSection, for layouts that build the card themselves. */
export function SectionIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="os-section-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-heading mt-1">{title}</h2>
      {description ? <p className="os-section-description">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** A labelled group of details (the label has a rule under it), laid out in columns. */
export function DetailGroup({ label, children, columns }: { label?: string; children: ReactNode; columns?: 2 | 3 | 4 }) {
  const cols = columns === 2 ? "lg:grid-cols-2" : columns === 4 ? "lg:grid-cols-4" : "";
  return (
    <div>
      {label ? <p className="os-detail-group-label">{label}</p> : null}
      <div className={["os-detail-grid", cols].filter(Boolean).join(" ")}>{children}</div>
    </div>
  );
}

/** One label-over-value detail. Missing values show a dash. */
export function DetailItem({ label, value, children }: { label: string; value?: string | number | null; children?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="detail-label">{label}</p>
      {children ?? <p className="os-detail-value">{orDash(value)}</p>}
    </div>
  );
}

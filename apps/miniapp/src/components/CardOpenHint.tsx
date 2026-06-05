import { Icon } from "./crm";

export function CardOpenHint() {
  return (
    <Icon
      className="crm-card-open-hint"
      stroke="rgba(255,255,255,0.62)"
      fill="none"
      width="24"
      height="24"
      aria-hidden
    >
      <path d="M10 8l4 4-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

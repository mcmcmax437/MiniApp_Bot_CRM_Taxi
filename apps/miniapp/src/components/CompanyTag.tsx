import { RENTAL_COMPANIES, type RentalCompany } from "@taxi/shared";

export function CompanyTag(props: { company: RentalCompany }) {
  return (
    <span className={`crm-company-tag crm-company-tag--${props.company}`}>{props.company}</span>
  );
}

export function CompanyPick(props: {
  value: RentalCompany | "";
  onChange: (value: RentalCompany) => void;
  label: string;
}) {
  return (
    <div className="crm-company-pick" role="group" aria-label={props.label}>
      {RENTAL_COMPANIES.map((id) => (
        <button
          key={id}
          type="button"
          className={`crm-company-pick__btn${props.value === id ? ` crm-company-pick__btn--on crm-company-pick__btn--${id}` : ""}`}
          aria-pressed={props.value === id}
          onClick={() => props.onChange(id)}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

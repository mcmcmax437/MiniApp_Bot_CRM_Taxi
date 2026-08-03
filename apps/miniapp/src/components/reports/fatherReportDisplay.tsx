import { formatMoney } from "../ui";

/** One amount only: selected Max+Oleh totals should not expose payment/payer splits. */
export function SingleTotalBlock(props: { title: string; amount: number }) {
  return (
    <div className="crm-father-report__table-block">
      <div className="crm-father-report__table-title">{props.title}</div>
      <div className="crm-father-report__single-total">{formatMoney(props.amount)}</div>
    </div>
  );
}

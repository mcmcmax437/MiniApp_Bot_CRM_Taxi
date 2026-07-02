import { useTranslation } from "react-i18next";
import { TextInput } from "../ui";

export function ExpenseTagInput(props: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  hint?: string;
  listId?: string;
  showHint?: boolean;
}) {
  const { t } = useTranslation();
  const listId = props.listId ?? "expense-tag-suggestions";

  return (
    <div className="crm-expense-tag-field">
      <TextInput
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder ?? t("finance.expenseTagPlaceholder")}
        list={listId}
      />
      <datalist id={listId}>
        {props.suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      {props.suggestions.length > 0 ? (
        <div className="crm-tag-chips">
          {props.suggestions.slice(0, 10).map((tag) => (
            <button
              key={tag}
              type="button"
              className={`crm-tag-chip${props.value.trim() === tag ? " crm-tag-chip--active" : ""}`}
              onClick={() => props.onChange(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
      {props.showHint !== false ? (
        <p className="crm-form-hint">{props.hint ?? t("finance.expenseTagHint")}</p>
      ) : null}
    </div>
  );
}

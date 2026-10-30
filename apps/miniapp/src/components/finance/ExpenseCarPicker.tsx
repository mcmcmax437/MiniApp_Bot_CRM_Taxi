export function ExpenseCarPicker({
  cars,
  selected,
  onChange,
  splitHint,
  emptyHint,
}: {
  cars: { id: string; plate: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  splitHint?: string;
  emptyHint?: string;
}) {
  return (
    <>
      <div className="crm-expense-cars" role="group">
        {cars.map((car) => {
          const on = selected.includes(car.id);
          return (
            <label
              key={car.id}
              className={`crm-expense-cars__item${on ? " crm-expense-cars__item--on" : ""}`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  onChange(on ? selected.filter((id) => id !== car.id) : [...selected, car.id])
                }
              />
              <span>{car.plate}</span>
            </label>
          );
        })}
      </div>
      {selected.length === 0 && emptyHint ? <p className="crm-form-hint">{emptyHint}</p> : null}
      {selected.length > 1 && splitHint ? <p className="crm-form-hint">{splitHint}</p> : null}
    </>
  );
}

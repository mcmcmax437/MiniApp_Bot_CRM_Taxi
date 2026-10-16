export type AssignFormField = "driver" | "car" | "rentAmount" | "startDate";

export type AssignFormValidationState = {
  useTemporaryDriver: boolean;
  driverId: string;
  temporaryDriverName: string;
  carId: string;
  rentAmount: number | "";
  startDate: string;
};

export type EditFormField = "driver" | "rentAmount" | "startDate";

export type EditFormValidationState = {
  useTemporaryDriver: boolean;
  driverId: string;
  temporaryDriverName: string;
  rentAmount: number | "";
  startDate: string;
};

export function collectAssignFormErrors(
  form: AssignFormValidationState,
): Set<AssignFormField> {
  const errors = new Set<AssignFormField>();
  const hasDriver = !form.useTemporaryDriver && Boolean(form.driverId);
  const hasTemp = form.useTemporaryDriver && Boolean(form.temporaryDriverName.trim());
  if (!hasDriver && !hasTemp) errors.add("driver");
  if (!form.carId) errors.add("car");
  if (form.rentAmount === "") errors.add("rentAmount");
  if (!form.startDate.trim()) errors.add("startDate");
  return errors;
}

export function clearAssignErrorsForPatch(
  errors: ReadonlySet<AssignFormField>,
  patch: Partial<AssignFormValidationState>,
): Set<AssignFormField> {
  const next = new Set(errors);
  if (
    "useTemporaryDriver" in patch ||
    "driverId" in patch ||
    "temporaryDriverName" in patch
  ) {
    next.delete("driver");
  }
  if ("carId" in patch) next.delete("car");
  if ("rentAmount" in patch) next.delete("rentAmount");
  if ("startDate" in patch) next.delete("startDate");
  return next;
}

export function collectEditFormErrors(form: EditFormValidationState): Set<EditFormField> {
  const errors = new Set<EditFormField>();
  const hasDriver = !form.useTemporaryDriver && Boolean(form.driverId);
  const hasTemp = form.useTemporaryDriver && Boolean(form.temporaryDriverName.trim());
  if (!hasDriver && !hasTemp) errors.add("driver");
  if (form.rentAmount === "") errors.add("rentAmount");
  if (!form.startDate) errors.add("startDate");
  return errors;
}

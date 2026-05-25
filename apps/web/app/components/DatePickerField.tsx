"use client";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./DatePickerField.css";

export function dateInputValue(
  value: string | number | Date | null | undefined,
): string {
  if (value == null) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  if (typeof value === "number" || value instanceof Date) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return "";
}

export function formatDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  id?: string;
  name?: string;
};

export default function DatePickerField({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder = "Select date",
  "aria-label": ariaLabel,
  id,
  name,
}: DatePickerFieldProps) {
  const raw = dateInputValue(value) || "";
  const selected = raw ? new Date(`${raw}T12:00:00`) : null;

  return (
    <DatePicker
      id={id}
      name={name}
      selected={selected}
      onChange={(date) => onChange(date ? formatDateValue(date) : "")}
      onBlur={onBlur}
      dateFormat="yyyy-MM-dd"
      placeholderText={placeholder}
      className="crewlink-datepicker-input"
      aria-label={ariaLabel ?? placeholder}
      disabled={disabled}
      popperPlacement="bottom-start"
      portalId="crewlink-datepicker-portal"
    />
  );
}

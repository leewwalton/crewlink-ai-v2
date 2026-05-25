"use client";

import { useEffect, useRef, useState } from "react";
import { useIcaoLookup } from "../hooks/useIcaoLookup";
import {
  aircraftCode,
  aircraftLabel,
  airportCode,
  airportLabel,
  type IcaoAircraftItem,
  type IcaoAirportItem,
} from "../utils/icao-lookup";
import "./IcaoLookupField.css";

type IcaoLookupFieldProps = {
  kind: "airport" | "aircraft";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  "aria-label"?: string;
};

export default function IcaoLookupField({
  kind,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  name,
  id,
  "aria-label": ariaLabel,
}: IcaoLookupFieldProps) {
  const { searchAirports, searchAircraft } = useIcaoLookup();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<IcaoAirportItem | IcaoAircraftItem>
  >([]);

  const search = kind === "airport" ? searchAirports : searchAircraft;

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function updateSuggestions(query: string) {
    const next = search(query);
    setSuggestions(next);
    setOpen(next.length > 0);
  }

  return (
    <div className="icao-lookup-wrap" ref={wrapRef}>
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          updateSuggestions(event.target.value);
        }}
        onFocus={() => {
          const query = value.trim();
          if (!query) {
            setOpen(false);
            return;
          }
          updateSuggestions(query);
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="icao-lookup-suggestions" role="listbox">
          {suggestions.map((item) => {
            const code =
              kind === "airport"
                ? airportCode(item as IcaoAirportItem)
                : aircraftCode(item as IcaoAircraftItem);
            const label =
              kind === "airport"
                ? airportLabel(item as IcaoAirportItem)
                : aircraftLabel(item as IcaoAircraftItem);

            return (
              <li
                key={item.id}
                role="option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(code);
                  setOpen(false);
                }}
              >
                <strong>{code}</strong>
                {label ? ` — ${label}` : ""}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

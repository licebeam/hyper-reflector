import { useEffect, useMemo, useRef, useState } from "react";
import { CountryFlag } from "./CountryFlag";
import rawCountries from "flag-icons/country.json";

type Country = { code: string; name: string };

const COUNTRIES: Country[] = (
  rawCountries as Array<{ code: string; name: string; iso: boolean }>
)
  .filter((c) => c.iso)
  .map((c) => ({ code: c.code.toUpperCase(), name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

type CountryPickerProps = {
  value: string | null;
  onChange: (code: string) => void;
  onClear: () => void;
  placeholder?: string;
};

export function CountryPicker({
  value,
  onChange,
  onClear,
  placeholder = "Type country…",
}: CountryPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCountry = useMemo(
    () => (value ? COUNTRIES.find((c) => c.code === value.toUpperCase()) ?? null : null),
    [value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, 8);
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().startsWith(q),
    ).slice(0, 8);
  }, [query]);

  useEffect(() => {
    if (value) setQuery("");
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayValue = selectedCountry && !open ? selectedCountry.name : query;

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-1.5 rounded border px-2 py-1 min-w-[148px]"
        style={{ background: "var(--v2-hover)", borderColor: "var(--v2-border)" }}
      >
        {selectedCountry && <CountryFlag code={selectedCountry.code} />}
        <input
          type="text"
          placeholder={placeholder}
          value={displayValue}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => setQuery(e.target.value)}
          className="text-xs outline-none bg-transparent flex-1 min-w-0"
          style={{ color: "var(--v2-text)" }}
        />
        {value && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              setQuery("");
            }}
            className="text-xs leading-none shrink-0"
            style={{ color: "var(--v2-muted)" }}
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-20 rounded border w-52 overflow-hidden"
          style={{
            background: "var(--v2-surface)",
            borderColor: "var(--v2-border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs" style={{ color: "var(--v2-muted)" }}>
                No results
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs"
                  style={{ color: "var(--v2-text)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--v2-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(c.code);
                    setOpen(false);
                  }}
                >
                  <CountryFlag code={c.code} />
                  {c.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

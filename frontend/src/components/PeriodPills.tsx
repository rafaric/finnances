import { formatPeriod, shiftPeriod } from "../lib/periods";

interface PeriodPillsProps {
  value: string;
  onChange: (periodo: string) => void;
  includeAll?: boolean;
}

export function PeriodPills({ value, onChange, includeAll = false }: PeriodPillsProps) {
  const periods = value ? [shiftPeriod(value, -2), shiftPeriod(value, -1), value, shiftPeriod(value, 1)] : [];

  return (
    <div className="period-pills" aria-label="Período">
      {includeAll ? <button className={!value ? "active" : ""} type="button" onClick={() => onChange("")}>Todos</button> : null}
      {periods.map((period) => (
        <button className={period === value ? "active" : ""} key={period} type="button" onClick={() => onChange(period)}>
          {formatPeriod(period)}
        </button>
      ))}
    </div>
  );
}

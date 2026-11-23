import type { PaymentMethod } from "@/types/stylecraft-api";

type PaymentMethodToggleProps = {
  /** Keeps the radio group separate when two forms are on one screen. */
  name: string;
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  label?: string;
};

const options: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "online", label: "Online" },
];

/** Cash in hand or an online transfer. */
export default function PaymentMethodToggle({ name, value, onChange, label = "Received by" }: PaymentMethodToggleProps) {
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">{label}</legend>
      <div className="flex gap-2">
        {options.map((option) => (
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
              value === option.value
                ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
                : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            }`}
            key={option.value}
          >
            <input
              checked={value === option.value}
              className="sr-only"
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

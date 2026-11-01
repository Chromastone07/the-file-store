"use client";

import { useState } from "react";
import { Users, Flame, Infinity as InfinityIcon } from "lucide-react";

interface RecipientLimitSelectorProps {
  value: number | null; // null = unlimited
  onChange: (limit: number | null) => void;
}

export default function RecipientLimitSelector({
  value,
  onChange,
}: RecipientLimitSelectorProps) {
  const [isCustom, setIsCustom] = useState(
    value !== null && ![1, 2, 3, 5].includes(value)
  );
  const [customValue, setCustomValue] = useState<number | string>(
    value && ![1, 2, 3, 5].includes(value) ? value : 10
  );

  const presets: { label: string; val: number | null; sub?: string }[] = [
    { label: "1 (Burn)", val: 1, sub: "Self-destruct" },
    { label: "2", val: 2, sub: "2 scans" },
    { label: "3", val: 3, sub: "3 scans" },
    { label: "5", val: 5, sub: "5 scans" },
    { label: "Unlimited", val: null, sub: "Timer only" },
  ];

  const handlePresetSelect = (presetVal: number | null) => {
    setIsCustom(false);
    onChange(presetVal);
  };

  const handleCustomToggle = () => {
    setIsCustom(true);
    const parsed = typeof customValue === 'number' ? customValue : parseInt(String(customValue), 10);
    const safeVal = !isNaN(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 10;
    onChange(safeVal);
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCustomValue(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      onChange(Math.min(parsed, 1000));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-[var(--wisp-muted)] font-medium">
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>Recipient Limit (Scans Allowed)</span>
        </span>
        <span className="font-mono text-[11px] text-[var(--wisp-text)]">
          {value === null 
            ? "Unlimited recipients" 
            : value === 1 
              ? "1 recipient (Burn on view)" 
              : `${value} recipients max`}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {presets.map((preset) => {
          const isSelected = !isCustom && value === preset.val;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetSelect(preset.val)}
              className={`py-1.5 px-1 rounded-xl text-xs font-mono font-medium border transition-all flex flex-col items-center justify-center cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.35)] scale-[1.02]"
                  : "bg-[var(--wisp-surface-glass)] border-[var(--wisp-border)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)]"
              }`}
              title={preset.sub}
            >
              <span className="text-[11px] font-bold truncate max-w-full">
                {preset.val === 1 ? (
                  <span className="flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5 text-amber-300" /> 1
                  </span>
                ) : preset.val === null ? (
                  <InfinityIcon className="w-3 h-3" />
                ) : (
                  preset.label
                )}
              </span>
              <span className="text-[9px] opacity-75 font-sans leading-none mt-0.5 hidden sm:block">
                {preset.sub}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleCustomToggle}
          className={`py-1.5 px-1 rounded-xl text-xs font-medium border transition-all flex flex-col items-center justify-center cursor-pointer ${
            isCustom
              ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.35)] scale-[1.02]"
              : "bg-[var(--wisp-surface-glass)] border-[var(--wisp-border)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)]"
          }`}
        >
          <span className="text-[11px] font-bold">Custom</span>
          <span className="text-[9px] opacity-75 font-sans leading-none mt-0.5 hidden sm:block">
            Specify
          </span>
        </button>
      </div>

      {isCustom && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="number"
            min={1}
            max={1000}
            value={customValue}
            onChange={handleCustomInputChange}
            className="w-24 bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] rounded-lg px-2.5 py-1 text-xs font-mono text-[var(--wisp-text)] focus:outline-none focus:border-indigo-400"
            placeholder="10"
          />
          <span className="text-[11px] text-[var(--wisp-muted)]">
            total people / devices permitted to scan and open
          </span>
        </div>
      )}
    </div>
  );
}


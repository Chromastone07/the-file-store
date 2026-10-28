"use client";

import { useState } from "react";
import { WISP_CONFIG, ExpiryPreset } from "@/lib/config";
import { Clock } from "lucide-react";

export interface ExpirySelection {
  totalSeconds: number;
  label: string;
}

interface ExpiryControlProps {
  valueSeconds: number;
  onChange: (selection: ExpirySelection) => void;
  className?: string;
  minSeconds?: number;
  maxSeconds?: number;
}

export default function ExpiryControl({
  valueSeconds,
  onChange,
  className = "",
  minSeconds = 30,
  maxSeconds = 7 * 24 * 3600,
}: ExpiryControlProps) {
  const presets = WISP_CONFIG.EXPIRY_PRESETS;
  
  // Find matching preset or default to custom
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string>(() => {
    const match = presets.find(p => p.value * 60 === valueSeconds);
    return match ? match.label : "Custom";
  });

  const [customValue, setCustomValue] = useState<number>(() => {
    return Math.max(1, Math.round(valueSeconds / 60));
  });
  const [customUnit, setCustomUnit] = useState<"seconds" | "minutes" | "hours" | "days">("minutes");

  const isCustom = selectedPresetLabel === "Custom";

  const handlePresetClick = (preset: ExpiryPreset) => {
    setSelectedPresetLabel(preset.label);
    const totalSec = preset.value * 60;
    onChange({ totalSeconds: totalSec, label: preset.label });
  };

  const handleCustomChange = (val: number, unit: "seconds" | "minutes" | "hours" | "days") => {
    const clampedVal = Math.max(1, isNaN(val) ? 1 : val);
    setCustomValue(clampedVal);
    setCustomUnit(unit);

    const multiplier = 
      unit === "seconds" ? 1 :
      unit === "minutes" ? 60 :
      unit === "hours" ? 3600 : 86400;

    let total = clampedVal * multiplier;
    total = Math.max(minSeconds, Math.min(total, maxSeconds));

    onChange({
      totalSeconds: total,
      label: `${clampedVal} ${unit}`,
    });
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between text-xs text-[var(--wisp-muted)] font-medium">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[var(--wisp-glow)]" /> Expiry Time
        </span>
        <span className="font-mono text-[11px] text-[var(--wisp-text)]">
          {isCustom ? `${customValue} ${customUnit}` : selectedPresetLabel}
        </span>
      </div>

      {/* Preset Pills */}
      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
        {presets.slice(0, 7).map((preset) => {
          const isSelected = !isCustom && selectedPresetLabel === preset.label;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={`h-8 leading-none flex items-center justify-center text-center px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.45)] border border-indigo-400/50 font-semibold scale-[1.02]"
                  : "bg-[var(--wisp-surface-glass)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] backdrop-blur-sm"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setSelectedPresetLabel("Custom");
            handleCustomChange(customValue, customUnit);
          }}
          className={`h-8 leading-none flex items-center justify-center text-center px-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            isCustom
              ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.45)] border border-indigo-400/50 font-semibold scale-[1.02]"
              : "bg-[var(--wisp-surface-glass)] text-[var(--wisp-muted)] hover:text-[var(--wisp-text)] hover:bg-[var(--wisp-elevated)] border border-[var(--wisp-border)] backdrop-blur-sm"
          }`}
        >
          Custom
        </button>
      </div>

      {/* Custom Inputs */}
      {isCustom && (
        <div className="flex items-center gap-2 mt-1 p-2 rounded-lg bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] text-xs backdrop-blur-md">
          <span className="text-[var(--wisp-muted)] whitespace-nowrap">Keep alive for:</span>
          <input
            type="number"
            min={1}
            max={9999}
            value={customValue}
            onChange={(e) => handleCustomChange(parseInt(e.target.value, 10), customUnit)}
            className="w-16 px-2 py-1 rounded bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] text-center text-[var(--wisp-text)] font-mono outline-none focus:border-indigo-400"
          />
          <select
            value={customUnit}
            onChange={(e) => handleCustomChange(customValue, e.target.value as "seconds" | "minutes" | "hours" | "days")}
            className="px-2 py-1 rounded bg-[var(--wisp-surface-glass)] border border-[var(--wisp-border)] text-[var(--wisp-text)] outline-none focus:border-indigo-400"
          >
            <option value="seconds" className="bg-[var(--wisp-bg)] text-[var(--wisp-text)]">seconds</option>
            <option value="minutes" className="bg-[var(--wisp-bg)] text-[var(--wisp-text)]">minutes</option>
            <option value="hours" className="bg-[var(--wisp-bg)] text-[var(--wisp-text)]">hours</option>
            <option value="days" className="bg-[var(--wisp-bg)] text-[var(--wisp-text)]">days</option>
          </select>
        </div>
      )}
    </div>
  );
}

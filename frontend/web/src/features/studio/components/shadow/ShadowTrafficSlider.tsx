"use client"

import React from "react"

interface ShadowTrafficSliderProps {
  value: number
  onChange: (val: number) => void
}

export function ShadowTrafficSlider({ value, onChange }: ShadowTrafficSliderProps) {
  return (
    <div className="border border-zinc-800/60 bg-zinc-900/20 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Shadow Traffic %</h3>
        <span className="text-sm font-semibold text-blue-400">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>Off</span>
        <span>1%</span>
        <span>5%</span>
        <span>10%</span>
      </div>
    </div>
  )
}

"use client"

import React, { useState } from "react"
import { Upload, FileDown, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { TestCase } from "../../types"

interface DatasetUploaderProps {
  onUpload: (testCases: TestCase[]) => void
  isUploading: boolean
}

export function DatasetUploader({ onUpload, isUploading }: DatasetUploaderProps) {
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    const text = await file.text()
    const lines = text.trim().split("\n")
    if (lines.length < 2) {
      setError("CSV must have a header row and at least one data row")
      return
    }

    const header = lines[0].split(",").map(h => h.trim().toLowerCase())
    const inputIdx = header.findIndex(h => h === "input")
    const expectedIdx = header.findIndex(h => h === "expected_output")

    if (inputIdx === -1 || expectedIdx === -1) {
      setError("CSV must have columns: input, expected_output")
      return
    }

    const cases: TestCase[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim())
      if (cols[inputIdx] || cols[expectedIdx]) {
        cases.push({ input: cols[inputIdx] || "", expected_output: cols[expectedIdx] || "" })
      }
    }

    if (cases.length === 0) {
      setError("No valid test cases found in CSV")
      return
    }

    onUpload(cases)
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        className="border-2 border-dashed border-zinc-800/80 rounded-2xl p-6 text-center hover:border-blue-500/30 transition-colors cursor-pointer"
      >
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
          className="hidden"
          id="csv-upload"
        />
        <label htmlFor="csv-upload" className="cursor-pointer space-y-2 block">
          <Upload className="h-6 w-6 text-zinc-500 mx-auto" />
          <div className="text-sm text-zinc-400">
            Drop a CSV file here or <span className="text-blue-400">browse</span>
          </div>
          <div className="text-xs text-zinc-600">
            Must have columns: input, expected_output
          </div>
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <a
        href="/studio/evals/dataset-template.csv"
        download
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <FileDown className="h-3.5 w-3.5" /> Download template CSV
      </a>
    </div>
  )
}

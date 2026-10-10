import { useState } from "react"
import PosterToEvent from "./PosterToEvent"
import type { ExtractPoster, SaveEventDraft } from "./types"

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export function PosterToEventDemo({ onBack }: { onBack?: () => void }) {
  const [simulateFailure, setSimulateFailure] = useState(false)

  const simulatedExtraction: ExtractPoster = async () => {
    await wait(1200)
    if (simulateFailure) {
      throw new Error(
        "Simulated extraction failure. Retry or continue with manual entry.",
      )
    }

    return {
      values: {
        title: "Build Night",
        description:
          "A beginner-friendly session for students to form teams and build a small web project.",
        category: "Technical",
        startDate: "2026-10-18",
        startTime: "16:00",
        endDate: "2026-10-18",
        endTime: "18:00",
        eligibility: "Open to all students",
        registrationDeadline: "2026-10-17T18:00",
        registrationUrl: "https://example.com/build-night",
      },
      extractedFields: [
        "title",
        "description",
        "category",
        "startDate",
        "startTime",
        "endDate",
        "endTime",
        "eligibility",
        "registrationDeadline",
        "registrationUrl",
      ],
    }
  }

  const simulatedSave: SaveEventDraft = async () => {
    await wait(700)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-[#DCC7EA] bg-[#F5EDFB] px-5 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="mb-3 min-h-11 text-sm font-bold text-[#111111] underline decoration-[#B99BCB] underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#111111]"
              >
                ← Back to UniFlow
              </button>
            )}
            <p className="text-sm font-black text-[#3D2750]">
              Demo: simulated extraction
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6A477E]">
              Runs locally with example data. No poster is sent to an API.
            </p>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-[#3D2750]">
            <input
              type="checkbox"
              checked={simulateFailure}
              onChange={(event) => setSimulateFailure(event.target.checked)}
              className="size-4 accent-[#111111]"
            />
            Simulate extraction failure
          </label>
        </div>
      </div>
      <PosterToEvent
        extractPoster={simulatedExtraction}
        saveDraft={simulatedSave}
        savedMessage="Demo draft saved"
      />
    </div>
  )
}

export default PosterToEventDemo

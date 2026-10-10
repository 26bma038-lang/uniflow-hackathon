export type EventDraft = {
  title: string
  description: string
  category: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  timezone: string
  venue: string
  eligibility: string
  registrationDeadline: string
  registrationUrl: string
}

export type EventDraftField = keyof EventDraft

export type ExtractionResult = {
  values: Partial<EventDraft>
  extractedFields: EventDraftField[]
}

export type ExtractPoster = (file: File) => Promise<ExtractionResult>

export type SaveEventDraft = (draft: EventDraft) => Promise<void>

export type PosterToEventProps = {
  extractPoster: ExtractPoster
  saveDraft: SaveEventDraft
  initialDraft?: Partial<EventDraft>
  savedMessage?: string
  className?: string
}

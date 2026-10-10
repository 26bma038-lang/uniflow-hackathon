import { POSTER_MAX_BYTES } from "../contracts"
import type { AiErrorCode } from "../contracts"

// What a person sees for each failure. `retry` is true only when asking again could work
// without them changing anything first.
export type AiErrorCopy = { title: string; body: string; retry: boolean; signIn?: boolean }

const maxMegabytes = Math.round(POSTER_MAX_BYTES / (1024 * 1024))

export function extractionErrorCopy(code: AiErrorCode): AiErrorCopy {
  switch (code) {
    case "not_configured":
      return {
        title: "Extraction isn’t switched on yet",
        body: "The AI functions haven’t been deployed for this UniFlow, which is normal on a first run. Nothing was read from the image, and nothing is wrong with your file.",
        retry: false,
      }
    case "not_signed_in":
      return {
        title: "Your session has ended",
        body: "Extraction only runs for a signed-in club member. Sign in again, then try once more.",
        retry: true,
      }
    case "not_a_member":
      return {
        title: "You’re not a member of this club",
        body: "Only a club’s own members can extract details for it. If that looks wrong, ask the UniFlow team to check your club access.",
        retry: false,
      }
    case "invalid_image":
      return {
        title: "That image couldn’t be read",
        body: "Extraction works with PNG, JPEG, or WebP images that open normally. Choose a different file to try again.",
        retry: false,
      }
    case "too_large":
      return {
        title: "That image is too large",
        body: `Extraction accepts images up to ${maxMegabytes} MB. Choose a smaller or more compressed copy to try again.`,
        retry: false,
      }
    case "invalid_request":
      return {
        title: "The request wasn’t accepted",
        body: "The server rejected this request, and sending the same thing again won’t change that.",
        retry: false,
      }
    case "rate_limited":
      return {
        title: "Too many extractions just now",
        body: "There’s a limit on how often extraction can run. Wait a minute, then try again.",
        retry: true,
      }
    case "model_unavailable":
      return {
        title: "The AI model didn’t respond",
        body: "The model failed or took too long. This is usually temporary.",
        retry: true,
      }
    case "bad_output":
      return {
        title: "The model’s answer couldn’t be used",
        body: "It replied, but not in a form that passed UniFlow’s checks, so nothing was suggested. Another attempt can come back differently.",
        retry: true,
      }
    case "network":
      return {
        title: "Couldn’t reach UniFlow",
        body: "The request didn’t get through. Check your connection, then try again.",
        retry: true,
      }
    default:
      return { title: "Extraction didn’t finish", body: "Something went wrong before any details were read.", retry: true }
  }
}

export function discoverErrorCopy(code: AiErrorCode): AiErrorCopy {
  switch (code) {
    case "not_configured":
      return {
        title: "Ask isn’t switched on yet",
        body: "The AI functions haven’t been deployed for this UniFlow, which is normal on a first run. Search and filters still work in the meantime.",
        retry: false,
      }
    case "not_signed_in":
      return {
        title: "Your session has ended",
        body: "Asking a question needs you to be signed in. Sign in again and ask once more.",
        retry: false,
        signIn: true,
      }
    case "invalid_request":
      return {
        title: "That question wasn’t accepted",
        body: "Try rewording it as a short, plain question about campus events, notices, or deadlines.",
        retry: false,
      }
    case "rate_limited":
      return {
        title: "Too many questions just now",
        body: "There’s a limit on how often you can ask. Wait a minute, then try again.",
        retry: true,
      }
    case "model_unavailable":
      return {
        title: "The AI model didn’t respond",
        body: "The model failed or took too long. This is usually temporary.",
        retry: true,
      }
    case "bad_output":
      return {
        title: "The model’s answer couldn’t be used",
        body: "It replied, but not in a form that passed UniFlow’s checks, so nothing is shown. Asking again can come back differently.",
        retry: true,
      }
    case "network":
      return {
        title: "Couldn’t reach UniFlow",
        body: "The question didn’t get through. Check your connection, then try again.",
        retry: true,
      }
    case "not_a_member":
    case "invalid_image":
    case "too_large":
    default:
      return { title: "That question couldn’t be answered", body: "Something went wrong before an answer came back.", retry: true }
  }
}

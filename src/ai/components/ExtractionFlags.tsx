import { ListChecks } from "lucide-react"
import type { EventDraftField } from "../../components/poster-to-event/types"
import type { ExtractionFlag } from "../contracts"
import { fieldLabel } from "./fields"
import styles from "./ExtractionFlags.module.css"

type ExtractionFlagsProps = {
  flags: ExtractionFlag[]
  fieldLabels?: Partial<Record<EventDraftField, string>>
  // Heading level for the block's title, so it fits the outline of the screen it sits on.
  headingLevel?: 2 | 3 | 4
}

// Fields a person has to look at before the record goes anywhere. Renders nothing when
// there are no flags, so it can be placed unconditionally.
function ExtractionFlags({ flags, fieldLabels, headingLevel = 3 }: ExtractionFlagsProps) {
  if (!flags.length) return null
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4"
  const count = flags.length
  return (
    <section className={styles.flags} aria-label="Fields to check against the source">
      <Heading className={styles.title}>
        <ListChecks size={17} aria-hidden="true" />
        <span>{count === 1 ? "1 field to check against the source" : `${count} fields to check against the source`}</span>
      </Heading>
      <p className={styles.lede}>
        A routine step: links and dates are easy to misread from an image, so UniFlow lists them here along with anything it changed or left out. Compare each with the source and correct it if needed.
      </p>
      <ul className={styles.list}>
        {flags.map((flag, index) => (
          <li key={`${flag.field}-${index}`} className={styles.item}>
            <strong className={styles.field}>{fieldLabel(flag.field, fieldLabels)}</strong>
            <span className={styles.reason}>{flag.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ExtractionFlags

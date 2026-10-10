import type { Assignment, AssignmentInput, AssignmentResult, AssignmentService } from "./contracts"

// Placeholder until the table and queries are wired in. Signatures are final.
const NOT_READY = { ok: false, error: { code: "not_configured", message: "Assignments aren’t connected yet." } } as const

export const assignmentService: AssignmentService = {
  async list(): Promise<AssignmentResult<Assignment[]>> {
    return NOT_READY
  },
  async create(_input: AssignmentInput): Promise<AssignmentResult<Assignment>> {
    return NOT_READY
  },
  async update(_id: string, _patch: Partial<AssignmentInput>): Promise<AssignmentResult<Assignment>> {
    return NOT_READY
  },
  async remove(_id: string): Promise<AssignmentResult<null>> {
    return NOT_READY
  },
}

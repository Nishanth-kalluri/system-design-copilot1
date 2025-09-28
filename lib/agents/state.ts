import { Run, Message } from '../db'
import { Step, RunStatus } from '../db'

export interface AgentState {
  runId: string
  projectId: string
  userId: string
  step: Step
  deepDiveNo: number
  status: RunStatus
  checkpoint: any
}

export async function loadState(runId: string): Promise<AgentState> {
  const run = await Run.findById(runId).populate('projectId')
  if (!run) {
    throw new Error('Run not found')
  }

  return {
    runId: run._id.toString(),
    projectId: run.projectId.toString(),
    userId: run.userId.toString(),
    step: run.step,
    deepDiveNo: run.deepDiveNo,
    status: run.status,
    checkpoint: run.checkpoint || {},
  }
}

export async function saveState(state: AgentState): Promise<void> {
  await Run.findByIdAndUpdate(state.runId, {
    step: state.step,
    deepDiveNo: state.deepDiveNo,
    status: state.status,
    checkpoint: state.checkpoint,
  })
}

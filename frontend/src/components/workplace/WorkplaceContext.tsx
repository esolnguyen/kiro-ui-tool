import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { AdoPbi, AdoPullRequest, AdoConnectionStatus } from '../../api/ado'
import type { Agent, Pipeline, PipelineRun, StageExecution } from '../../types'
import { pipelineRunsApi } from '../../api/pipelines'
import { useAppStore } from '../../stores/appStore'

const WS_BASE = `ws://${window.location.hostname}:${window.location.port || '8000'}`

export type Tab = 'work-items' | 'test-plans' | 'pull-requests'
export type RunMode = 'single' | 'pipeline'

interface WorkplaceContextValue {
  // Tab
  activeTab: Tab
  setActiveTab: (tab: Tab) => void

  // Run config
  runMode: RunMode
  setRunMode: (mode: RunMode) => void
  agentSlug: string
  setAgentSlug: (slug: string) => void
  selectedPipelineId: string | null
  setSelectedPipelineId: (id: string | null) => void

  // Store data
  agents: Agent[]
  pipelines: Pipeline[]

  // Connection
  status: AdoConnectionStatus | null
  setStatus: (s: AdoConnectionStatus | null) => void

  // Modals
  detailPbi: AdoPbi | null
  setDetailPbi: (pbi: AdoPbi | null) => void
  detailPr: AdoPullRequest | null
  setDetailPr: (pr: AdoPullRequest | null) => void

  // Create form
  showCreateForm: boolean
  setShowCreateForm: (show: boolean) => void

  // Terminal
  termReady: boolean
  setTermReady: (ready: boolean) => void
  sendPromptToTerminal: (prompt: string, agentOverride?: string) => void
  setSendFn: (fn: (prompt: string, agentOverride?: string) => void) => void
  isWhipping: boolean

  // Pipeline run
  activePipelineRun: PipelineRun | null
  activePipelineDef: Pipeline | null
  startPipelineRun: (pipelineId: string, input?: Record<string, unknown>) => Promise<void>
  dismissPipelineRun: () => void
  approvePipelineStage: (stageId: string) => Promise<void>
  rejectPipelineStage: (stageId: string) => Promise<void>
  submitPipelineInput: (stageId: string, input: string) => Promise<void>
  retryPipelineStage: (stageId: string) => Promise<void>
}

const WorkplaceContext = createContext<WorkplaceContextValue | null>(null)

export function useWorkplace() {
  const ctx = useContext(WorkplaceContext)
  if (!ctx) throw new Error('useWorkplace must be used within WorkplaceProvider')
  return ctx
}

export function WorkplaceProvider({ children }: { children: ReactNode }) {
  const agents = useAppStore((s) => s.agents)
  const pipelines = useAppStore((s) => s.pipelines)

  const [activeTab, setActiveTab] = useState<Tab>('work-items')
  const [runMode, setRunMode] = useState<RunMode>('single')
  const [agentSlug, setAgentSlug] = useState('')
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [status, setStatus] = useState<AdoConnectionStatus | null>(null)
  const [detailPbi, setDetailPbi] = useState<AdoPbi | null>(null)
  const [detailPr, setDetailPr] = useState<AdoPullRequest | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [termReady, setTermReady] = useState(false)
  const [sendFnRef, setSendFnRef] = useState<{ fn: (prompt: string, agentOverride?: string) => void }>({ fn: () => { } })
  const [isWhipping, setIsWhipping] = useState(false)

  // Pipeline run state
  const [activePipelineRun, setActivePipelineRun] = useState<PipelineRun | null>(null)
  const [activePipelineDef, setActivePipelineDef] = useState<Pipeline | null>(null)
  const pipelineWsRef = useRef<WebSocket | null>(null)

  const setSendFn = useCallback((fn: (prompt: string, agentOverride?: string) => void) => {
    setSendFnRef({ fn })
  }, [])

  const sendPromptToTerminal = useCallback((prompt: string, agentOverride?: string) => {
    sendFnRef.fn(prompt, agentOverride)
    setIsWhipping(true)
    setTimeout(() => setIsWhipping(false), 3000)
  }, [sendFnRef])

  // Connect WebSocket when a pipeline run is active
  useEffect(() => {
    if (!activePipelineRun) return
    const runId = activePipelineRun.id
    const ws = new WebSocket(`${WS_BASE}/ws/pipeline-runs/${runId}`)
    pipelineWsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.run) setActivePipelineRun(msg.run as PipelineRun)
      } catch { /* ignore */ }
    }

    return () => { ws.close() }
  }, [activePipelineRun?.id])

  // Resolve {{path}} placeholders against a nested context object
  // Supports: {{input.pbiId}}, {{stages.implement.output}}, {{pbiId}} (shorthand for input)
  const resolvePrompt = useCallback((template: string, context: Record<string, unknown>): string => {
    return template.replace(/\{\{([\w.]+)\}\}/g, (match, path: string) => {
      // Walk the path against the full context
      let value: unknown = context
      for (const k of path.split('.')) {
        if (value == null || typeof value !== 'object') return match
        value = (value as Record<string, unknown>)[k]
      }
      if (value != null && value !== '') return String(value)
      // Fallback: try under "input" for shorthand like {{pbiId}}
      value = context.input
      for (const k of path.split('.')) {
        if (value == null || typeof value !== 'object') return match
        value = (value as Record<string, unknown>)[k]
      }
      return value != null ? String(value) : match
    })
  }, [])

  // Build the full template context from a pipeline run
  const buildTemplateContext = useCallback((run: PipelineRun, pipelineDef: Pipeline): Record<string, unknown> => {
    const stages: Record<string, Record<string, string>> = {}
    for (const exec of run.stages) {
      stages[exec.id] = {
        status: exec.status,
        output: exec.output || '',
        error: exec.error || '',
      }
    }
    return { input: run.input, stages }
  }, [])

  // Generate a handoff context block for non-first stages
  const buildHandoffContext = useCallback((
    stageIndex: number,
    pipelineDef: Pipeline,
    run: PipelineRun,
  ): string => {
    if (stageIndex === 0) return ''

    const lines: string[] = [
      '',
      '---',
      '## Pipeline Context (previous stages)',
      '',
    ]

    // Work item info
    const inp = run.input
    if (inp.pbiId) {
      lines.push(`**Work Item:** #${inp.pbiId}`)
      if (inp.title) lines.push(`**Title:** ${inp.title}`)
      if (inp.pbiUrl) lines.push(`**URL:** ${inp.pbiUrl}`)
      lines.push('')
    }

    // Previous stages summary
    const previousStages = pipelineDef.stages.slice(0, stageIndex)
    for (const prev of previousStages) {
      const exec = run.stages.find((s) => s.id === prev.id)
      lines.push(`### Stage: ${prev.label || prev.id}`)
      lines.push(`- **Agent:** ${prev.agentSlug}`)
      lines.push(`- **Status:** ${exec?.status || 'unknown'}`)
      if (exec?.output) {
        lines.push(`- **Output:**`)
        lines.push(exec.output)
      }
      if (exec?.error) {
        lines.push(`- **Error:** ${exec.error}`)
      }
      lines.push('')
    }

    // Helpful hints when stage output is missing (terminal-based execution)
    const allOutputEmpty = previousStages.every((prev) => {
      const exec = run.stages.find((s) => s.id === prev.id)
      return !exec?.output
    })
    if (allOutputEmpty) {
      lines.push('> **Note:** Stage outputs were executed via the terminal and are not captured here.')
      lines.push('> Use `git log --oneline -20`, check recent branches, and query Azure DevOps PRs')
      lines.push(`> for work item #${inp.pbiId || 'N/A'} to understand what the previous stage(s) did.`)
      lines.push('')
    }

    return lines.join('\n')
  }, [])

  // Dispatch a stage's prompt to the terminal via /spawn
  const dispatchStageToTerminal = useCallback((stageId: string, pipelineDef: Pipeline, run: PipelineRun) => {
    const stageDef = pipelineDef.stages.find((s) => s.id === stageId)
    if (!stageDef) return

    const context = buildTemplateContext(run, pipelineDef)
    let prompt = resolvePrompt(stageDef.prompt, context)

    // Append handoff context for stages with dependencies
    const stageIndex = pipelineDef.stages.findIndex((s) => s.id === stageId)
    prompt += buildHandoffContext(stageIndex, pipelineDef, run)

    // Use /spawn to run each stage as a parallel session
    const spawnCmd = `/spawn --name ${stageId} ${prompt}`
    sendPromptToTerminal(spawnCmd)
  }, [resolvePrompt, buildTemplateContext, buildHandoffContext, sendPromptToTerminal])

  // Track which stages have already been dispatched to avoid re-sending
  const dispatchedStagesRef = useRef<Set<string>>(new Set())

  const startPipelineRun = useCallback(async (pipelineId: string, input: Record<string, unknown> = {}) => {
    const run = await pipelineRunsApi.start(pipelineId, input)
    const pipelineDef = pipelines.find((p) => p.id === pipelineId) ?? null
    dispatchedStagesRef.current = new Set()
    setActivePipelineRun(run)
    setActivePipelineDef(pipelineDef)

    // Dispatch all running stages (DAG may start multiple in parallel)
    if (pipelineDef) {
      for (const stage of run.stages) {
        if (stage.status === 'running' && !dispatchedStagesRef.current.has(stage.id)) {
          dispatchStageToTerminal(stage.id, pipelineDef, run)
          dispatchedStagesRef.current.add(stage.id)
        }
      }
    }
  }, [pipelines, dispatchStageToTerminal])

  // When the backend advances to new running stages, dispatch them via /spawn
  useEffect(() => {
    if (!activePipelineRun || !activePipelineDef) return
    for (const stage of activePipelineRun.stages) {
      if (stage.status === 'running' && !dispatchedStagesRef.current.has(stage.id)) {
        dispatchStageToTerminal(stage.id, activePipelineDef, activePipelineRun)
        dispatchedStagesRef.current.add(stage.id)
      }
    }
  }, [activePipelineRun, activePipelineDef, dispatchStageToTerminal])

  const dismissPipelineRun = useCallback(() => {
    pipelineWsRef.current?.close()
    setActivePipelineRun(null)
    setActivePipelineDef(null)
    dispatchedStagesRef.current = new Set()
  }, [])

  const approvePipelineStage = useCallback(async (stageId: string) => {
    if (!activePipelineRun) return
    const updated = await pipelineRunsApi.approveStage(activePipelineRun.id, stageId)
    setActivePipelineRun(updated)
  }, [activePipelineRun])

  const rejectPipelineStage = useCallback(async (stageId: string) => {
    if (!activePipelineRun) return
    const updated = await pipelineRunsApi.rejectStage(activePipelineRun.id, stageId)
    setActivePipelineRun(updated)
  }, [activePipelineRun])

  const submitPipelineInput = useCallback(async (stageId: string, input: string) => {
    if (!activePipelineRun) return
    const updated = await pipelineRunsApi.submitInput(activePipelineRun.id, stageId, input)
    setActivePipelineRun(updated)
  }, [activePipelineRun])

  const retryPipelineStage = useCallback(async (stageId: string) => {
    if (!activePipelineRun) return
    const updated = await pipelineRunsApi.retryStage(activePipelineRun.id, stageId)
    setActivePipelineRun(updated)
  }, [activePipelineRun])

  return (
    <WorkplaceContext.Provider value={{
      activeTab, setActiveTab,
      runMode, setRunMode,
      agentSlug, setAgentSlug,
      selectedPipelineId, setSelectedPipelineId,
      agents, pipelines,
      status, setStatus,
      detailPbi, setDetailPbi,
      detailPr, setDetailPr,
      showCreateForm, setShowCreateForm,
      termReady, setTermReady,
      sendPromptToTerminal, setSendFn,
      isWhipping,
      activePipelineRun, activePipelineDef, startPipelineRun, dismissPipelineRun,
      approvePipelineStage, rejectPipelineStage, submitPipelineInput, retryPipelineStage,
    }}>
      {children}
    </WorkplaceContext.Provider>
  )
}

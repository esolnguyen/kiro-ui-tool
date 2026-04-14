import { useState, useMemo } from 'react'
import {
  CheckCircle, XCircle, Loader, Clock, MessageSquare,
  ThumbsUp, ThumbsDown, RefreshCw, X, Send,
  ChevronDown, ChevronRight, GitBranch,
} from 'lucide-react'
import { useWorkplace } from './WorkplaceContext'
import type { StageExecution, PipelineStage } from '../../types'
import styles from './workplace.module.scss'

function statusIcon(status: StageExecution['status'], size = 12) {
  switch (status) {
    case 'running': return <Loader size={size} className={styles.spin} />
    case 'completed': return <CheckCircle size={size} className={styles.pipelineIconCompleted} />
    case 'failed': return <XCircle size={size} className={styles.pipelineIconFailed} />
    case 'waiting_approval': return <Clock size={size} className={styles.pipelineIconWaiting} />
    case 'waiting_input': return <MessageSquare size={size} className={styles.pipelineIconWaiting} />
    default: return <div className={styles.pipelineStageDot} />
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Pending'
    case 'running': return 'Running'
    case 'completed': return 'Completed'
    case 'failed': return 'Failed'
    case 'waiting_approval': return 'Awaiting Approval'
    case 'waiting_input': return 'Awaiting Input'
    default: return status
  }
}

/** Group stages into parallel "waves" based on dependsOn DAG */
function buildWaves(stageDefs: PipelineStage[]): string[][] {
  const placed = new Set<string>()
  const waves: string[][] = []
  const remaining = new Set(stageDefs.map((s) => s.id))

  while (remaining.size > 0) {
    const wave: string[] = []
    for (const def of stageDefs) {
      if (!remaining.has(def.id)) continue
      const deps = def.dependsOn ?? []
      if (deps.every((d) => placed.has(d))) wave.push(def.id)
    }
    if (wave.length === 0) break // safety: avoid infinite loop on circular deps
    for (const id of wave) { placed.add(id); remaining.delete(id) }
    waves.push(wave)
  }
  return waves
}

export default function PipelineStatusBar() {
  const {
    activePipelineRun: run,
    activePipelineDef: pipelineDef,
    dismissPipelineRun,
    approvePipelineStage,
    rejectPipelineStage,
    submitPipelineInput,
    retryPipelineStage,
  } = useWorkplace()

  const [expanded, setExpanded] = useState(false)
  const [stageInput, setStageInput] = useState('')

  const waves = useMemo(
    () => pipelineDef ? buildWaves(pipelineDef.stages) : [],
    [pipelineDef],
  )

  if (!run) return null

  const stageMap = new Map(run.stages.map((s) => [s.id, s]))
  const completedCount = run.stages.filter((s) => s.status === 'completed').length
  const hasParallel = waves.some((w) => w.length > 1)

  return (
    <div className={styles.pipelineBar}>
      {/* Summary row */}
      <div className={styles.pipelineBarHeader} onClick={() => setExpanded(!expanded)}>
        <button className={`btn btn-ghost ${styles.pipelineBarToggle}`}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {statusIcon(run.status as StageExecution['status'])}
        <span className={styles.pipelineBarName}>{run.pipelineName}</span>
        {hasParallel && <GitBranch size={11} style={{ color: 'var(--text-tertiary)' }} title="DAG pipeline" />}
        <span className={styles.pipelineBarMeta}>
          {completedCount}/{run.stages.length} stages &middot; {statusLabel(run.status)}
        </span>
        {/* DAG-aware progress: show waves separated by thin gaps */}
        <div className={styles.pipelineBarProgress}>
          {waves.map((wave, wi) => (
            <div key={wi} style={{ display: 'flex', flex: wave.length, gap: 1 }}>
              {wave.map((id) => {
                const s = stageMap.get(id)
                return (
                  <div
                    key={id}
                    className={`${styles.pipelineBarSegment} ${styles[`pipelineBarSegment--${s?.status}`] || ''}`}
                    style={{ flex: 1 }}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <button
          className={`btn btn-ghost ${styles.pipelineBarDismiss}`}
          onClick={(e) => { e.stopPropagation(); dismissPipelineRun() }}
          title="Close pipeline"
        >
          <X size={12} />
        </button>
      </div>

      {/* Expanded: show stages grouped by wave */}
      {expanded && (
        <div className={styles.pipelineBarStages}>
          {waves.map((wave, wi) => (
            <div key={wi}>
              {wave.length > 1 && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <GitBranch size={10} /> Parallel group
                </div>
              )}
              <div style={wave.length > 1 ? { borderLeft: '2px solid var(--accent-muted)', marginLeft: 6, paddingLeft: 6 } : undefined}>
                {wave.map((id) => {
                  const stage = stageMap.get(id)!
                  const defIdx = pipelineDef?.stages.findIndex((s) => s.id === id) ?? -1
                  const def = pipelineDef?.stages[defIdx]

                  return (
                    <div key={id} className={styles.pipelineBarStage}>
                      <div className={styles.pipelineBarStageRow}>
                        {statusIcon(stage.status)}
                        <span className={styles.pipelineBarStageNum}>{defIdx + 1}</span>
                        <span className={styles.pipelineBarStageId}>{def?.label || id}</span>
                        <span className={styles.pipelineBarStageStatus}>{statusLabel(stage.status)}</span>

                        {stage.status === 'waiting_approval' && (
                          <div className={styles.pipelineBarStageActions}>
                            <button className={`btn btn-primary ${styles.pipelineBarSmallBtn}`} onClick={() => approvePipelineStage(id)}>
                              <ThumbsUp size={10} /> Approve
                            </button>
                            <button className={`btn btn-secondary ${styles.pipelineBarSmallBtn}`} onClick={() => rejectPipelineStage(id)}>
                              <ThumbsDown size={10} /> Reject
                            </button>
                          </div>
                        )}

                        {stage.status === 'failed' && (
                          <button className={`btn btn-secondary ${styles.pipelineBarSmallBtn}`} onClick={() => retryPipelineStage(id)}>
                            <RefreshCw size={10} /> Retry
                          </button>
                        )}
                      </div>

                      {stage.status === 'waiting_input' && (
                        <div className={styles.pipelineBarInputRow}>
                          <input
                            className={`input ${styles.pipelineBarInput}`}
                            value={stageInput}
                            onChange={(e) => setStageInput(e.target.value)}
                            placeholder="Enter input..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && stageInput.trim()) {
                                submitPipelineInput(id, stageInput.trim())
                                setStageInput('')
                              }
                            }}
                          />
                          <button
                            className={`btn btn-primary ${styles.pipelineBarSmallBtn}`}
                            disabled={!stageInput.trim()}
                            onClick={() => { submitPipelineInput(id, stageInput.trim()); setStageInput('') }}
                          >
                            <Send size={10} /> Submit
                          </button>
                        </div>
                      )}

                      {stage.error && <div className={styles.pipelineBarError}>{stage.error}</div>}
                    </div>
                  )
                })}
              </div>
              {/* Wave separator */}
              {wi < waves.length - 1 && (
                <div style={{ borderTop: '1px dashed var(--border-subtle)', margin: '4px 0' }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

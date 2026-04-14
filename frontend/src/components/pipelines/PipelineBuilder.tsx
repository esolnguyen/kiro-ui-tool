import { useState } from 'react'
import { Plus, Save, X, GripVertical, Trash2 } from 'lucide-react'
import type { Pipeline, PipelineStage, PipelineInput } from '../../types'
import { useAppStore } from '../../stores/appStore'
import type { PipelineCreate } from '../../api/pipelines'

interface Props {
  initial?: Pipeline
  onSave: (data: PipelineCreate) => Promise<void>
  onCancel: () => void
}

const GATE_OPTIONS = [
  { value: 'auto', label: 'Auto', description: 'Proceeds immediately' },
  { value: 'approval', label: 'Approval', description: 'Waits for user approval' },
  { value: 'manual_input', label: 'Manual Input', description: 'Asks for additional input' },
] as const

export default function PipelineBuilder({ initial, onSave, onCancel }: Props) {
  const agents = useAppStore((s) => s.agents)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [stages, setStages] = useState<PipelineStage[]>(
    initial?.stages ?? []
  )
  const [saving, setSaving] = useState(false)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)

  function addStage() {
    const id = `stage-${Date.now()}`
    const newStage: PipelineStage = {
      id,
      agentSlug: agents[0]?.slug ?? '',
      label: `Stage ${stages.length + 1}`,
      prompt: '',
      gate: 'auto',
      dependsOn: [],
    }
    setStages((prev) => [...prev, newStage])
    setExpandedStage(id)
  }

  function updateStage(id: string, updates: Partial<PipelineStage>) {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  function removeStage(id: string) {
    setStages((prev) => prev.filter((s) => s.id !== id))
    if (expandedStage === id) setExpandedStage(null)
  }

  function moveStage(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= stages.length) return
    const updated = [...stages]
    const [moved] = updated.splice(index, 1)
    updated.splice(newIndex, 0, moved)
    setStages(updated)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const input: PipelineInput = { fields: [] }
      await onSave({ name: name.trim(), description, input, stages })
    } finally {
      setSaving(false)
    }
  }

  // Collect available template variables from prior stages
  function getAvailableVars(stageIndex: number): string[] {
    const vars: string[] = []
    for (let i = 0; i < stageIndex; i++) {
      vars.push(`{{stages.${stages[i].id}.output}}`)
    }
    return vars
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--surface-raised)',
        }}
      >
        <input
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pipeline name"
          style={{ maxWidth: 200 }}
        />
        <input
          className="field-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          style={{ maxWidth: 260 }}
        />
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={addStage}>
          <Plus size={13} />
          Add Stage
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
          <Save size={13} />
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          <X size={13} />
        </button>
      </div>

      {/* Stages list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {stages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 13,
              padding: '60px 20px',
            }}
          >
            No stages yet. Click "Add Stage" to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stages.map((stage, index) => {
              const isExpanded = expandedStage === stage.id
              const availableVars = getAvailableVars(index)

              return (
                <div
                  key={stage.id}
                  style={{
                    border: `1px solid ${isExpanded ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    borderRadius: 10,
                    background: 'var(--surface-raised)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Stage header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                  >
                    <GripVertical size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <div
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: 'var(--accent-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {stage.label || 'Untitled Stage'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {agents.find((a) => a.slug === stage.agentSlug)?.name || stage.agentSlug || 'No agent'}
                        {' · '}
                        {GATE_OPTIONS.find((g) => g.value === stage.gate)?.label ?? stage.gate}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '2px 4px', fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); moveStage(index, -1) }}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '2px 4px', fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); moveStage(index, 1) }}
                        disabled={index === stages.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '2px 4px', color: 'var(--error)' }}
                        onClick={(e) => { e.stopPropagation(); removeStage(stage.id) }}
                        title="Remove stage"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded editor */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '0 12px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: 12,
                      }}
                    >
                      {/* Label + Agent row */}
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                            Label
                          </label>
                          <input
                            className="field-input"
                            value={stage.label}
                            onChange={(e) => updateStage(stage.id, { label: e.target.value })}
                            placeholder="Stage label"
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                            Agent
                          </label>
                          <select
                            className="field-input"
                            value={stage.agentSlug}
                            onChange={(e) => updateStage(stage.id, { agentSlug: e.target.value })}
                          >
                            <option value="">Select agent...</option>
                            {agents.map((a) => (
                              <option key={a.slug} value={a.slug}>
                                {a.name || a.slug}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Gate selector */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                          Gate
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {GATE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              className="btn"
                              style={{
                                padding: '6px 12px',
                                fontSize: 12,
                                borderRadius: 6,
                                border: `1px solid ${stage.gate === opt.value ? 'var(--accent)' : 'var(--border-subtle)'}`,
                                background: stage.gate === opt.value ? 'var(--accent-muted)' : 'transparent',
                                color: stage.gate === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                                fontWeight: stage.gate === opt.value ? 600 : 400,
                              }}
                              onClick={() => updateStage(stage.id, { gate: opt.value })}
                              title={opt.description}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Depends On (DAG dependencies) */}
                      {index > 0 && (
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                            Depends On
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {stages.slice(0, index).map((other) => {
                              const checked = stage.dependsOn?.includes(other.id) ?? false
                              return (
                                <label
                                  key={other.id}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                                    border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-subtle)'}`,
                                    background: checked ? 'var(--accent-muted)' : 'transparent',
                                    color: checked ? 'var(--accent)' : 'var(--text-secondary)',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const deps = stage.dependsOn ?? []
                                      const next = e.target.checked
                                        ? [...deps, other.id]
                                        : deps.filter((d) => d !== other.id)
                                      updateStage(stage.id, { dependsOn: next })
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                  {other.label || other.id}
                                </label>
                              )
                            })}
                          </div>
                          {(!stage.dependsOn || stage.dependsOn.length === 0) && (
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                              No dependencies — runs in parallel with other independent stages
                            </div>
                          )}
                        </div>
                      )}

                      {/* Prompt template */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                          Prompt Template
                        </label>
                        <textarea
                          className="field-input"
                          value={stage.prompt}
                          onChange={(e) => updateStage(stage.id, { prompt: e.target.value })}
                          placeholder="Enter the prompt for this stage. Use {{stages.stage-id.output}} to reference prior stage outputs."
                          rows={5}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            lineHeight: 1.5,
                            resize: 'vertical',
                            minHeight: 80,
                          }}
                        />
                        {availableVars.length > 0 && (
                          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            Available variables:{' '}
                            {availableVars.map((v, i) => (
                              <span key={i}>
                                <code
                                  style={{
                                    background: 'var(--input-bg)',
                                    padding: '1px 4px',
                                    borderRadius: 3,
                                    fontSize: 10,
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => {
                                    updateStage(stage.id, { prompt: stage.prompt + v })
                                  }}
                                  title="Click to insert"
                                >
                                  {v}
                                </code>
                                {i < availableVars.length - 1 ? ' ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

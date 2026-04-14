export type ModelType = 'sonnet' | 'opus' | 'haiku'
export type MemoryType = 'user' | 'project' | 'none'
export type SkillContext = 'when' | 'always'
export type ThemeType = 'light' | 'dark' | 'system'
export type PermissionMode = 'auto' | 'ask' | 'deny'

export interface AgentMcpServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
  autoApprove?: string[]
  disabledTools?: string[]
}

export interface Agent {
  slug: string
  name: string
  description: string
  model: ModelType
  color?: string
  memory?: MemoryType
  body: string
  mcpServers?: Record<string, AgentMcpServerConfig>
  tools?: string[]
  allowedTools?: string[]
}

export interface Command {
  slug: string
  name: string
  description: string
  argumentHint?: string
  allowedTools?: string[]
  agent?: string
  body: string
}

export interface Skill {
  slug: string
  name: string
  description: string
  context?: SkillContext
  agent?: string
  body: string
}

export interface PipelineInputField {
  name: string
  type: string // textarea | text | ado_pbi
  label: string
}

export interface PipelineInput {
  fields: PipelineInputField[]
}

export interface PipelineStage {
  id: string
  agentSlug: string
  label: string
  prompt: string
  gate: 'auto' | 'approval' | 'manual_input'
  dependsOn: string[]  // stage IDs that must complete before this stage runs
}

export interface Pipeline {
  id: string
  name: string
  description: string
  input: PipelineInput
  stages: PipelineStage[]
  createdAt: string
}

export interface StageExecution {
  id: string
  status: 'pending' | 'running' | 'completed' | 'waiting_approval' | 'waiting_input' | 'failed'
  output: string
  error: string
  userInput: string
  startedAt: string
  completedAt: string
}

export interface PipelineRun {
  id: string
  pipelineId: string
  pipelineName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval' | 'waiting_input'
  input: Record<string, unknown>
  stages: StageExecution[]
  startedAt: string
  completedAt: string
}

export interface RelationshipNode {
  id: string
  type: 'agent' | 'command' | 'skill'
  label: string
  model?: string
  color?: string
}

export interface RelationshipEdge {
  source: string
  target: string
  type: string
}

export interface RelationshipGraph {
  nodes: RelationshipNode[]
  edges: RelationshipEdge[]
}

export interface McpServer {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
}

export interface McpTool {
  name: string
  description: string
}

export interface McpToolsResponse {
  server: string
  tools: McpTool[]
  error: string | null
  durationMs: number
}

export interface AzureDevOpsConfig {
  organization: string
  project: string
  personalAccessToken: string
  apiVersion: string
}

export interface Settings {
  kiroDir: string
  kiroCLIPath: string
  theme: ThemeType
  defaultModel: ModelType
  azureDevOps: AzureDevOpsConfig
}

// Chat / NormalizedMessage types
export interface NormalizedMessage {
  id: string
  kind:
    | 'text'
    | 'thinking'
    | 'tool_use'
    | 'tool_result'
    | 'stream_delta'
    | 'stream_end'
    | 'complete'
    | 'error'
  role?: 'user' | 'assistant'
  content: string
  toolName?: string
  toolInput?: Record<string, unknown>
  isStreaming?: boolean
  images?: string[]
  timestamp: string
}

export interface ChatSession {
  id: string
  agentSlug?: string
  messages: NormalizedMessage[]
  createdAt: string
  updatedAt: string
}

// CLI session types
export interface CliSession {
  id: string
  agentSlug?: string
  workingDir: string
  startedAt: string
  lastActivity: string
  status: 'active' | 'idle' | 'terminated'
}

// Kiro project / session history
export interface KiroProject {
  name: string
  displayName: string
  path?: string
  sessionCount: number
  lastActivity: string
}

export interface ProjectSession {
  id: string
  projectName: string
  summary?: string
  messageCount: number
  lastActivity: string
  createdAt?: string
  isGrouped?: boolean
  groupSize?: number
}

// Hooks config
export interface HookConfig {
  event: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification' | 'SubagentStop'
  command: string
  enabled: boolean
  matcher?: string
}

// Plugin / Marketplace
export interface Plugin {
  id: string
  name: string
  description: string
  type: string
  author: string
  stars: number
  repoUrl?: string
  installed?: boolean
}

export interface GitHubImport {
  id: string
  repoUrl: string
  importedAt: string
  items: Array<{ type: string; slug: string; path: string }>
}

export interface Suggestion {
  type: string
  entityType: string
  entitySlug: string
  message: string
  severity: 'info' | 'warning' | 'error'
}

// WebSocket message types (chat v2)
export interface ChatWebSocketMessage {
  type: 'start' | 'input' | 'abort' | 'ping'
  message?: string
  sessionId?: string
  agentSlug?: string
  systemPrompt?: string
  workingDir?: string
  images?: string[]
}

export interface ChatWebSocketEvent {
  type:
    | 'connected'
    | 'session'
    | 'message'
    | 'stream_delta'
    | 'stream_end'
    | 'complete'
    | 'error'
    | 'pong'
  data?: NormalizedMessage
  sessionId?: string
  error?: string
}

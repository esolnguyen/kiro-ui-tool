from pydantic import BaseModel


class PipelineInputField(BaseModel):
    name: str
    type: str = "textarea"  # textarea | text | ado_pbi
    label: str = ""


class PipelineInput(BaseModel):
    fields: list[PipelineInputField] = []


class PipelineStage(BaseModel):
    id: str
    agentSlug: str
    label: str
    prompt: str = ""
    gate: str = "auto"  # auto | approval | manual_input
    dependsOn: list[str] = []  # stage IDs that must complete before this stage runs


class PipelineCreate(BaseModel):
    name: str
    description: str = ""
    input: PipelineInput = PipelineInput()
    stages: list[PipelineStage] = []


class PipelineResponse(PipelineCreate):
    id: str
    createdAt: str


# ── Pipeline Run models ───────────────────────────────────────────────────

class StageExecution(BaseModel):
    id: str
    status: str = "pending"  # pending | running | completed | waiting_approval | waiting_input | failed
    output: str = ""
    error: str = ""
    userInput: str = ""  # filled by manual_input gate
    startedAt: str = ""
    completedAt: str = ""


class PipelineRunCreate(BaseModel):
    pipelineId: str
    input: dict = {}


class PipelineRun(BaseModel):
    id: str
    pipelineId: str
    pipelineName: str = ""
    status: str = "pending"  # pending | running | completed | failed | waiting_approval | waiting_input
    input: dict = {}
    stages: list[StageExecution] = []
    startedAt: str = ""
    completedAt: str = ""

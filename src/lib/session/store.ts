/**
 * SessionStore — 全局单例 Map<sessionId, CopilotSession>
 *
 * 为什么用全局单例而非 Redis/DB：
 * - Demo 阶段数据量极小（单次演示 1-3 个会话）
 * - Next.js dev 模式下 hot-reload 会重置内存，但演示期可接受
 * - 生产化时换成 Redis/Postgres，接口不变（setSession/getSession）
 *
 * 全流程可追溯：每一步的 LLM 调用 / API 调用都 append 到对应 StepRecord。
 */

import type { CopilotSession, FtoStep, StepRecord, LlmCallLog, ApiCallLog, StepStatus } from "./types";

/** 全局会话存储 */
const store = new Map<string, CopilotSession>();

/** 会话 TTL（毫秒），默认 2 小时 */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

/** 每 30 分钟自动清理过期会话 */
if (typeof setInterval !== "undefined") {
  setInterval(() => SessionStore.cleanupExpired(), 30 * 60 * 1000);
}

/** 生成简单的 session ID */
function generateId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建空的 StepRecord */
function createEmptyStep(step: FtoStep, name: string): StepRecord {
  return {
    step,
    name,
    status: "pending",
    input: null,
    output: null,
    llmCalls: [],
    apiCalls: [],
  };
}

export const SessionStore = {
  /** 创建新会话 */
  createSession(userInput: { text: string; imageRef?: string }, competitors: string[]): CopilotSession {
    const id = generateId();
    const session: CopilotSession = {
      id,
      createdAt: new Date().toISOString(),
      userInput,
      competitors,
      steps: {
        1: createEmptyStep(1, "技术理解"),
        2: createEmptyStep(2, "专利检索"),
        3: createEmptyStep(3, "风险评估"),
        4: createEmptyStep(4, "报告生成"),
      },
    };
    store.set(id, session);
    return session;
  },

  /** 获取会话 */
  getSession(id: string): CopilotSession | undefined {
    return store.get(id);
  },

  /** 设置步骤状态 */
  setStepStatus(id: string, step: FtoStep, status: StepStatus): void {
    const session = store.get(id);
    if (!session) throw new Error(`[SessionStore] session not found: ${id}`);
    const record = session.steps[step];
    record.status = status;
    if (status === "running" && !record.startedAt) {
      record.startedAt = new Date().toISOString();
    }
    if ((status === "success" || status === "error") && !record.finishedAt) {
      record.finishedAt = new Date().toISOString();
    }
  },

  /** 设置步骤输入 */
  setStepInput(id: string, step: FtoStep, input: unknown): void {
    const session = store.get(id);
    if (!session) throw new Error(`[SessionStore] session not found: ${id}`);
    session.steps[step].input = input;
  },

  /** 设置步骤输出 */
  setStepOutput(id: string, step: FtoStep, output: unknown): void {
    const session = store.get(id);
    if (!session) throw new Error(`[SessionStore] session not found: ${id}`);
    session.steps[step].output = output;
  },

  /** 追加 LLM 调用日志 */
  appendLlmCall(id: string, step: FtoStep, log: LlmCallLog): void {
    const session = store.get(id);
    if (!session) throw new Error(`[SessionStore] session not found: ${id}`);
    session.steps[step].llmCalls.push(log);
  },

  /** 追加 API 调用日志 */
  appendApiCall(id: string, step: FtoStep, log: ApiCallLog): void {
    const session = store.get(id);
    if (!session) throw new Error(`[SessionStore] session not found: ${id}`);
    session.steps[step].apiCalls.push(log);
  },

  /** 追加步骤备注 */
  appendNote(id: string, step: FtoStep, note: string): void {
    const session = store.get(id);
    if (!session) throw new Error(`[SessionStore] session not found: ${id}`);
    if (!session.steps[step].notes) {
      session.steps[step].notes = [];
    }
    session.steps[step].notes!.push(note);
  },

  /** 追加步骤错误 */
  appendError(id: string, step: FtoStep, error: string): void {
    const session = store.get(id);
    if (!session) throw new Error(`[SessionStore] session not found: ${id}`);
    if (!session.steps[step].errors) {
      session.steps[step].errors = [];
    }
    session.steps[step].errors!.push(error);
  },

  /** 设置最终报告内容 */
  setReportContent(id: string, content: string): void {
    const session = store.get(id);
    if (!session) throw new Error(`[SessionStore] session not found: ${id}`);
    session.reportContent = content;
  },

  /** 删除会话（清理用） */
  deleteSession(id: string): void {
    store.delete(id);
  },

  /** 清理过期会话（超过 TTL 的会话将被移除） */
  cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of store) {
      const createdAt = new Date(session.createdAt).getTime();
      if (now - createdAt > SESSION_TTL_MS) {
        store.delete(id);
        removed++;
      }
    }
    return removed;
  },
};

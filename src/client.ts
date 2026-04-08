import { LetAgentPayError } from "./errors.js";
import type {
  BudgetInfo,
  ConfirmOptions,
  ConfirmResult,
  LetAgentPayConfig,
  ListRequestsOptions,
  PolicyCheck,
  PolicyResult,
  PurchaseOptions,
  PurchaseRequestInfo,
  PurchaseResult,
  RequestList,
  RequestStatus,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.letagentpay.com/api/v1/agent-api";

function getEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[name];
  }
  return undefined;
}

function parsePolicyCheck(data: Record<string, unknown>): PolicyCheck {
  return {
    rule: data.rule as string,
    result: data.result as "pass" | "fail",
    detail: data.detail as string,
  };
}

function parsePolicyResult(
  data: Record<string, unknown> | null,
): PolicyResult | null {
  if (!data) return null;
  const checks = (data.checks as Record<string, unknown>[]) || [];
  return {
    passed: data.passed as boolean,
    checks: checks.map(parsePolicyCheck),
  };
}

function parsePurchaseResult(data: Record<string, unknown>): PurchaseResult {
  return {
    requestId: data.request_id as string,
    status: data.status as PurchaseResult["status"],
    currency: (data.currency as string) ?? null,
    category: (data.category as string) ?? null,
    originalCategory: (data.original_category as string) ?? null,
    policyCheck: parsePolicyResult(
      (data.policy_check as Record<string, unknown>) ?? null,
    ),
    autoApproved: (data.auto_approved as boolean) ?? false,
    budgetRemaining:
      data.budget_remaining != null ? Number(data.budget_remaining) : null,
    expiresAt: (data.expires_at as string) ?? null,
  };
}

function parseRequestStatus(data: Record<string, unknown>): RequestStatus {
  return {
    requestId: data.request_id as string,
    status: data.status as string,
    amount: Number(data.amount),
    category: data.category as string,
    createdAt: String(data.created_at),
    reviewedAt: data.reviewed_at ? String(data.reviewed_at) : null,
  };
}

function parseConfirmResult(data: Record<string, unknown>): ConfirmResult {
  return {
    requestId: data.request_id as string,
    status: data.status as ConfirmResult["status"],
    actualAmount:
      data.actual_amount != null ? Number(data.actual_amount) : null,
  };
}

function parseBudgetInfo(data: Record<string, unknown>): BudgetInfo {
  return {
    budget: Number(data.budget),
    spent: Number(data.spent),
    held: Number(data.held),
    remaining: Number(data.remaining),
    currency: (data.currency as string) ?? null,
  };
}

function parsePurchaseRequestInfo(
  data: Record<string, unknown>,
): PurchaseRequestInfo {
  return {
    requestId: data.request_id as string,
    status: data.status as string,
    amount: Number(data.amount),
    currency: (data.currency as string) ?? "USD",
    category: (data.category as string) ?? "",
    merchant: (data.merchant as string) ?? null,
    description: (data.description as string) ?? null,
    createdAt: data.created_at ? String(data.created_at) : null,
    reviewedAt: data.reviewed_at ? String(data.reviewed_at) : null,
    expiresAt: data.expires_at ? String(data.expires_at) : null,
  };
}

function parseRequestList(data: Record<string, unknown>): RequestList {
  const requests = (data.requests as Record<string, unknown>[]) || [];
  return {
    requests: requests.map(parsePurchaseRequestInfo),
    total: (data.total as number) ?? 0,
    limit: (data.limit as number) ?? 20,
    offset: (data.offset as number) ?? 0,
  };
}

/**
 * Client for the LetAgentPay Agent API.
 *
 * @example
 * ```ts
 * const client = new LetAgentPay({ token: "agt_..." });
 * const result = await client.requestPurchase({
 *   amount: 25.00,
 *   category: "groceries",
 *   description: "Weekly supplies",
 * });
 * console.log(result.status); // "auto_approved" | "pending" | "rejected"
 * ```
 */
export class LetAgentPay {
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(config: LetAgentPayConfig = {}) {
    const resolvedToken = config.token ?? getEnv("LETAGENTPAY_TOKEN");
    if (!resolvedToken) {
      throw new Error(
        "Token is required. Pass token in config or set LETAGENTPAY_TOKEN env var.",
      );
    }

    this.token = resolvedToken;
    this.baseUrl = (
      config.baseUrl ??
      getEnv("LETAGENTPAY_BASE_URL") ??
      DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
  }

  private async request(
    method: string,
    path: string,
    options?: { body?: unknown; params?: Record<string, string> },
  ): Promise<Record<string, unknown>> {
    let url = `${this.baseUrl}${path}`;

    if (options?.params) {
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const detail = (data.detail as string) ?? response.statusText;
      throw new LetAgentPayError(response.status, detail);
    }

    return data;
  }

  /** Create a purchase request. */
  async requestPurchase(options: PurchaseOptions): Promise<PurchaseResult> {
    const body: Record<string, unknown> = {
      amount: options.amount,
      category: options.category,
    };
    if (options.merchantName) body.merchant_name = options.merchantName;
    if (options.description) body.description = options.description;
    if (options.agentComment) body.agent_comment = options.agentComment;

    const data = await this.request("POST", "/requests", { body });
    return parsePurchaseResult(data);
  }

  /** Check the status of a purchase request. */
  async checkRequest(requestId: string): Promise<RequestStatus> {
    const data = await this.request("GET", `/requests/${requestId}`);
    return parseRequestStatus(data);
  }

  /** Confirm a purchase result after approval. */
  async confirmPurchase(
    requestId: string,
    options: ConfirmOptions,
  ): Promise<ConfirmResult> {
    const body: Record<string, unknown> = { success: options.success };
    if (options.actualAmount != null) body.actual_amount = options.actualAmount;
    if (options.receiptUrl) body.receipt_url = options.receiptUrl;

    const data = await this.request("POST", `/requests/${requestId}/confirm`, {
      body,
    });
    return parseConfirmResult(data);
  }

  /** Get current budget, spent, and remaining. */
  async checkBudget(): Promise<BudgetInfo> {
    const data = await this.request("GET", "/budget");
    return parseBudgetInfo(data);
  }

  /** Get the current spending policy. */
  async getPolicy(): Promise<Record<string, unknown>> {
    return this.request("GET", "/policy");
  }

  /** List valid purchase categories. */
  async listCategories(): Promise<string[]> {
    const data = await this.request("GET", "/categories");
    return data.categories as string[];
  }

  /** List agent's purchase requests. */
  async myRequests(options: ListRequestsOptions = {}): Promise<RequestList> {
    const params: Record<string, string> = {};
    if (options.status) params.status = options.status;
    params.limit = String(options.limit ?? 20);
    params.offset = String(options.offset ?? 0);

    const data = await this.request("GET", "/requests", { params });
    return parseRequestList(data);
  }
}

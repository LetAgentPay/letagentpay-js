/** Individual policy check result. */
export interface PolicyCheck {
  rule: string;
  result: "pass" | "fail";
  detail: string;
}

/** Aggregated policy check result. */
export interface PolicyResult {
  passed: boolean;
  checks: PolicyCheck[];
}

/** Response from creating a purchase request. */
export interface PurchaseResult {
  requestId: string;
  status: "auto_approved" | "pending" | "rejected";
  currency: string | null;
  category: string | null;
  originalCategory: string | null;
  policyCheck: PolicyResult | null;
  autoApproved: boolean;
  budgetRemaining: number | null;
  expiresAt: string | null;
}

/** Response from checking a purchase request status. */
export interface RequestStatus {
  requestId: string;
  status: string;
  amount: number;
  category: string;
  createdAt: string;
  reviewedAt: string | null;
}

/** Response from confirming a purchase. */
export interface ConfirmResult {
  requestId: string;
  status: "completed" | "failed";
  actualAmount: number | null;
}

/** Current budget information. */
export interface BudgetInfo {
  budget: number;
  spent: number;
  held: number;
  remaining: number;
  currency: string | null;
}

/** Purchase request in a list response. */
export interface PurchaseRequestInfo {
  requestId: string;
  status: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string | null;
  description: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
}

/** Paginated list of purchase requests. */
export interface RequestList {
  requests: PurchaseRequestInfo[];
  total: number;
  limit: number;
  offset: number;
}

/** Options for creating a purchase request. */
export interface PurchaseOptions {
  amount: number;
  category: string;
  merchantName?: string;
  description?: string;
  agentComment?: string;
}

/** Options for confirming a purchase. */
export interface ConfirmOptions {
  success: boolean;
  actualAmount?: number;
  receiptUrl?: string;
}

/** Options for listing requests. */
export interface ListRequestsOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

/** Client configuration. */
export interface LetAgentPayConfig {
  token?: string;
  baseUrl?: string;
}

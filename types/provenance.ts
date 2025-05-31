export type EntityType = "resource" | "ai" | "human" | "tool";

export interface Entity {
  id: string;
  type: EntityType;
  metadata: Record<string, any>;
}

export type ActivityType =
  | "generate"
  | "transform"
  | "reference"
  | "approve"
  | "assign";

export interface Activity {
  id: string;
  type: ActivityType;
  timestamp: string;
  performedBy: string;
  inputs: string[];
  outputs: string[];
  metadata?: Record<string, any>;
  evidence?: Record<string, any>;
  signedBy?: string;
}

export type AttributionRole =
  | "creator"
  | "contributor"
  | "sourceMaterial"
  | "approver";

export interface Attribution {
  resourceId: string;
  contributorId: string;
  role: AttributionRole;
  weight?: number;
  notes?: string;
  includedInCredits?: boolean;
}

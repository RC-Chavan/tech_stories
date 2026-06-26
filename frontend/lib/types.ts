/** Shared TypeScript types mirroring backend/app/schemas.py. */

export interface StarStory {
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface ModerationFlags {
  toxicity: boolean;
  pii_detected: string[];
  off_topic: boolean;
  low_quality: boolean;
  notes: string;
}

export interface IncidentSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  created_at: string;
  approved_at: string | null;
}

export interface IncidentDetail extends IncidentSummary {
  raw_text: string;
  status: "pending" | "approved" | "rejected";
  moderation_flags: ModerationFlags;
  moderation_notes: string | null;
  star: StarStory;
  technical_points: string[];
  thinking_notes: string | null;
}

export interface IncidentListResponse {
  items: IncidentSummary[];
  page: number;
  page_size: number;
  total: number;
}

export interface SubmitResponse {
  id: string;
  status: "pending" | "approved" | "rejected";
  title: string;
  summary: string;
  moderation_flags: ModerationFlags;
  message: string;
}

export interface IncidentStatus {
  id: string;
  status: "pending" | "approved" | "rejected";
  title: string;
  slug: string | null;
  created_at: string;
  approved_at: string | null;
  rejection_reason: string | null;
}

export interface AdminIncidentListResponse {
  items: IncidentDetail[];
  page: number;
  page_size: number;
  total: number;
}

export interface AdminActionResponse {
  id: string;
  status: "pending" | "approved" | "rejected";
  moderation_notes: string | null;
}
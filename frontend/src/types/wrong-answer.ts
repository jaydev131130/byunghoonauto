export interface ProblemSetListItem {
  id: number;
  name: string;
  chapter_count: number;
  total_problems: number;
  created_at: string;
}

export interface ChapterInfo {
  id: number;
  name: string;
  sort_order: number;
  problem_count: number;
}

export interface ProblemSetDetail {
  id: number;
  name: string;
  chapters: ChapterInfo[];
}

export interface StudentItem {
  id: number;
  name: string;
  grade: string | null;
  class_name: string | null;
}

export interface StudentEntry {
  student_id: number;
  entries: { chapter_id: number; problem_numbers: number[] }[];
}

export interface HistoryItem {
  id: number;
  title: string;
  problem_set_id: number;
  problem_set_name: string | null;
  problem_set_ids?: number[];
  problem_set_names?: string[];
  total_problems: number;
  student_count: number;
  student_entries?: StudentEntry[];
  // Legacy format fields
  entries?: { chapter_id: number; problem_numbers: number[] }[];
  student_ids?: number[];
  created_at: string;
}

export interface PdfResponse {
  filename: string;
  download_url: string;
}

export type PagePhase = "input" | "success";

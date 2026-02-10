export interface ProblemSet {
  id: number
  name: string
  source_path: string
  created_at: string
  updated_at: string
  chapter_count?: number
  total_problems?: number
}

export interface Chapter {
  id: number
  problem_set_id: number
  name: string
  source_filename: string
  sort_order: number
  total_problems: number
  created_at: string
}

export interface Problem {
  id: number
  chapter_id: number
  number: number
  image_path: string
  width: number
  height: number
  file_size: number
  page_num: number | null
  column_pos: string | null
}

export interface WrongAnswerSet {
  id: number
  student_id: number
  title: string | null
  created_at: string
}

export interface WrongAnswerEntry {
  chapter_id: number
  chapter_name: string
  problem_numbers: number[]
}

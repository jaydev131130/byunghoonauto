import type { StudentItem } from "../types/wrong-answer";

function buildStudentLabel(student: Pick<StudentItem, "name" | "grade"> | null | undefined): string {
  if (!student) {
    return "";
  }
  return [student.grade?.trim(), student.name.trim()].filter(Boolean).join(" ");
}

export function formatMonthDay(value: Date = new Date()): string {
  return `${value.getMonth() + 1}/${value.getDate()}`;
}

export function buildDefaultWrongAnswerTitle(
  student: Pick<StudentItem, "name" | "grade"> | null | undefined,
  value: Date = new Date(),
): string {
  const studentLabel = buildStudentLabel(student);
  const base = formatMonthDay(value);
  return studentLabel ? `${base} ${studentLabel}` : base;
}

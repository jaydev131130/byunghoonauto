export const APP_NAME = '오답노트 빌더'

export const NAV_ITEMS = [
  { label: '문제집 관리', path: '/' },
  { label: '문제집 가져오기', path: '/import' },
  { label: '학생 관리', path: '/students' },
  { label: '오답노트 생성', path: '/wrong-answers/create' },
  { label: '일괄 인쇄', path: '/batch-print' },
] as const

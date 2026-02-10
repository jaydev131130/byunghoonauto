import { useEffect } from 'react'
import MainLayout from '../components/layout/MainLayout'
import { ProblemSetCard } from '../components/problem-set/ProblemSetCard'
import { useProblemSets } from '../hooks/useProblemSets'

export default function ProblemSetListPage() {
  const { problemSets, loading, error, fetchProblemSets, deleteProblemSet } = useProblemSets()

  useEffect(() => {
    fetchProblemSets()
  }, [fetchProblemSets])

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">문제집 목록</h1>
          <a
            href="/import"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            가져오기
          </a>
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-500">불러오는 중...</div>
        )}

        {error && (
          <div className="text-center py-12 text-red-500">{error}</div>
        )}

        {!loading && !error && problemSets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">아직 가져온 문제집이 없습니다.</p>
            <a
              href="/import"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              첫 문제집 가져오기
            </a>
          </div>
        )}

        {!loading && !error && problemSets.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {problemSets.map(ps => (
              <ProblemSetCard
                key={ps.id}
                id={ps.id}
                name={ps.name}
                chapterCount={ps.chapter_count ?? 0}
                totalProblems={ps.total_problems ?? 0}
                createdAt={ps.created_at}
                onDelete={deleteProblemSet}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
}

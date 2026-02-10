import MainLayout from '../components/layout/MainLayout'
import { FolderInput } from '../components/problem-set/FolderInput'
import { ExtractionProgress } from '../components/problem-set/ExtractionProgress'
import { useExtraction } from '../hooks/useExtraction'

export default function ImportPage() {
  const extraction = useExtraction()

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">문제집 가져오기</h1>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FolderInput
            onSubmit={extraction.startExtraction}
            disabled={extraction.status === 'extracting'}
          />
          <ExtractionProgress
            status={extraction.status}
            currentChapter={extraction.currentChapter}
            chaptersCompleted={extraction.chaptersCompleted}
            totalChapters={extraction.totalChapters}
            totalProblems={extraction.totalProblems}
            errorMessage={extraction.errorMessage}
            onCancel={extraction.cancelExtraction}
            onReset={extraction.reset}
            problemSetId={extraction.problemSetId}
          />
        </div>
      </div>
    </MainLayout>
  )
}

import { Route, Routes } from 'react-router-dom'
import ProblemSetListPage from './pages/ProblemSetListPage'
import ImportPage from './pages/ImportPage'
import VerificationPage from './pages/VerificationPage'
import StudentListPage from './pages/StudentListPage'
import WrongAnswerPage from './pages/WrongAnswerPage'
import WrongAnswerCreatePage from './pages/WrongAnswerCreatePage'
import BatchPrintPage from './pages/BatchPrintPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProblemSetListPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/problem-sets/:id/verify" element={<VerificationPage />} />
      <Route path="/students" element={<StudentListPage />} />
      <Route path="/students/:id/wrong-answers" element={<WrongAnswerPage />} />
      <Route path="/wrong-answers/create" element={<WrongAnswerCreatePage />} />
      <Route path="/batch-print" element={<BatchPrintPage />} />
    </Routes>
  )
}

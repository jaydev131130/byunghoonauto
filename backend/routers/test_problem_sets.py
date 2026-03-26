import sqlite3
import unittest

from backend.database import _TABLES_SQL
from backend.routers.problem_sets import _delete_problem_set_rows


class ProblemSetDeletionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(_TABLES_SQL)

    def tearDown(self) -> None:
        self.conn.close()

    def test_delete_problem_set_also_removes_wrong_answers_bound_to_chapters(self) -> None:
        self.conn.execute(
            "INSERT INTO problem_sets (id, name, source_path) VALUES (1, '테스트 문제집', '/tmp/test.pdf')"
        )
        self.conn.execute(
            "INSERT INTO chapters (id, problem_set_id, name, source_filename, sort_order, total_problems) "
            "VALUES (10, 1, '1단원', 'test.pdf', 1, 1)"
        )
        self.conn.execute(
            "INSERT INTO problems (chapter_id, number, image_path, width, height, file_size) "
            "VALUES (10, 1, '1/10/001.jpg', 100, 200, 1234)"
        )
        self.conn.execute(
            "INSERT INTO students (id, name) VALUES (20, '김주흔')"
        )
        self.conn.execute(
            "INSERT INTO wrong_answer_sets (id, student_id, title) VALUES (30, 20, '3/12 고2 김주흔')"
        )
        self.conn.execute(
            "INSERT INTO wrong_answers (wrong_answer_set_id, chapter_id, problem_numbers) "
            "VALUES (30, 10, '[1]')"
        )

        _delete_problem_set_rows(self.conn, 1)
        self.conn.commit()

        remaining_problem_sets = self.conn.execute(
            "SELECT COUNT(*) FROM problem_sets"
        ).fetchone()[0]
        remaining_chapters = self.conn.execute(
            "SELECT COUNT(*) FROM chapters"
        ).fetchone()[0]
        remaining_problems = self.conn.execute(
            "SELECT COUNT(*) FROM problems"
        ).fetchone()[0]
        remaining_wrong_answers = self.conn.execute(
            "SELECT COUNT(*) FROM wrong_answers"
        ).fetchone()[0]

        self.assertEqual(remaining_problem_sets, 0)
        self.assertEqual(remaining_chapters, 0)
        self.assertEqual(remaining_problems, 0)
        self.assertEqual(remaining_wrong_answers, 0)


if __name__ == "__main__":
    unittest.main()

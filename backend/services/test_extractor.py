import unittest

import fitz

from backend.services.extractor import _build_problem_regions


class ExtractorRegionTests(unittest.TestCase):
    def test_merges_multiple_image_blocks_into_single_problem_region(self) -> None:
        anchors = [
            {
                "number": 69,
                "bbox": (41.5, 84.5, 59.9, 96.8),
                "x0": 41.5,
                "y0": 84.5,
                "column_pos": "left",
            }
        ]
        image_blocks = [
            {"bbox": (41.5, 107.0, 288.0, 256.8)},
            {"bbox": (41.5, 256.8, 288.0, 406.6)},
            {"bbox": (41.5, 406.6, 288.0, 555.8)},
            {"bbox": (306.5, 107.0, 553.0, 283.9)},
        ]

        regions = _build_problem_regions(anchors, image_blocks, fitz.Rect(0, 0, 595, 842))

        self.assertEqual(len(regions), 1)
        self.assertEqual(regions[0]["number"], 69)
        self.assertEqual(regions[0]["column_pos"], "left")
        self.assertEqual(regions[0]["bbox"], (37.5, 103.0, 292.0, 561.8))

    def test_splits_regions_by_next_question_anchor_in_same_column(self) -> None:
        anchors = [
            {
                "number": 65,
                "bbox": (41.5, 84.5, 59.9, 96.8),
                "x0": 41.5,
                "y0": 84.5,
                "column_pos": "left",
            },
            {
                "number": 66,
                "bbox": (41.5, 288.0, 59.9, 300.3),
                "x0": 41.5,
                "y0": 288.0,
                "column_pos": "left",
            },
            {
                "number": 67,
                "bbox": (41.5, 548.7, 59.9, 561.0),
                "x0": 41.5,
                "y0": 548.7,
                "column_pos": "left",
            },
        ]
        image_blocks = [
            {"bbox": (41.5, 107.0, 288.0, 188.2)},
            {"bbox": (41.5, 310.6, 288.0, 448.6)},
            {"bbox": (41.5, 571.2, 288.0, 677.5)},
        ]

        regions = _build_problem_regions(anchors, image_blocks, fitz.Rect(0, 0, 595, 842))

        self.assertEqual([region["number"] for region in regions], [65, 66, 67])
        self.assertEqual(regions[0]["bbox"], (37.5, 103.0, 292.0, 194.2))
        self.assertEqual(regions[1]["bbox"], (37.5, 306.6, 292.0, 454.6))
        self.assertEqual(regions[2]["bbox"], (37.5, 567.2, 292.0, 683.5))


if __name__ == "__main__":
    unittest.main()

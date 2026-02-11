import type { HistoryItem } from "../../types/wrong-answer";
import { getRelativeDate } from "../../utils/wrong-answer-helpers";

interface HistoryPanelProps {
  historyItems: HistoryItem[];
  loadingHistory: boolean;
  onLoad: (item: HistoryItem) => void;
  onDelete: (historyId: number) => void;
}

function getProblemSetLabel(item: HistoryItem): string | null {
  if (item.problem_set_names && item.problem_set_names.length > 0) {
    return item.problem_set_names.join(", ");
  }
  if (item.problem_set_name) {
    return item.problem_set_name;
  }
  return null;
}

function HistoryItemCard({
  item,
  onLoad,
  onDelete,
}: {
  item: HistoryItem;
  onLoad: (item: HistoryItem) => void;
  onDelete: (historyId: number) => void;
}) {
  const psLabel = getProblemSetLabel(item);

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-3.5 transition-shadow hover:shadow-sm"
      data-testid={`history-item-${item.id}`}
    >
      <div className="mb-2">
        <p
          className="truncate text-sm font-medium text-gray-800"
          title={item.title}
        >
          {item.title}
        </p>
        {psLabel && (
          <p className="mt-0.5 truncate text-xs text-gray-400" title={psLabel}>
            {psLabel}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          문제 {item.total_problems}개 &middot; 학생 {item.student_count}명
          &middot; {getRelativeDate(item.created_at)}
        </span>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
            onClick={() => onLoad(item)}
            data-testid={`history-load-${item.id}`}
          >
            불러오기
          </button>
          <button
            type="button"
            className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
            onClick={() => onDelete(item.id)}
            data-testid={`history-delete-${item.id}`}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonItem() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-100 bg-white p-3.5">
      <div className="mb-2 space-y-1.5">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-3 w-2/5 rounded bg-gray-100" />
        <div className="flex gap-1.5">
          <div className="h-6 w-14 rounded bg-gray-100" />
          <div className="h-6 w-8 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}

export function HistoryPanel({
  historyItems,
  loadingHistory,
  onLoad,
  onDelete,
}: HistoryPanelProps) {
  return (
    <aside
      className="sticky top-0 h-screen overflow-hidden bg-gray-50 p-4"
      data-testid="history-panel"
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-800">최근 생성</h2>
        <p className="mt-0.5 text-xs text-gray-400">10일간 보관</p>
      </div>

      <div className="custom-scrollbar -mr-1 h-[calc(100vh-5rem)] space-y-2.5 overflow-y-auto pr-1">
        {loadingHistory ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : historyItems.length === 0 ? (
          <div
            className="py-8 text-center text-sm text-gray-400"
            data-testid="history-empty"
          >
            생성 기록이 없습니다
          </div>
        ) : (
          historyItems.map((item) => (
            <HistoryItemCard
              key={item.id}
              item={item}
              onLoad={onLoad}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </aside>
  );
}

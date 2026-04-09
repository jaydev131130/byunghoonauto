import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface ProblemSetOption {
  id: number;
  name: string;
  chapter_count?: number;
  total_problems?: number;
}

interface ProblemSetSearchDropdownProps {
  problemSets: ProblemSetOption[];
  multiple?: boolean;
  selectedId?: number | null;
  selectedIds?: number[];
  onSelect?: (id: number | null, name: string) => void;
  onToggle?: (id: number) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  helperText?: string;
  dataTestId?: string;
  getOptionTestId?: (problemSetId: number) => string;
}

function formatProblemSetMeta(problemSet: ProblemSetOption): string {
  const meta: string[] = [];

  if (typeof problemSet.chapter_count === "number") {
    meta.push(`${problemSet.chapter_count}단원`);
  }
  if (typeof problemSet.total_problems === "number") {
    meta.push(`${problemSet.total_problems}문제`);
  }

  return meta.join(" · ");
}

export default function ProblemSetSearchDropdown({
  problemSets,
  multiple = false,
  selectedId = null,
  selectedIds = [],
  onSelect,
  onToggle,
  disabled = false,
  loading = false,
  placeholder = "문제집을 선택하세요",
  searchPlaceholder = "문제집 검색",
  helperText,
  dataTestId,
  getOptionTestId,
}: ProblemSetSearchDropdownProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedOptions = useMemo(() => {
    if (multiple) {
      return selectedIds
        .map((id) => problemSets.find((problemSet) => problemSet.id === id))
        .filter((problemSet): problemSet is ProblemSetOption => Boolean(problemSet));
    }

    if (selectedId === null) {
      return [];
    }

    const selected = problemSets.find((problemSet) => problemSet.id === selectedId);
    return selected ? [selected] : [];
  }, [multiple, problemSets, selectedId, selectedIds]);

  const filteredProblemSets = useMemo(() => {
    if (!normalizedQuery) {
      return problemSets;
    }

    return problemSets.filter((problemSet) => {
      const searchableText = [
        problemSet.name,
        formatProblemSetMeta(problemSet),
        String(problemSet.id),
      ]
        .join(" ")
        .toLocaleLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [normalizedQuery, problemSets]);

  const triggerLabel = useMemo(() => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }

    if (!multiple) {
      return selectedOptions[0].name;
    }

    if (selectedOptions.length === 1) {
      return selectedOptions[0].name;
    }

    return `${selectedOptions.length}개 문제집 선택됨`;
  }, [multiple, placeholder, selectedOptions]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timerId = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isOpen]);

  const handleToggleOpen = () => {
    if (disabled) {
      return;
    }

    setIsOpen((prev) => {
      if (prev) {
        setQuery("");
      }
      return !prev;
    });
  };

  const handleOptionClick = (problemSet: ProblemSetOption) => {
    if (disabled) {
      return;
    }

    if (multiple) {
      onToggle?.(problemSet.id);
      return;
    }

    onSelect?.(problemSet.id, problemSet.name);
    setIsOpen(false);
    setQuery("");
  };

  const handleClearSingleSelection = () => {
    onSelect?.(null, "");
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={rootRef} data-testid={dataTestId}>
      <button
        type="button"
        onClick={handleToggleOpen}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          isOpen
            ? "border-blue-500 ring-1 ring-blue-500"
            : "border-gray-300 hover:border-gray-400"
        } ${disabled ? "cursor-not-allowed bg-gray-50 text-gray-400" : "bg-white text-gray-700"}`}
      >
        <div className="min-w-0">
          <div
            className={`truncate font-medium ${
              selectedOptions.length > 0 ? "text-gray-800" : "text-gray-500"
            }`}
          >
            {loading ? "불러오는 중..." : triggerLabel}
          </div>
          {helperText && (
            <div className="mt-1 truncate text-xs text-gray-400">{helperText}</div>
          )}
        </div>
        <svg
          className={`ml-3 h-4 w-4 shrink-0 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.169l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {multiple && selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedOptions.map((problemSet) => (
            <button
              key={problemSet.id}
              type="button"
              onClick={() => onToggle?.(problemSet.id)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
              data-testid={`selected-problem-set-${problemSet.id}`}
            >
              <span className="truncate">{problemSet.name}</span>
              <span aria-hidden="true">x</span>
            </button>
          ))}
        </div>
      )}

      {!multiple && selectedOptions.length > 0 && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleClearSingleSelection}
            className="text-xs text-gray-500 transition-colors hover:text-gray-700"
            data-testid="problem-set-clear-selection"
          >
            선택 해제
          </button>
        </div>
      )}

      {isOpen && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-3">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              data-testid={`${dataTestId ?? "problem-set-search"}-input`}
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-2" role="listbox">
            {loading ? (
              <div className="px-3 py-8 text-center text-sm text-gray-400">
                불러오는 중...
              </div>
            ) : filteredProblemSets.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-400">
                검색 결과가 없습니다.
              </div>
            ) : (
              filteredProblemSets.map((problemSet) => {
                const isSelected = multiple
                  ? selectedIdSet.has(problemSet.id)
                  : selectedId === problemSet.id;
                const metaLabel = formatProblemSetMeta(problemSet);

                return (
                  <button
                    key={problemSet.id}
                    type="button"
                    onClick={() => handleOptionClick(problemSet)}
                    disabled={disabled}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-900"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    data-testid={getOptionTestId?.(problemSet.id)}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-gray-300 bg-white text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      V
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {problemSet.name}
                      </span>
                      {metaLabel && (
                        <span className="mt-0.5 block text-xs text-gray-400">
                          {metaLabel}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

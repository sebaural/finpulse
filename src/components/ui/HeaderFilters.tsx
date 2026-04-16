interface FilterOption<T extends string> {
  key: T;
  label: string;
}

interface HeaderFiltersProps<CategoryKey extends string, PriorityKey extends string> {
  categoryFilter: CategoryKey;
  priorityFilter: PriorityKey;
  categoryOptions: Array<FilterOption<CategoryKey>>;
  priorityOptions: Array<FilterOption<PriorityKey>>;
  onCategoryChange: (value: CategoryKey) => void;
  onPriorityChange: (value: PriorityKey) => void;
}

export function HeaderFilters<CategoryKey extends string, PriorityKey extends string>({
  categoryFilter,
  priorityFilter,
  categoryOptions,
  priorityOptions,
  onCategoryChange,
  onPriorityChange,
}: HeaderFiltersProps<CategoryKey, PriorityKey>) {
  return (
    <div className="header-filters" aria-label="Filters">
      <label className="header-filter-field" htmlFor="priority-filter">
        <select
          id="priority-filter"
          className="header-filter-select"
          value={priorityFilter}
          onChange={(e) => onPriorityChange(e.target.value as PriorityKey)}
        >
          {priorityOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="header-filter-field" htmlFor="category-filter">
        <select
          id="category-filter"
          className="header-filter-select"
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value as CategoryKey)}
        >
          {categoryOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
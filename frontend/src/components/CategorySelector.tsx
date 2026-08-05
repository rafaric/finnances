import { CATEGORIES, type Category } from "./categories";

export type { Category } from "./categories";

interface CategorySelectorProps {
  value: Category;
  onChange: (category: Category) => void;
}

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  return (
    <fieldset>
      <legend>Categoría</legend>
      <div className="category-grid">
        {CATEGORIES.map(([category, label]) => (
          <button
            className={value === category ? "selected" : ""}
            key={category}
            type="button"
            onClick={() => onChange(category)}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

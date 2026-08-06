import { useEffect, useState } from "react";
import { type CategoriaResponseDTO, type SubcategoriaResponseDTO, type TipoCategoria } from "../api/types";
import { listCategorias, listSubcategorias } from "../api/client";

interface CategorySelectorProps {
  token: string;
  tipo: TipoCategoria;
  categoriaId?: string;
  subcategoriaId?: string;
  onCategoriaChange: (categoriaId?: string) => void;
  onSubcategoriaChange: (subcategoriaId?: string) => void;
}

export function CategorySelector({
  token,
  tipo,
  categoriaId,
  subcategoriaId,
  onCategoriaChange,
  onSubcategoriaChange,
}: CategorySelectorProps) {
  const [categorias, setCategorias] = useState<CategoriaResponseDTO[]>([]);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaResponseDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    listCategorias(token, { tipo, activa: true })
      .then(setCategorias)
      .finally(() => setIsLoading(false));
  }, [token, tipo]);

  useEffect(() => {
    if (!categoriaId) {
      setSubcategorias([]);
      return;
    }
    listSubcategorias(token, categoriaId).then(setSubcategorias);
  }, [token, categoriaId]);

  if (isLoading) return <div className="category-loading">Cargando categorías...</div>;

  return (
    <div className="category-selector">
      <fieldset>
        <legend>Categoría</legend>
        <div className="category-grid">
          {categorias.map((categoria) => (
            <button
              className={categoriaId === categoria.id ? "selected" : ""}
              key={categoria.id}
              type="button"
              onClick={() => {
                onCategoriaChange(categoria.id);
                onSubcategoriaChange(undefined);
              }}
            >
              <span className={`category-icon icon-${categoria.icono.toLowerCase()}`}></span>
              {categoria.nombre}
            </button>
          ))}
        </div>
      </fieldset>

      {categoriaId && (
        <div className="subcategory-section">
          <legend className="subcategory-legend">Subcategoría <span className="optional-hint">(opcional)</span></legend>
          <div className="subcategory-pills">
            <button
              className={!subcategoriaId ? "selected" : ""}
              type="button"
              onClick={() => onSubcategoriaChange(undefined)}
            >
              Sin subcategoría
            </button>
            {subcategorias.map((sub) => (
              <button
                className={subcategoriaId === sub.id ? "selected" : ""}
                key={sub.id}
                type="button"
                onClick={() => onSubcategoriaChange(sub.id)}
              >
                {sub.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

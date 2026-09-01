import { useEffect, useState } from "react";
import { type CategoriaResponseDTO, type SubcategoriaResponseDTO, type TipoCategoria } from "../api/types";
import { listCategorias, listSubcategorias } from "../api/client";
import { CategoryIcon } from "./CategoryIcon";

const OFFLINE_CATEGORIES: CategoriaResponseDTO[] = [
  ["cat-comida", "Comida", "UTENSILIOS_COCINA"],
  ["cat-transporte", "Transporte", "CARRO"],
  ["cat-vivienda", "Vivienda", "CASA"],
  ["cat-servicios", "Servicios", "TELEFONO"],
  ["cat-ocio", "Ocio", "CORAZON"],
  ["cat-deudas", "Deudas", "LLAVE"],
  ["cat-otros", "Otros", "OTRO"],
].map(([id, nombre, icono]) => ({ id, nombre, icono: icono as CategoriaResponseDTO["icono"], color: "VERDE", tipo: "GASTO", activa: true, createdAt: "", updatedAt: "" }));
const OFFLINE_INCOME_CATEGORIES: CategoriaResponseDTO[] = [
  ["cat-ingresos", "Ingresos", "LIBROS"],
  ["cat-sueldo", "Sueldo", "LIBROS"],
  ["cat-freelance", "Freelance", "AVION"],
  ["cat-otros-ingreso", "Otros", "OTRO"],
].map(([id, nombre, icono]) => ({ id, nombre, icono: icono as CategoriaResponseDTO["icono"], color: "VERDE", tipo: "INGRESO", activa: true, createdAt: "", updatedAt: "" }));

function cachedCategories(tipo: TipoCategoria): CategoriaResponseDTO[] {
  try {
    return JSON.parse(localStorage.getItem(`finnances.categories.${tipo}`) ?? "null") ?? [];
  } catch {
    return [];
  }
}

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
      .then((next) => {
        setCategorias(next);
        localStorage.setItem(`finnances.categories.${tipo}`, JSON.stringify(next));
      })
      .catch(() => {
        const cached = cachedCategories(tipo);
        setCategorias(cached.length ? cached : tipo === "GASTO" ? OFFLINE_CATEGORIES : OFFLINE_INCOME_CATEGORIES);
      })
      .finally(() => setIsLoading(false));
  }, [token, tipo]);

  useEffect(() => {
    if (!categoriaId) {
      setSubcategorias([]);
      return;
    }
     listSubcategorias(token, categoriaId, true).then(setSubcategorias).catch(() => setSubcategorias([]));
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
              <CategoryIcon icon={categoria.icono} color={categoria.color} />
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

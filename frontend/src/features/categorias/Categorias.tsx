import { useState, useEffect } from "react";
import { listCategorias, crearCategoria, actualizarCategoria, listSubcategorias, type CrearCategoriaInput } from "../../api/client";
import type { CategoriaResponseDTO, SubcategoriaResponseDTO } from "../../api/types";

interface CategoriasProps {
  token: string;
}

interface CategoriaCardProps {
  categoria: CategoriaResponseDTO;
  subcategorias: SubcategoriaResponseDTO[];
  token: string;
  onUpdated: () => void;
}

function CategoriaCard({ categoria, subcategorias, token, onUpdated }: CategoriaCardProps) {
  return (
    <article className={`categoria-card color-${categoria.color.toLowerCase()}`}>
      <div className="categoria-header">
        <span className={`category-icon icon-${categoria.icono.toLowerCase()}`}></span>
        <h3>{categoria.nombre}</h3>
        <span className={`tipo-badge tipo-${categoria.tipo.toLowerCase()}`}>{categoria.tipo === "GASTO" ? "Gasto" : "Ingreso"}</span>
      </div>
      <div className="categoria-subcategorias">
        {subcategorias.length > 0
          ? subcategorias.map((sub) => (
              <span key={sub.id} className="subcategoria-chip">{sub.nombre}</span>
            ))
          : <span className="sin-subcategoria">Sin subcategorías</span>
        }
      </div>
      <button
        className="archive-button"
        type="button"
        onClick={async () => {
          try {
            await actualizarCategoria(token, categoria.id, { activa: false });
            onUpdated();
          } catch (error) {
            console.error(error);
          }
        }}
      >
        Archivar
      </button>
    </article>
  );
}

export function Categorias({ token }: CategoriasProps) {
  const [gastoCategorias, setGastoCategorias] = useState<CategoriaResponseDTO[]>([]);
  const [ingresoCategorias, setIngresoCategorias] = useState<CategoriaResponseDTO[]>([]);
  const [subcategoriasMap, setSubcategoriasMap] = useState<Record<string, SubcategoriaResponseDTO[]>>({});
  const [activeTab, setActiveTab] = useState<"gastos" | "ingresos">("gastos");
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTipo, setCreateTipo] = useState<"GASTO" | "INGRESO">("GASTO");
  const [createNombre, setCreateNombre] = useState("");
  const [createIcono, setCreateIcono] = useState<CrearCategoriaInput["icono"]>("OTRO");
  const [createColor, setCreateColor] = useState<CrearCategoriaInput["color"]>("NEGRO");
  const [error, setError] = useState<string>();

  const icons: CrearCategoriaInput["icono"][] = [
    "UTENSILIOS_COCINA", "CARRO", "CASA", "LLAVE", "TELEFONO",
    "CORAZON", "OCULOS", "SUPER", "GIMNASIO", "LIBROS", "AVION", "OTRO",
  ];

  const colors: CrearCategoriaInput["color"][] = [
    "ROJO", "NARANJA", "AMARILLO", "VERDE", "AZUL",
    "INDIGO", "VIOLETA", "ROSA", "PEZ", "TURQUESA", "BLANCO", "NEGRO",
  ];

  async function loadCategorias() {
    setIsLoading(true);
    try {
      const [gastos, ingresos] = await Promise.all([
        listCategorias(token, { tipo: "GASTO", activa: true }),
        listCategorias(token, { tipo: "INGRESO", activa: true }),
      ]);
      setGastoCategorias(gastos);
      setIngresoCategorias(ingresos);

      const allActive = [...gastos, ...ingresos];
      const subs: Record<string, SubcategoriaResponseDTO[]> = {};
      await Promise.all(
        allActive.map(async (cat) => {
          const subs = await listSubcategorias(token, cat.id);
          return { id: cat.id, subs };
        }).map(async (p) => {
          const result = await p;
          subs[result.id] = result.subs;
        }),
      );
      setSubcategoriasMap(subs);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudieron cargar las categorías.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCategorias();
  }, [token]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!createNombre.trim()) return;
    try {
      await crearCategoria(token, {
        nombre: createNombre.trim(),
        icono: createIcono,
        color: createColor,
        tipo: createTipo,
      });
      setShowCreateModal(false);
      setCreateNombre("");
      await loadCategorias();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo crear la categoría.");
    }
  }

  const activeCategorias = activeTab === "gastos" ? gastoCategorias : ingresoCategorias;

  return (
    <section className="categorias-page">
      <div className="section-heading">
        <h2>Categorías</h2>
        <button
          className="primary-action"
          type="button"
          onClick={() => {
            setCreateTipo(activeTab === "gastos" ? "GASTO" : "INGRESO");
            setShowCreateModal(true);
          }}
        >
          + Nueva categoría
        </button>
      </div>

      <div className="tabs">
        <button
          className={activeTab === "gastos" ? "selected" : ""}
          type="button"
          onClick={() => setActiveTab("gastos")}
        >
          Gastos
        </button>
        <button
          className={activeTab === "ingresos" ? "selected" : ""}
          type="button"
          onClick={() => setActiveTab("ingresos")}
        >
          Ingresos
        </button>
      </div>

      {isLoading ? (
        <div className="loading-state">Cargando categorías...</div>
      ) : activeCategorias.length === 0 ? (
        <div className="empty-state">No hay categorías creadas.</div>
      ) : (
        <div className="categoria-list">
          {activeCategorias.map((categoria) => (
            <CategoriaCard
              key={categoria.id}
              categoria={categoria}
              subcategorias={subcategoriasMap[categoria.id] ?? []}
              token={token}
              onUpdated={loadCategorias}
            />
          ))}
        </div>
      )}

      {error ? <p className="notice">{error}</p> : null}

      {showCreateModal ? (
        <div className="modal-backdrop" role="presentation">
          <form className="categoria-form" onSubmit={handleCreate} aria-labelledby="create-categoria-title">
            <div className="section-heading">
              <h3 id="create-categoria-title">Nueva categoría</h3>
              <button
                className="icon-button"
                type="button"
                aria-label="Cerrar"
                title="Cerrar"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <label className="form-field">
              <span>Nombre</span>
              <input
                required
                maxLength={30}
                value={createNombre}
                onChange={(e) => setCreateNombre(e.target.value)}
                placeholder="Ej: Comida"
              />
              <small className="character-count">{createNombre.length}/30</small>
            </label>

            <label className="form-field">
              <span>Tipo</span>
              <select
                value={createTipo}
                onChange={(e) => setCreateTipo(e.target.value as "GASTO" | "INGRESO")}
              >
                <option value="GASTO">Gasto</option>
                <option value="INGRESO">Ingreso</option>
              </select>
            </label>

            <label className="form-field">
              <span>Ícono</span>
              <div className="icon-grid">
                {icons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={createIcono === icon ? "selected" : ""}
                    onClick={() => setCreateIcono(icon)}
                  >
                    <span className={`category-icon icon-${icon.toLowerCase()}`}></span>
                  </button>
                ))}
              </div>
            </label>

            <label className="form-field">
              <span>Color</span>
              <div className="color-grid">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch color-${color.toLowerCase()} ${createColor === color ? "selected" : ""}`}
                    onClick={() => setCreateColor(color)}
                  />
                ))}
              </div>
            </label>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button className="primary-action" type="submit">
                Crear
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

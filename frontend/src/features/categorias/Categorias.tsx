import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { listCategorias, crearCategoria, actualizarCategoria, listSubcategorias, crearSubcategoria, actualizarSubcategoria, type CrearCategoriaInput } from "../../api/client";
import type { CategoriaResponseDTO, IconoCategoria, SubcategoriaResponseDTO } from "../../api/types";
import { CategoryIcon } from "../../components/CategoryIcon";

interface CategoriasProps {
  token: string;
}

interface CategoriaCardProps {
  categoria: CategoriaResponseDTO;
  subcategorias: SubcategoriaResponseDTO[];
  token: string;
  onUpdated: () => void;
  onSubcategoryUpdated: () => void;
  onEdit: () => void;
  onEditSubcategory: (subcategoria: SubcategoriaResponseDTO) => void;
  onCreateSubcategory: () => void;
}

function CategoriaCard({ categoria, subcategorias, token, onUpdated, onSubcategoryUpdated, onEdit, onEditSubcategory, onCreateSubcategory }: CategoriaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <article className={`categoria-card color-${categoria.color.toLowerCase()}`}>
      <div className="categoria-header">
        <span className={`category-icon-shell category-color-${categoria.color.toLowerCase()}`}>
          <CategoryIcon icon={categoria.icono} color={categoria.color} size={24} />
        </span>
        <h3>{categoria.nombre} {categoria.uso ? <small>({categoria.uso} usos)</small> : null}</h3>
        <span className={`tipo-badge tipo-${categoria.tipo.toLowerCase()}`}>{categoria.tipo === "GASTO" ? "Gasto" : "Ingreso"}</span>
        <div className="categoria-actions">
          <button type="button" className="archive-button" onClick={onEdit}>Editar</button>
          <button type="button" className="archive-button" onClick={async () => { await actualizarCategoria(token, categoria.id, { activa: !categoria.activa }); onUpdated(); }}>{categoria.activa ? "Archivar" : "Reactivar"}</button>
          <button type="button" className="archive-button" onClick={onCreateSubcategory}>+ Subcategoría</button>
          {subcategorias.length ? <button type="button" className="subcategory-toggle" aria-label={isExpanded ? "Ocultar subcategorías" : "Mostrar subcategorías"} title={isExpanded ? "Ocultar subcategorías" : "Mostrar subcategorías"} aria-expanded={isExpanded} onClick={() => setIsExpanded((current) => !current)}>{isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button> : null}
        </div>
      </div>
      <div className={`categoria-subcategorias ${isExpanded ? "expanded" : "collapsed"}`}>
        {subcategorias.length > 0
          ? subcategorias.map((sub) => (
                <span key={sub.id} className={`subcategoria-chip ${sub.activa ? "" : "archived"}`}><span>{sub.nombre} {sub.uso ? `· ${sub.uso} usos` : ""}</span><button type="button" onClick={() => onEditSubcategory(sub)}>Editar</button><button type="button" onClick={async () => { await actualizarSubcategoria(token, sub.id, { activa: !sub.activa }); onSubcategoryUpdated(); }}>{sub.activa ? "Archivar" : "Reactivar"}</button></span>
            ))
          : <span className="sin-subcategoria">Sin subcategorías</span>
        }
      </div>
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
  const [editingCategoriaId, setEditingCategoriaId] = useState<string>();
  const [subcategoryModal, setSubcategoryModal] = useState<{ id?: string; categoriaId: string; nombre: string }>();
  const [isSavingSubcategory, setIsSavingSubcategory] = useState(false);

  const icons: IconoCategoria[] = [
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
        listCategorias(token, { tipo: "GASTO" }),
        listCategorias(token, { tipo: "INGRESO" }),
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
       const input = {
         nombre: createNombre.trim(),
        icono: createIcono,
        color: createColor,
        tipo: createTipo,
       };
       if (editingCategoriaId) await actualizarCategoria(token, editingCategoriaId, input);
       else await crearCategoria(token, input);
       setShowCreateModal(false);
       setEditingCategoriaId(undefined);
      setCreateNombre("");
      await loadCategorias();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo crear la categoría.");
    }
  }

  async function handleSubcategorySubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!subcategoryModal?.nombre.trim()) return;
    setIsSavingSubcategory(true);
    try {
      if (subcategoryModal.id) await actualizarSubcategoria(token, subcategoryModal.id, { nombre: subcategoryModal.nombre.trim() });
      else await crearSubcategoria(token, { nombre: subcategoryModal.nombre.trim(), categoriaId: subcategoryModal.categoriaId });
      setSubcategoryModal(undefined);
      await loadCategorias();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la subcategoría.");
    } finally {
      setIsSavingSubcategory(false);
    }
  }

  const activeCategorias = activeTab === "gastos" ? gastoCategorias : ingresoCategorias;

  function editCategoria(categoria: CategoriaResponseDTO) {
    setEditingCategoriaId(categoria.id); setCreateNombre(categoria.nombre); setCreateIcono(categoria.icono); setCreateColor(categoria.color); setCreateTipo(categoria.tipo); setShowCreateModal(true);
  }

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
           {activeCategorias.filter((categoria) => categoria.activa).map((categoria) => (
            <CategoriaCard
              key={categoria.id}
              categoria={categoria}
              subcategorias={subcategoriasMap[categoria.id] ?? []}
              token={token}
               onUpdated={loadCategorias}
               onSubcategoryUpdated={loadCategorias}
               onEdit={() => editCategoria(categoria)}
               onEditSubcategory={(subcategoria) => setSubcategoryModal({ id: subcategoria.id, categoriaId: categoria.id, nombre: subcategoria.nombre })}
               onCreateSubcategory={() => setSubcategoryModal({ categoriaId: categoria.id, nombre: "" })}
             />
           ))}
           {activeCategorias.some((categoria) => !categoria.activa) ? <><h3 className="archived-heading">Archivadas</h3>{activeCategorias.filter((categoria) => !categoria.activa).map((categoria) => <CategoriaCard key={categoria.id} categoria={categoria} subcategorias={subcategoriasMap[categoria.id] ?? []} token={token} onUpdated={loadCategorias} onSubcategoryUpdated={loadCategorias} onEdit={() => editCategoria(categoria)} onEditSubcategory={(subcategoria) => setSubcategoryModal({ id: subcategoria.id, categoriaId: categoria.id, nombre: subcategoria.nombre })} onCreateSubcategory={() => setSubcategoryModal({ categoriaId: categoria.id, nombre: "" })} />)}</> : null}
        </div>
      )}

      {error ? <p className="notice">{error}</p> : null}

      {showCreateModal ? (
        <div className="modal-backdrop" role="presentation">
          <form className="categoria-form" onSubmit={handleCreate} aria-labelledby="create-categoria-title">
            <div className="section-heading">
                 <h3 id="create-categoria-title">{editingCategoriaId ? "Editar categoría" : "Nueva categoría"}</h3>
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
                    aria-label={`Seleccionar ícono ${icon.toLowerCase().replaceAll("_", " ")}`}
                    title={icon.toLowerCase().replaceAll("_", " ")}
                    className={createIcono === icon ? "selected" : ""}
                    onClick={() => setCreateIcono(icon)}
                  >
                    <CategoryIcon icon={icon} size={22} />
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
                {editingCategoriaId ? "Guardar cambios" : "Crear categoría"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {subcategoryModal ? <div className="modal-backdrop" role="presentation"><form className="categoria-form" role="dialog" aria-modal="true" aria-labelledby="subcategory-modal-title" onSubmit={handleSubcategorySubmit}><div className="section-heading"><h3 id="subcategory-modal-title">{subcategoryModal.id ? "Editar subcategoría" : "Nueva subcategoría"}</h3><button className="icon-button" type="button" aria-label="Cerrar" title="Cerrar" onClick={() => setSubcategoryModal(undefined)}>✕</button></div><label className="form-field"><span>Nombre</span><input required maxLength={30} autoFocus value={subcategoryModal.nombre} onChange={(event) => setSubcategoryModal((current) => current ? { ...current, nombre: event.target.value } : current)} /><small className="character-count">{subcategoryModal.nombre.length}/30</small></label><div className="modal-actions"><button type="button" onClick={() => setSubcategoryModal(undefined)}>Cancelar</button><button className="primary-action" type="submit" disabled={isSavingSubcategory || !subcategoryModal.nombre.trim()}>{isSavingSubcategory ? "Guardando..." : "Guardar"}</button></div></form></div> : null}
    </section>
  );
}

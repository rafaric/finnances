import type { Categoria, Subcategoria } from "@prisma/client";

export interface CategoriaDTO {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  tipo: string;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toCategoriaDTO(categoria: Categoria): CategoriaDTO {
  return {
    id: categoria.id,
    nombre: categoria.nombre,
    icono: categoria.icono,
    color: categoria.color,
    tipo: categoria.tipo,
    activa: categoria.activa,
    createdAt: categoria.createdAt.toISOString(),
    updatedAt: categoria.updatedAt.toISOString(),
  };
}

export interface SubcategoriaDTO {
  id: string;
  nombre: string;
  categoriaId: string;
  categoria: CategoriaDTO;
}

export function toSubcategoriaDTO(
  subcategoria: Subcategoria & { categoria: Categoria },
): SubcategoriaDTO {
  return {
    id: subcategoria.id,
    nombre: subcategoria.nombre,
    categoriaId: subcategoria.categoriaId,
    categoria: toCategoriaDTO(subcategoria.categoria),
  };
}

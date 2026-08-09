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
  uso?: number;
}

export function toCategoriaDTO(categoria: Categoria, uso?: number): CategoriaDTO {
  return {
    id: categoria.id,
    nombre: categoria.nombre,
    icono: categoria.icono,
    color: categoria.color,
    tipo: categoria.tipo,
    activa: categoria.activa,
    createdAt: categoria.createdAt.toISOString(),
    updatedAt: categoria.updatedAt.toISOString(),
    uso,
  };
}

export interface SubcategoriaDTO {
  id: string;
  nombre: string;
  categoriaId: string;
  categoria: CategoriaDTO;
  activa: boolean;
  uso?: number;
}

export function toSubcategoriaDTO(
  subcategoria: Subcategoria & { categoria: Categoria },
  uso?: number,
): SubcategoriaDTO {
  return {
    id: subcategoria.id,
    nombre: subcategoria.nombre,
    categoriaId: subcategoria.categoriaId,
    categoria: toCategoriaDTO(subcategoria.categoria),
    activa: subcategoria.activa,
    uso,
  };
}

import {
  BookOpen,
  CarFront,
  Glasses,
  Heart,
  House,
  KeyRound,
  Package,
  Phone,
  Plane,
  ShoppingCart,
  Utensils,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";
import type { ColorCategoria, IconoCategoria } from "../api/types";

const CATEGORY_ICONS: Record<IconoCategoria, LucideIcon> = {
  UTENSILIOS_COCINA: Utensils,
  CARRO: CarFront,
  CASA: House,
  LLAVE: KeyRound,
  TELEFONO: Phone,
  CORAZON: Heart,
  OCULOS: Glasses,
  SUPER: ShoppingCart,
  GIMNASIO: Dumbbell,
  LIBROS: BookOpen,
  AVION: Plane,
  OTRO: Package,
};

const CATEGORY_COLORS: Record<ColorCategoria, string> = {
  ROJO: "#b94f43",
  NARANJA: "#c8752e",
  AMARILLO: "#a88719",
  VERDE: "#39794b",
  AZUL: "#3d6f9f",
  INDIGO: "#4e59a4",
  VIOLETA: "#7d4b91",
  ROSA: "#a65375",
  PEZ: "#2f8580",
  TURQUESA: "#2d8f8c",
  BLANCO: "#66756c",
  NEGRO: "#27352e",
};

interface CategoryIconProps {
  icon: IconoCategoria;
  color?: ColorCategoria;
  size?: number;
  className?: string;
}

export function CategoryIcon({ icon, color, size = 20, className = "category-icon" }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[icon] ?? Package;
  const colorClass = color ? ` category-icon-color-${color.toLowerCase()}` : "";
  return <Icon className={`${className}${colorClass}`} color={color ? CATEGORY_COLORS[color] : undefined} size={size} strokeWidth={1.8} aria-hidden="true" />;
}

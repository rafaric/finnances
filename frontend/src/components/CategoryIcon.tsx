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

interface CategoryIconProps {
  icon: IconoCategoria;
  color?: ColorCategoria;
  size?: number;
  className?: string;
}

export function CategoryIcon({ icon, color, size = 20, className = "category-icon" }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[icon] ?? Package;
  const colorClass = color ? ` category-icon-color-${color.toLowerCase()}` : "";
  return <Icon className={`${className}${colorClass}`} stroke={`${color}`} size={size} strokeWidth={1.8} aria-hidden="true" />;
}

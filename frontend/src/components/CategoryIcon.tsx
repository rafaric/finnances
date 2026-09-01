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
import type { IconoCategoria } from "../api/types";

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
  size?: number;
  className?: string;
}

export function CategoryIcon({ icon, size = 20, className = "category-icon" }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[icon] ?? Package;
  return <Icon className={className} size={size} strokeWidth={1.8} aria-hidden="true" />;
}

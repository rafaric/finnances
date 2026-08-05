export const CATEGORIES = [
  ["COMIDA", "Comida"],
  ["TRANSPORTE", "Transporte"],
  ["VIVIENDA", "Vivienda"],
  ["SERVICIOS", "Servicios"],
  ["OCIO", "Ocio"],
  ["DEUDAS", "Deudas"],
  ["OTROS", "Otros"],
] as const;

export type Category = (typeof CATEGORIES)[number][0];

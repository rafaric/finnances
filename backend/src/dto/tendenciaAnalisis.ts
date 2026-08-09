import type { TendenciaMesData } from "../services/tendenciaAnalisis";

export interface TendenciaMesDTO extends TendenciaMesData {}

export function toTendenciaMesDTO(data: TendenciaMesData): TendenciaMesDTO {
  return data;
}

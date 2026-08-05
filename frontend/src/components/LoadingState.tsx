interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Cargando..." }: LoadingStateProps) {
  return <p className="loading-state" role="status">{label}</p>;
}

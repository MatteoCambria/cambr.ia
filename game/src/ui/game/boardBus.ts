/** Pont entre le plateau (canvas) et les zones DOM pendant les glisser-déposer. */
export interface BoardPicker {
  /** uid de l'unité du joueur sous le point client, s'il y en a une. */
  unitAt(clientX: number, clientY: number): string | null;
}

/** Coordonnées écran (client) utiles aux tests automatisés. */
export interface BoardDebug {
  benchCenter(i: number): { x: number; y: number };
  hexCenter(col: number, row: number): { x: number; y: number };
}

export const boardBus: { picker: BoardPicker | null; debug: BoardDebug | null } = { picker: null, debug: null };

/** Pont entre le plateau (canvas) et les zones DOM pendant les glisser-déposer. */
export interface BoardPicker {
  /** uid de l'unité du joueur sous le point client, s'il y en a une. */
  unitAt(clientX: number, clientY: number): string | null;
}

export const boardBus: { picker: BoardPicker | null } = { picker: null };

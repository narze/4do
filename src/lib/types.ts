export type Q = 'inbox' | 'q1' | 'q2' | 'q3' | 'q4';

export interface Task {
	id: string;
	text: string;
	q: Q;
	done: boolean;
	/** Position on the sticky note board, 0..1 (only when q !== 'inbox'). */
	px?: number;
	py?: number;
}

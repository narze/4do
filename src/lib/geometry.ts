import type { Q } from './types';

export const QUADS: { q: Exclude<Q, 'inbox'>; name: string; sub: string; hint: string }[] = [
	{ q: 'q1', name: 'Do', sub: 'ด่วน + สำคัญ', hint: 'ทำเลย' },
	{ q: 'q2', name: 'Schedule', sub: 'สำคัญ ไม่ด่วน', hint: 'วางแผนทำ' },
	{ q: 'q3', name: 'Delegate', sub: 'ด่วน ไม่สำคัญ', hint: 'มอบหมาย' },
	{ q: 'q4', name: 'Eliminate', sub: 'ไม่ด่วน ไม่สำคัญ', hint: 'ตัดทิ้ง' }
];

export const uid = () => Math.random().toString(36).slice(2, 10);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Random spot inside a quadrant of the board (q1 top-left, q2 top-right, q3 bottom-left, q4 bottom-right). */
export function randomPos(q: Exclude<Q, 'inbox'>) {
	const left = q === 'q1' || q === 'q3';
	const top = q === 'q1' || q === 'q2';
	return {
		px: +(left ? rnd(0.1, 0.4) : rnd(0.6, 0.9)).toFixed(3),
		py: +(top ? rnd(0.14, 0.4) : rnd(0.6, 0.88)).toFixed(3)
	};
}

export function qFromPos(x: number, y: number): Exclude<Q, 'inbox'> {
	return x < 0.5 ? (y < 0.5 ? 'q1' : 'q3') : y < 0.5 ? 'q2' : 'q4';
}

/** Stable little tilt per note, -4..4 deg. */
export function tilt(id: string) {
	let h = 0;
	for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
	return (Math.abs(h) % 9) - 4;
}

export const inRect = (r: DOMRect, x: number, y: number) =>
	x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

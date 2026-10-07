import { randomPos, qFromPos, uid } from './geometry';
import type { Q, Task } from './types';

const KEY = 'eisenhower-todo-v1';

const SEED: Task[] = [
	{ id: uid(), text: 'ตัวอย่าง: แก้ bug production', q: 'q1', done: false },
	{ id: uid(), text: 'ตัวอย่าง: วางแผน roadmap ไตรมาสหน้า', q: 'q2', done: false },
	{ id: uid(), text: 'ตัวอย่าง: ตอบอีเมลทั่วไป', q: 'q3', done: false },
	{ id: uid(), text: 'ตัวอย่าง: เก็บของที่ไม่ได้ใช้', q: 'q4', done: false },
	{ id: uid(), text: 'ตัวอย่าง: ไอเดียที่ยังไม่จัด', q: 'inbox', done: false }
];

export class TodoStore {
	tasks = $state<Task[]>([]);
	selectedId = $state<string | null>(null);
	selected = $derived(this.tasks.find((t) => t.id === this.selectedId));
	openCount = $derived(this.tasks.filter((t) => !t.done).length);
	inbox = $derived(this.tasks.filter((t) => t.q === 'inbox'));
	placed = $derived(this.tasks.filter((t) => t.q !== 'inbox'));

	constructor() {
		let loaded: Task[] = [];
		try {
			loaded = JSON.parse(localStorage.getItem(KEY) || '[]');
		} catch {
			/* ignore */
		}
		if (!loaded.length) loaded = SEED;
		for (const t of loaded) if (t.q !== 'inbox' && t.px == null) Object.assign(t, randomPos(t.q));
		this.tasks = loaded;
	}

	/** Call inside an $effect — reads every field so it re-runs on any change. */
	persist() {
		try {
			localStorage.setItem(KEY, JSON.stringify(this.tasks));
		} catch {
			/* private mode etc. */
		}
	}

	byQ(q: Q) {
		return this.tasks.filter((t) => t.q === q);
	}

	add(text: string, q: Q) {
		const t: Task = { id: uid(), text, q, done: false };
		this.#place(t, q);
		this.tasks.push(t);
	}

	remove(id: string) {
		this.tasks = this.tasks.filter((t) => t.id !== id);
		if (this.selectedId === id) this.selectedId = null;
	}

	toggle(id: string) {
		const t = this.tasks.find((x) => x.id === id);
		if (t) t.done = !t.done;
	}

	clearDone() {
		this.tasks = this.tasks.filter((t) => !t.done);
	}

	/** Move to a quadrant (or inbox) at a given index among that quadrant's tasks. */
	move(id: string, q: Q, index?: number) {
		const t = this.tasks.find((x) => x.id === id);
		if (!t) return;
		const rest = this.tasks.filter((x) => x !== t);
		if (t.q !== q) this.#place(t, q);
		const ref = index == null ? undefined : rest.filter((x) => x.q === q)[index];
		if (ref) rest.splice(rest.indexOf(ref), 0, t);
		else rest.push(t);
		this.tasks = rest;
	}

	/** Free placement on the board: quadrant follows the position. */
	setPos(id: string, x: number, y: number) {
		const t = this.tasks.find((a) => a.id === id);
		if (!t) return;
		t.px = +x.toFixed(3);
		t.py = +y.toFixed(3);
		t.q = qFromPos(x, y);
	}

	#place(t: Task, q: Q) {
		t.q = q;
		if (q === 'inbox') {
			delete t.px;
			delete t.py;
		} else Object.assign(t, randomPos(q));
	}
}

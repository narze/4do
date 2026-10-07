<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { TodoStore } from '../store.svelte';
	import type { UI } from '../ui.svelte';
	import type { Q, Task } from '../types';
	import { QUADS } from '../geometry';

	let { store, ui }: { store: TodoStore; ui: UI } = $props();

	let matrix = $state<HTMLDivElement>();
	let active = $state(0);

	/* ---------- inline editing ---------- */
	let editingId = $state<string | null>(null);
	let draft = $state('');
	function startEdit(t: Task) {
		draft = t.text;
		editingId = t.id;
	}
	function commit() {
		if (editingId === null) return;
		const t = store.tasks.find((x) => x.id === editingId);
		if (t && draft.trim()) t.text = draft.trim();
		editingId = null;
	}
	function onEditKey(e: KeyboardEvent) {
		if (e.key === 'Enter') commit();
		else if (e.key === 'Escape') editingId = null;
	}
	function init(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	/* ---------- swipe carousel <-> tabs ---------- */
	function syncActive() {
		if (!matrix) return;
		const qs = [...matrix.querySelectorAll<HTMLElement>('[data-quad]')];
		if (matrix.scrollLeft + matrix.clientWidth >= matrix.scrollWidth - 4) {
			active = qs.length - 1;
			return;
		}
		let best = 0,
			bd = Infinity;
		qs.forEach((q, i) => {
			const d = Math.abs(q.offsetLeft - matrix!.scrollLeft);
			if (d < bd) {
				bd = d;
				best = i;
			}
		});
		active = best;
	}
	function goto(i: number) {
		const el = matrix?.querySelectorAll<HTMLElement>('[data-quad]')[i];
		if (el) matrix!.scrollTo({ left: el.offsetLeft, behavior: 'smooth' });
	}

	/* ---------- drag & drop (mouse + touch, pointer events) ---------- */
	type Drag = {
		id: string;
		text: string;
		x: number;
		y: number;
		dx: number;
		dy: number;
		w: number;
		target: Q | null;
		index: number;
	};
	let drag = $state<Drag | null>(null);
	let timer: ReturnType<typeof setInterval> | undefined;

	function start(e: PointerEvent, t: Task) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.preventDefault();
		const card = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-task]')!;
		const r = card.getBoundingClientRect();
		drag = {
			id: t.id,
			text: t.text,
			x: e.clientX,
			y: e.clientY,
			dx: e.clientX - r.left,
			dy: e.clientY - r.top,
			w: r.width,
			target: null,
			index: 0
		};
		if (matrix) matrix.style.scrollSnapType = 'none';
		addEventListener('pointermove', onMove);
		addEventListener('pointerup', onUp);
		addEventListener('pointercancel', onCancel);
		timer = setInterval(update, 16);
		update();
	}
	function onMove(e: PointerEvent) {
		if (!drag) return;
		drag.x = e.clientX;
		drag.y = e.clientY;
		update();
	}
	function update() {
		const d = drag;
		if (!d) return;
		// edge auto-scroll: sideways in the carousel, vertical for the page
		if (matrix) {
			const mr = matrix.getBoundingClientRect();
			if (matrix.scrollWidth > matrix.clientWidth + 2 && d.y > mr.top - 30 && d.y < mr.bottom + 30) {
				if (d.x < mr.left + 56) matrix.scrollLeft -= 16;
				else if (d.x > mr.right - 56) matrix.scrollLeft += 16;
			}
		}
		if (d.y < 70) scrollBy(0, -12);
		else if (innerHeight - d.y < 70) scrollBy(0, 12);

		let q: Q | null = null;
		for (const n of document.elementsFromPoint(d.x, d.y)) {
			const z = n.closest<HTMLElement>('[data-zone]');
			if (z) {
				q = z.dataset.zone as Q;
				break;
			}
			const qd = n.closest<HTMLElement>('[data-quad]');
			if (qd) {
				q = qd.dataset.quad as Q;
				break;
			}
		}
		d.target = q;
		if (!q) return;
		const zone = document.querySelector<HTMLElement>(`[data-zone="${q}"]`);
		const cards = [...(zone?.querySelectorAll<HTMLElement>('[data-task]') ?? [])].filter(
			(c) => c.dataset.task !== d.id
		);
		let idx = cards.length;
		for (let i = 0; i < cards.length; i++) {
			const b = cards[i].getBoundingClientRect();
			if (d.y < b.top + b.height / 2) {
				idx = i;
				break;
			}
		}
		d.index = idx;
	}
	function stop() {
		clearInterval(timer);
		removeEventListener('pointermove', onMove);
		removeEventListener('pointerup', onUp);
		removeEventListener('pointercancel', onCancel);
		if (matrix) matrix.style.scrollSnapType = '';
	}
	function onUp() {
		const d = drag;
		stop();
		drag = null;
		if (d?.target) store.move(d.id, d.target, d.index);
	}
	function onCancel() {
		stop();
		drag = null;
	}
	onDestroy(stop);
</script>

{#snippet card(t: Task)}
	<div class="task" class:done={t.done} class:dragging={drag?.id === t.id} data-task={t.id}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span class="grip" title="ลาก" onpointerdown={(e) => start(e, t)}>⠿</span>
		<input type="checkbox" checked={t.done} onchange={() => store.toggle(t.id)} />
		{#if editingId === t.id}
			<input class="edit" bind:value={draft} use:init onblur={commit} onkeydown={onEditKey} />
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<span
				class="txt"
				onclick={() => matchMedia('(pointer:coarse)').matches && startEdit(t)}
				ondblclick={() => startEdit(t)}>{t.text}</span
			>
		{/if}
		<button class="x" aria-label="ลบ" onclick={() => store.remove(t.id)}>×</button>
	</div>
{/snippet}

{#snippet zone(q: Q)}
	{@const list = store.byQ(q)}
	{@const vis = list.filter((x) => x.id !== drag?.id)}
	<div class="list" class:over={drag?.target === q} data-zone={q}>
		{#each list as t (t.id)}
			{#if drag?.target === q && vis[drag.index]?.id === t.id}<div class="drop-line"></div>{/if}
			{@render card(t)}
		{/each}
		{#if drag?.target === q && drag.index >= vis.length}<div class="drop-line"></div>{/if}
		{#if list.length === 0 && drag?.target !== q}
			<div class="empty">{q === 'inbox' ? 'ว่าง 🎉' : 'ลากงานมาวางที่นี่'}</div>
		{/if}
	</div>
{/snippet}

<div class="layout" class:zoom={ui.zoomList}>
	<section class="panel">
		<h2><span>Inbox</span><span>{store.inbox.length || ''}</span></h2>
		{@render zone('inbox')}
		<div class="hint">ลากที่ ⠿ ไปวางใน matrix หรือสลับลำดับได้อิสระ</div>
	</section>

	<section class="panel">
		<div class="tabs">
			{#each QUADS as qd, i (qd.q)}
				<button class={qd.q} class:on={active === i} onclick={() => goto(i)}>
					{qd.name}<i>{store.byQ(qd.q).filter((t) => !t.done).length}</i>
				</button>
			{/each}
		</div>
		<div class="matrix" bind:this={matrix} onscroll={() => requestAnimationFrame(syncActive)}>
			<div class="axis top-l">ด่วน</div>
			<div class="axis top-r">ไม่ด่วน</div>
			<div class="axis side-t">สำคัญ</div>
			<div class="axis side-b">ไม่สำคัญ</div>
			{#each QUADS as qd (qd.q)}
				<div class="quad {qd.q}" data-quad={qd.q}>
					<header><b>{qd.name}</b><span>{qd.sub} · {qd.hint}</span></header>
					{@render zone(qd.q)}
				</div>
			{/each}
		</div>
		<div class="foot">
			<span>แตะ/ดับเบิลคลิกข้อความเพื่อแก้ไข</span>
			<button onclick={() => store.clearDone()}>ลบที่เสร็จแล้ว</button>
		</div>
	</section>
</div>

{#if drag}
	<div class="task ghost" style:left="{drag.x - drag.dx}px" style:top="{drag.y - drag.dy}px" style:width="{drag.w}px">
		<span class="grip">⠿</span><span class="txt">{drag.text}</span>
	</div>
{/if}

<style>
	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 14px;
	}
	@media (min-width: 860px) {
		.layout {
			grid-template-columns: 280px 1fr;
		}
	}
	.matrix {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		padding-left: 22px;
		padding-top: 22px;
	}
	.axis {
		position: absolute;
		font-size: 11px;
		color: var(--mute);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.axis.top-l {
		top: 0;
		left: 22px;
		width: calc(50% - 16px);
		text-align: center;
	}
	.axis.top-r {
		top: 0;
		right: 0;
		width: calc(50% - 16px);
		text-align: center;
	}
	.axis.side-t,
	.axis.side-b {
		left: 0;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		text-align: center;
		width: 16px;
	}
	.axis.side-t {
		top: 22px;
		height: calc(50% - 16px);
	}
	.axis.side-b {
		bottom: 0;
		height: calc(50% - 16px);
	}
	.quad {
		border-radius: 12px;
		padding: 10px;
		min-height: 200px;
		display: flex;
		flex-direction: column;
		border: 1.5px solid transparent;
		min-width: 0;
	}
	.quad.q1 {
		background: var(--q1b);
		border-color: color-mix(in srgb, var(--q1) 35%, transparent);
	}
	.quad.q2 {
		background: var(--q2b);
		border-color: color-mix(in srgb, var(--q2) 35%, transparent);
	}
	.quad.q3 {
		background: var(--q3b);
		border-color: color-mix(in srgb, var(--q3) 35%, transparent);
	}
	.quad.q4 {
		background: var(--q4b);
		border-color: color-mix(in srgb, var(--q4) 35%, transparent);
	}
	.quad header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 6px;
		margin-bottom: 8px;
	}
	.quad header b {
		font-size: 14px;
	}
	.quad.q1 b {
		color: var(--q1);
	}
	.quad.q2 b {
		color: var(--q2);
	}
	.quad.q3 b {
		color: var(--q3);
	}
	.quad.q4 b {
		color: var(--q4);
	}
	.quad header span {
		font-size: 11px;
		color: var(--mute);
		text-align: right;
	}
	.list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 60px;
		border-radius: 8px;
	}
	.list.over {
		outline: 2px dashed var(--mute);
		outline-offset: 2px;
	}
	.task {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 9px 10px;
		display: flex;
		gap: 8px;
		align-items: flex-start;
		box-shadow: var(--shadow);
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
	}
	.grip {
		cursor: grab;
		color: var(--mute);
		padding: 4px 6px 4px 2px;
		touch-action: none;
		font-size: 18px;
		line-height: 1.1;
	}
	.txt {
		flex: 1;
		word-break: break-word;
		min-width: 0;
	}
	.edit {
		flex: 1;
		min-width: 0;
		font: inherit;
		font-size: 16px;
		padding: 2px 6px;
		border: 1px solid var(--mute);
		border-radius: 6px;
		background: var(--bg);
		color: var(--ink);
	}
	.task.done .txt {
		text-decoration: line-through;
		color: var(--mute);
	}
	.task input[type='checkbox'] {
		margin: 3px 0 0;
		width: 17px;
		height: 17px;
		accent-color: var(--ink);
	}
	.x {
		border: 0;
		background: none;
		color: var(--mute);
		font-size: 20px;
		line-height: 1;
		padding: 0 4px;
	}
	.x:hover {
		color: var(--q1);
	}
	.task.dragging {
		opacity: 0.3;
	}
	.ghost {
		position: fixed;
		z-index: 99;
		pointer-events: none;
		opacity: 0.92;
		transform: rotate(1.5deg);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
	}
	.drop-line {
		height: 3px;
		border-radius: 2px;
		background: var(--ink);
		margin: -2px 0;
	}
	.foot {
		display: flex;
		gap: 10px;
		justify-content: space-between;
		margin-top: 12px;
		font-size: 12px;
		color: var(--mute);
	}
	.foot button {
		border: 0;
		background: none;
		color: var(--mute);
		text-decoration: underline;
		padding: 0;
	}

	/* zoomed: one quadrant at a time, swipe sideways */
	.zoom :global(.tabs) {
		display: flex;
	}
	.zoom .matrix {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		gap: 10px;
		padding: 0;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-x: contain;
	}
	.zoom .matrix::-webkit-scrollbar {
		display: none;
	}
	.zoom .matrix::after {
		content: '';
		flex: 0 0 8%;
	}
	.zoom .quad {
		flex: 0 0 min(88%, 520px);
		scroll-snap-align: start;
		min-height: 360px;
	}
	.zoom .axis {
		display: none;
	}
	.zoom .task {
		font-size: 16px;
		padding: 12px;
	}

	/* zoomed out on a phone: the whole matrix at once, compact */
	@media (max-width: 859px) {
		.layout:not(.zoom) .matrix {
			gap: 6px;
			padding-left: 20px;
		}
		.layout:not(.zoom) .quad {
			padding: 6px;
			min-height: 150px;
		}
		.layout:not(.zoom) .quad header span {
			display: none;
		}
		.layout:not(.zoom) .task {
			padding: 6px;
			gap: 4px;
			font-size: 12.5px;
		}
		.layout:not(.zoom) .grip {
			padding: 2px 2px 2px 0;
			font-size: 15px;
		}
		.layout:not(.zoom) .task input[type='checkbox'] {
			width: 14px;
			height: 14px;
			margin-top: 2px;
		}
		.layout:not(.zoom) .x {
			padding: 0 2px;
		}
	}
</style>

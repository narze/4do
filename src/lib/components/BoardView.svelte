<script lang="ts">
	import { flushSync, onDestroy } from 'svelte';
	import type { TodoStore } from '../store.svelte';
	import type { UI } from '../ui.svelte';
	import type { Task } from '../types';
	import { QUADS, inRect, tilt } from '../geometry';
	import Detail from './Detail.svelte';

	let { store, ui }: { store: TodoStore; ui: UI } = $props();

	let bs = $state<HTMLDivElement>(); // scroll viewport
	let board = $state<HTMLDivElement>();
	let tray = $state<HTMLDivElement>();

	/* ---------- note size follows the zoom level ---------- */
	const zoomed = $derived(ui.bscale > 1.02);
	const textOn = $derived(ui.showText || ui.bscale >= 1.8);
	const size = $derived.by(() => {
		let s = zoomed ? Math.min(132, 38 + (ui.bscale - 1) * 32) : 38;
		if (textOn) s = Math.max(s, zoomed ? 84 : 92);
		return s;
	});
	const fs = $derived(Math.min(16, 11.5 + Math.max(0, size - 84) * 0.08));
	const lines = $derived(Math.max(2, Math.floor((size - fs * 1.2) / (fs * 1.25))));

	/* ---------- zoom: pinch, ctrl+wheel, button ---------- */
	export function toggleZoom() {
		flushSync(() => (ui.bscale = zoomed ? 1 : 2.2));
		if (zoomed && bs) {
			bs.scrollLeft = (bs.scrollWidth - bs.clientWidth) / 2;
			bs.scrollTop = (bs.scrollHeight - bs.clientHeight) / 2;
		}
	}
	function anchorAt(cx: number, cy: number) {
		const r = bs!.getBoundingClientRect();
		return {
			ux: (bs!.scrollLeft + cx - r.left) / board!.offsetWidth,
			uy: (bs!.scrollTop + cy - r.top) / board!.offsetHeight
		};
	}
	/** Set scale, keeping content point `a` under screen point (cx, cy). */
	function zoomTo(sc: number, cx: number, cy: number, a: { ux: number; uy: number }) {
		const r = bs!.getBoundingClientRect();
		flushSync(() => (ui.bscale = Math.min(4, Math.max(1, sc))));
		bs!.scrollLeft = a.ux * board!.offsetWidth - (cx - r.left);
		bs!.scrollTop = a.uy * board!.offsetHeight - (cy - r.top);
	}
	function wheelZoom(node: HTMLElement) {
		const h = (e: WheelEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			e.preventDefault();
			zoomTo(ui.bscale * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY, anchorAt(e.clientX, e.clientY));
		};
		node.addEventListener('wheel', h, { passive: false });
		return { destroy: () => node.removeEventListener('wheel', h) };
	}
	function goto(n: number) {
		const cx = (n % 2 ? 0.75 : 0.25) * board!.offsetWidth;
		const cy = (n < 2 ? 0.25 : 0.75) * board!.offsetHeight;
		bs!.scrollTo({ left: cx - bs!.clientWidth / 2, top: cy - bs!.clientHeight / 2, behavior: 'smooth' });
	}

	/* ---------- pointers on the viewport: one finger pans, two fingers pinch ---------- */
	const ptrs = new Map<number, { x: number; y: number }>();
	let pan: number | null = null;
	let pinch: { d: number; s: number; a: { ux: number; uy: number } } | null = null;

	function vpDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && (e.button !== 0 || e.target instanceof Element && e.target.closest('.pn'))) return;
		const onNote = e.target instanceof Element && !!e.target.closest('.pn');
		ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (ptrs.size === 2) {
			cancelNote();
			pan = null;
			const [a, b] = [...ptrs.values()];
			pinch = {
				d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
				s: ui.bscale,
				a: anchorAt((a.x + b.x) / 2, (a.y + b.y) / 2)
			};
		} else if (ptrs.size === 1 && !onNote) {
			pan = e.pointerId;
			try {
				bs!.setPointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
		}
	}
	function vpMove(e: PointerEvent) {
		const p = ptrs.get(e.pointerId);
		if (!p) return;
		const dx = e.clientX - p.x,
			dy = e.clientY - p.y;
		p.x = e.clientX;
		p.y = e.clientY;
		if (pinch && ptrs.size >= 2) {
			const [a, b] = [...ptrs.values()];
			zoomTo(
				(pinch.s * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d,
				(a.x + b.x) / 2,
				(a.y + b.y) / 2,
				pinch.a
			);
		} else if (pan === e.pointerId) {
			if (zoomed) {
				bs!.scrollLeft -= dx;
				bs!.scrollTop -= dy;
			} else scrollBy(0, -dy); // not zoomed: let the page scroll
		}
	}
	function vpEnd(e: PointerEvent) {
		ptrs.delete(e.pointerId);
		if (ptrs.size < 2) pinch = null;
		if (pan === e.pointerId) pan = null;
	}

	/* ---------- dragging a sticky note ---------- */
	type ND = {
		id: string;
		sx: number;
		sy: number;
		w: number;
		h: number;
		ox: number;
		oy: number;
		lx: number;
		ly: number;
		moved: boolean;
	};
	let nd: ND | null = null;
	let ndTimer: ReturnType<typeof setInterval> | undefined;
	let ghost = $state<{ t: Task; x: number; y: number; w: number; h: number } | null>(null);
	let over = $state<'board' | 'tray' | null>(null);

	function noteDown(e: PointerEvent, t: Task) {
		if (pinch) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		nd = {
			id: t.id,
			sx: e.clientX,
			sy: e.clientY,
			w: r.width,
			h: r.height,
			ox: e.clientX - (r.left + r.width / 2),
			oy: e.clientY - (r.top + r.height / 2),
			lx: e.clientX,
			ly: e.clientY,
			moved: false
		};
		addEventListener('pointermove', noteMove);
		addEventListener('pointerup', noteUp);
		addEventListener('pointercancel', cancelNote);
	}
	function noteMove(e: PointerEvent) {
		const d = nd;
		if (!d) return;
		if (!d.moved) {
			if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
			d.moved = true;
			ndTimer = setInterval(edgeScroll, 16);
		}
		d.lx = e.clientX;
		d.ly = e.clientY;
		const t = store.tasks.find((x) => x.id === d.id)!;
		ghost = { t, x: e.clientX - d.ox, y: e.clientY - d.oy, w: d.w, h: d.h };
		over = inRect(bs!.getBoundingClientRect(), e.clientX, e.clientY)
			? 'board'
			: inRect(tray!.getBoundingClientRect(), e.clientX, e.clientY)
				? 'tray'
				: null;
		if (e.clientY < 70) scrollBy(0, -10);
		else if (innerHeight - e.clientY < 70) scrollBy(0, 10);
	}
	function edgeScroll() {
		if (!nd || !zoomed || !bs) return;
		const r = bs.getBoundingClientRect();
		if (nd.ly < r.top - 30 || nd.ly > r.bottom + 30 || nd.lx < r.left - 30 || nd.lx > r.right + 30) return;
		if (nd.lx < r.left + 50) bs.scrollLeft -= 16;
		else if (nd.lx > r.right - 50) bs.scrollLeft += 16;
		if (nd.ly < r.top + 50) bs.scrollTop -= 16;
		else if (nd.ly > r.bottom - 50) bs.scrollTop += 16;
	}
	function ndCleanup() {
		clearInterval(ndTimer);
		removeEventListener('pointermove', noteMove);
		removeEventListener('pointerup', noteUp);
		removeEventListener('pointercancel', cancelNote);
		ghost = null;
		over = null;
		nd = null;
	}
	function cancelNote() {
		ndCleanup();
	}
	function noteUp() {
		const d = nd;
		ndCleanup();
		if (!d) return;
		if (!d.moved) {
			store.selectedId = d.id; // tap = select
			return;
		}
		if (inRect(bs!.getBoundingClientRect(), d.lx, d.ly)) {
			const br = board!.getBoundingClientRect();
			const x = Math.min(0.96, Math.max(0.04, (d.lx - d.ox - br.left) / br.width));
			const y = Math.min(0.96, Math.max(0.04, (d.ly - d.oy - br.top) / br.height));
			store.setPos(d.id, x, y);
		} else if (inRect(tray!.getBoundingClientRect(), d.lx, d.ly)) {
			store.move(d.id, 'inbox');
		} else return;
		store.selectedId = d.id;
	}
	onDestroy(ndCleanup);
</script>

{#snippet note(t: Task, placed: boolean)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="pn"
		class:placed
		class:txt={textOn}
		class:sel={store.selectedId === t.id}
		class:done={t.done}
		class:dragging={ghost?.t.id === t.id}
		data-q={t.q}
		title={t.text}
		style:--r="{tilt(t.id)}deg"
		style:left={placed ? `${(t.px ?? 0.5) * 100}%` : undefined}
		style:top={placed ? `${(t.py ?? 0.5) * 100}%` : undefined}
		onpointerdown={(e) => noteDown(e, t)}
	>
		<span>{t.text}</span>
	</div>
{/snippet}

<div
	class="bview"
	class:zoomb={zoomed}
	style:--ns="{size}px"
	style:--nfs="{fs}px"
	style:--lc={lines}
>
	<div class="bwrap">
		<div class="main">
			<div class="tabs bt">
				{#each QUADS as qd, i (qd.q)}
					<button onclick={() => goto(i)}>{qd.name}</button>
				{/each}
			</div>
			<div class="axes"><span>← ด่วน</span><span>ไม่ด่วน →</span></div>
			<div class="bouter">
				<div class="side"><span>สำคัญ ↑</span><span>ไม่สำคัญ ↓</span></div>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="bscroll"
					class:over={over === 'board'}
					bind:this={bs}
					use:wheelZoom
					onpointerdown={vpDown}
					onpointermove={vpMove}
					onpointerup={vpEnd}
					onpointercancel={vpEnd}
				>
					<div class="board" bind:this={board} style:width="{ui.bscale * 100}%">
						{#each QUADS as qd (qd.q)}
							<div class="bq {qd.q}">{qd.name}<small>{qd.sub} · {qd.hint}</small></div>
						{/each}
						<div class="notes">
							{#each store.placed as t (t.id)}
								{@render note(t, true)}
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="side-col">
			<section class="panel">
				<h2><span>Inbox</span><span>{store.inbox.length || ''}</span></h2>
				<div class="tray" class:over={over === 'tray'} bind:this={tray}>
					{#each store.inbox as t (t.id)}
						{@render note(t, false)}
					{:else}
						<div class="empty">ว่าง 🎉</div>
					{/each}
				</div>
				<div class="hint">ลาก sticky note ไปวางตรงไหนก็ได้บนบอร์ด · ลากกลับมาที่นี่เพื่อเก็บเข้า Inbox · จีบสองนิ้วเพื่อซูม</div>
				<label class="opt"><input type="checkbox" bind:checked={ui.showText} /> แสดงข้อความบน sticky note</label>
			</section>
			<Detail {store} />
		</div>
	</div>
</div>

{#if ghost}
	<div
		class="pn ghostn"
		class:txt={textOn}
		data-q={ghost.t.q}
		style:--r="{tilt(ghost.t.id)}deg"
		style:left="{ghost.x}px"
		style:top="{ghost.y}px"
		style:width="{ghost.w}px"
		style:height="{ghost.h}px"
		style:--ns="{size}px"
		style:--nfs="{fs}px"
		style:--lc={lines}
	>
		<span>{ghost.t.text}</span>
	</div>
{/if}

<style>
	.bwrap {
		display: grid;
		grid-template-columns: 1fr;
		gap: 14px;
	}
	@media (min-width: 860px) {
		.bwrap {
			grid-template-columns: 1fr 300px;
			align-items: start;
		}
	}
	.main {
		min-width: 0;
	}
	.side-col {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}
	.zoomb .bt {
		display: flex;
	}
	.axes {
		display: flex;
		justify-content: space-around;
		font-size: 11px;
		color: var(--mute);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		margin: 0 0 6px 18px;
	}
	.bouter {
		display: flex;
		gap: 4px;
	}
	.side {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-size: 11px;
		color: var(--mute);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		display: flex;
		justify-content: space-around;
		width: 14px;
		flex: none;
	}
	.bscroll {
		touch-action: none;
		flex: 1;
		min-width: 0;
		border: 1px solid var(--line);
		border-radius: 14px;
		overflow: hidden;
		background: var(--card);
	}
	.zoomb .bscroll {
		overflow: auto;
		max-height: min(76vh, 720px);
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}
	.board {
		position: relative;
		width: 100%;
		aspect-ratio: 1/1;
		background: var(--card);
	}
	@media (min-width: 860px) {
		.board {
			aspect-ratio: 1.1/1;
		}
	}
	.bscroll.over,
	.tray.over {
		outline: 2px dashed var(--mute);
		outline-offset: -4px;
	}
	.bq {
		position: absolute;
		width: 50%;
		height: 50%;
		padding: 8px 10px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.02em;
		pointer-events: none;
		opacity: 0.9;
	}
	.zoomb .bq {
		font-size: 15px;
		padding: 12px 14px;
	}
	.bq small {
		display: block;
		font-weight: 400;
		color: var(--mute);
		font-size: 10.5px;
	}
	.zoomb .bq small {
		font-size: 13px;
	}
	.bq.q1 {
		left: 0;
		top: 0;
		background: var(--q1b);
		color: var(--q1);
	}
	.bq.q2 {
		left: 50%;
		top: 0;
		background: var(--q2b);
		color: var(--q2);
		text-align: right;
	}
	.bq.q3 {
		left: 0;
		top: 50%;
		background: var(--q3b);
		color: var(--q3);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}
	.bq.q4 {
		left: 50%;
		top: 50%;
		background: var(--q4b);
		color: var(--q4);
		text-align: right;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}
	.notes {
		position: absolute;
		inset: 0;
	}

	/* sticky note */
	.pn {
		--s: var(--ns, 38px);
		width: var(--s);
		height: var(--s);
		border-radius: 3px 3px 3px 12px / 3px 3px 3px 12px;
		background: #ffe27a;
		box-shadow:
			0 2px 5px rgba(0, 0, 0, 0.22),
			inset 0 -10px 12px -10px rgba(0, 0, 0, 0.18);
		touch-action: none;
		cursor: grab;
		user-select: none;
		-webkit-user-select: none;
		position: relative;
		transform: rotate(var(--r, 0deg));
		overflow: hidden;
		flex: none;
		color: #2b2a22;
	}
	.pn[data-q='q1'] {
		background: #ff9f95;
	}
	.pn[data-q='q2'] {
		background: #92d6b2;
	}
	.pn[data-q='q3'] {
		background: #ffd37a;
	}
	.pn[data-q='q4'] {
		background: #c4cad3;
	}
	.pn[data-q='inbox'] {
		background: #fff09a;
	}
	.pn.placed {
		position: absolute;
		transform: translate(-50%, -50%) rotate(var(--r, 0deg));
	}
	.pn.sel {
		outline: 3px solid var(--ink);
		outline-offset: 2px;
		z-index: 5;
	}
	.pn.done {
		opacity: 0.5;
	}
	.pn.done::after {
		content: '✓';
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: calc(var(--s) * 0.5);
		color: rgba(0, 0, 0, 0.55);
	}
	.pn span {
		display: none;
	}
	.pn.txt span {
		display: -webkit-box;
		-webkit-line-clamp: var(--lc, 4);
		line-clamp: var(--lc, 4);
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: var(--nfs, 11.5px);
		line-height: 1.25;
		padding: 0.6em 0.6em 0;
		word-break: break-word;
	}
	.pn.ghostn {
		position: fixed;
		z-index: 99;
		pointer-events: none;
		transform: translate(-50%, -50%) rotate(var(--r, 0deg)) scale(1.1);
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
	}
	.pn.dragging {
		opacity: 0.25;
	}
	.tray {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		min-height: 64px;
		padding: 6px;
		border-radius: 10px;
		align-content: flex-start;
	}
	.tray .pn {
		--s: 44px;
	}
	.tray .pn.txt {
		--s: 84px;
	}
	.tray .pn.txt span {
		font-size: 11.5px;
		-webkit-line-clamp: 4;
		line-clamp: 4;
	}
	.tray .empty {
		width: 100%;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--mute);
		margin-top: 10px;
	}
	.opt input {
		width: 17px;
		height: 17px;
		accent-color: var(--ink);
	}
</style>

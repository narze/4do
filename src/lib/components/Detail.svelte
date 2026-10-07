<script lang="ts">
	import type { TodoStore } from '../store.svelte';
	import type { Q } from '../types';

	let { store }: { store: TodoStore } = $props();
	const CHIPS: [Q, string][] = [
		['inbox', 'Inbox'],
		['q1', 'Do'],
		['q2', 'Schedule'],
		['q3', 'Delegate'],
		['q4', 'Eliminate']
	];
	const t = $derived(store.selected);
</script>

<section class="panel">
	{#if t}
		<input
			type="text"
			value={t.text}
			onchange={(e) => {
				const v = e.currentTarget.value.trim();
				if (v) t.text = v;
			}}
		/>
		<div class="row">
			<label><input type="checkbox" checked={t.done} onchange={() => store.toggle(t.id)} /> เสร็จแล้ว</label>
			<button class="del" onclick={() => store.remove(t.id)}>ลบ</button>
		</div>
		<div class="chips">
			{#each CHIPS as [q, name] (q)}
				<button class:on={t.q === q} onclick={() => t.q !== q && store.move(t.id, q)}>{name}</button>
			{/each}
		</div>
	{:else}
		<div class="hint0">แตะ post-it เพื่อดูข้อความ แก้ไข หรือย้ายช่อง</div>
	{/if}
</section>

<style>
	.hint0 {
		color: var(--mute);
		font-size: 13px;
	}
	input[type='text'] {
		width: 100%;
		font: inherit;
		font-size: 16px;
		padding: 9px 11px;
		border: 1px solid var(--line);
		border-radius: 9px;
		background: var(--bg);
		color: var(--ink);
		margin-bottom: 8px;
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	label {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.del {
		margin-left: auto;
		border: 0;
		background: none;
		color: var(--q1);
		padding: 4px;
	}
	.chips {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 10px;
	}
	.chips button {
		border: 1.5px solid var(--line);
		background: var(--card);
		color: var(--ink);
		border-radius: 999px;
		padding: 5px 11px;
		font-size: 12.5px;
		font-weight: 600;
	}
	.chips button.on {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
</style>

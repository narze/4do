<script lang="ts">
	import type { TodoStore } from '../store.svelte';
	import type { Q } from '../types';

	let { store }: { store: TodoStore } = $props();
	let text = $state('');
	let q = $state<Q>('inbox');

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const v = text.trim();
		if (!v) return;
		store.add(v, q);
		text = '';
	}
</script>

<form class="add" onsubmit={submit}>
	<input type="text" bind:value={text} placeholder="เพิ่มงานใหม่…" autocomplete="off" required />
	<select bind:value={q} aria-label="เลือกช่อง">
		<option value="inbox">📥 Inbox (ยังไม่จัด)</option>
		<option value="q1">Do — ด่วน+สำคัญ</option>
		<option value="q2">Schedule — สำคัญ ไม่ด่วน</option>
		<option value="q3">Delegate — ด่วน ไม่สำคัญ</option>
		<option value="q4">Eliminate — ไม่ด่วน ไม่สำคัญ</option>
	</select>
	<button>เพิ่ม</button>
</form>

<style>
	form {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	input[type='text'] {
		flex: 1 1 220px;
		padding: 11px 14px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--card);
		color: var(--ink);
		font: inherit;
		font-size: 16px;
	}
	select {
		padding: 11px 10px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--card);
		color: var(--ink);
		font: inherit;
	}
	button {
		padding: 11px 18px;
		border: 0;
		border-radius: 10px;
		background: var(--ink);
		color: var(--bg);
		font-weight: 600;
	}
</style>

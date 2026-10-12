<script lang="ts">
	import { TodoStore } from '../lib/store.svelte';
	import { UI } from '../lib/ui.svelte';
	import AddForm from '../lib/components/AddForm.svelte';
	import ListView from '../lib/components/ListView.svelte';
	import BoardView from '../lib/components/BoardView.svelte';

	const store = new TodoStore();
	const ui = new UI();
	let board = $state<BoardView>();

	$effect(() => store.persist());
	$effect(() => ui.persist());

	const zoomOn = $derived(ui.view === 'list' ? ui.zoomList : ui.bscale > 1.02);
	function toggleZoom() {
		if (ui.view === 'list') ui.zoomList = !ui.zoomList;
		else board?.toggleZoom();
	}
</script>

<div class="wrap">
	<div class="top">
		<h1>4do <small>{store.openCount} ค้างอยู่</small></h1>
		<button class="zbtn" class:on={zoomOn} onclick={toggleZoom} title="ซูมเข้า/ออก">🔍 ซูม</button>
		<div class="seg">
			<button class:on={ui.view === 'board'} onclick={() => (ui.view = 'board')}>Sticky note</button>
			<button class:on={ui.view === 'list'} onclick={() => (ui.view = 'list')}>List</button>
		</div>
	</div>

	<AddForm {store} />

	{#if ui.view === 'list'}
		<ListView {store} {ui} />
	{:else}
		<BoardView {store} {ui} bind:this={board} />
	{/if}
</div>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}
	h1 {
		font-size: 20px;
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	h1 small {
		font-weight: 400;
		color: var(--mute);
		font-size: 13px;
	}
	.zbtn {
		margin-left: auto;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--ink);
		border-radius: 10px;
		padding: 7px 12px;
		font-weight: 600;
	}
	.zbtn.on {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
	.seg {
		display: flex;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 3px;
	}
	.seg button {
		border: 0;
		background: none;
		color: var(--mute);
		padding: 6px 14px;
		border-radius: 7px;
		font-weight: 600;
	}
	.seg button.on {
		background: var(--ink);
		color: var(--bg);
	}
</style>

const KEY = 'eisenhower-ui-v1';

export class UI {
	view = $state<'list' | 'board'>('list');
	/** List: swipe one quadrant at a time (true) or whole 2×2 matrix (false). */
	zoomList = $state(false);
	/** Board scale 1..4 (pinch to zoom). */
	bscale = $state(1);
	showText = $state(false);

	constructor() {
		this.zoomList = matchMedia('(max-width: 859px)').matches;
		try {
			const s = JSON.parse(localStorage.getItem(KEY) || 'null');
			if (s) {
				if (s.view === 'list' || s.view === 'board') this.view = s.view;
				if (typeof s.zoomList === 'boolean') this.zoomList = s.zoomList;
				if (typeof s.bscale === 'number') this.bscale = Math.min(4, Math.max(1, s.bscale));
				if (typeof s.showText === 'boolean') this.showText = s.showText;
			}
		} catch {
			/* ignore */
		}
	}

	persist() {
		try {
			localStorage.setItem(
				KEY,
				JSON.stringify({
					view: this.view,
					zoomList: this.zoomList,
					bscale: +this.bscale.toFixed(3),
					showText: this.showText
				})
			);
		} catch {
			/* ignore */
		}
	}
}

// This just gets us syntax highlighting in the template string.
function html([markup]) {
	return markup;
}

const TEMPLATE = html`
	<style>
		:host {
			/* These can be modified from the outside. */
			--gap: 0.5ch;
			--track-width: 1em;
			--track-fill: #8888;
			--value-fill: currentColor;

			display: block;
		}

		#container {
			position: relative;
		}

		#svg {
			display: block;
		}

		#track {
			fill: none;
			stroke: white; /* This is the mask. */
			stroke-linecap: round;
			stroke-width: var(--track-width);
		}

		#track-fill {
			fill: none;
			stroke: var(--track-fill);
			stroke-linecap: round;
			stroke-width: calc(var(--track-width) * 1.01);
		}

		#value-fill {
			fill: none;
			stroke: var(--value-fill);
			stroke-linecap: round;
			stroke-width: calc(var(--track-width) * 1.01);
		}

		#content {
			align-items: center;
			bottom: 0;
			display: flex;
			flex-direction: column;
			justify-content: center;
			left: var(--track-width);
			position: absolute;
			right: var(--track-width);
			text-align: center;
			top: calc(var(--track-width) * 3); /* TODO: This should be about the icon's height. */
		}

		#slotted {
			align-items: center;
			display: flex;
			flex: 1 1;
			flex-direction: column;
			justify-content: center;
			overflow: hidden;
		}
	</style>

	<div id="gap-detector" style="width: var(--gap)"></div>
	<div id="track-width-detector" style="width: var(--track-width);"></div>

	<div id="container">
		<svg id="svg">
			<defs>
				<mask id="track-mask">
					<path id="track"></path>
				</mask>
			</defs>

			<path id="track-fill" style="mask: url(#track-mask);"></path>
			<path id="value-fill" style="mask: url(#track-mask);"></path>
		</svg>

		<div id="content">
			<div id="slotted">
				<div>
					<slot></slot>
				</div>
			</div>

			<div id="slotted-icon">
				<slot name="icon"></slot>
			</div>
		</div>
	</div>
`;

export default class Gauge extends HTMLElement {
	static get observedAttributes() {
		return ['value', 'max', 'ticks'];
	}

	set value(value) {
		this.setAttribute('value', value);
	}

	get value() {
		if (this.hasAttribute('value')) {
			return parseFloat(this.getAttribute('value'));
		} else {
			return 1;
		}
	}

	set max (max) {
		this.setAttribute('max', max);
	}

	get max() {
		if (this.hasAttribute('max')) {
			return parseFloat(this.getAttribute('max'));
		} else {
			return 1;
		}
	}

	set ticks(ticks) {
		if (!Array.isArray(ticks)) {
			ticks = String(ticks).split(',');
		}

		this.setAttribute('ticks', ticks.filter(t => t < this.max).sort((a, b) => a - b).join(', '));
	}

	get ticks() {
		if (this.hasAttribute('ticks')) {
			return this.getAttribute('ticks').split(',').map(parseFloat).sort((a, b) => a - b);
		} else {
			return [];
		}
	}

	constructor() {
		super();

		const shadowRoot = this.attachShadow({ mode: 'open' });
		shadowRoot.innerHTML = TEMPLATE;

		// TODO: Put a ResizeObserver on the CSS length detectors.
		this.trackWidthDetector = this.shadowRoot.getElementById('track-width-detector');
		this.gapDetector = this.shadowRoot.getElementById('gap-detector');
		this.svg = this.shadowRoot.getElementById('svg');
		this.trackMask = this.shadowRoot.getElementById('track');
		this.trackFill = this.shadowRoot.getElementById('track-fill');
		this.valueFill = this.shadowRoot.getElementById('value-fill');
		this.iconContainer = this.shadowRoot.getElementById('slotted-icon');
	}

	connectedCallback() {
		this.update();
	}

	attributeChangedCallback() {
		this.update();
	}

	update() {
		this._radius = this.offsetWidth / 2;
		this._iconWidth = this.iconContainer.offsetWidth;
		this._trackWidth = this.trackWidthDetector.offsetWidth;
		this._fullGap = this.gapDetector.offsetWidth + this._trackWidth;

		this._arcPath = `
			M 0 0
			A ${this._radius} ${this._radius} 0 1 1 ${this._iconWidth + (this._trackWidth + this._fullGap) * 2} 0
		`;

		this._updateTrack();
		this._updateFill();
		this._updateView();
	}

	_updateTrack() {
		this.trackMask.setAttribute('d', this._arcPath);
		this.trackFill.setAttribute('d', this._arcPath);

		const segments = this.ticks.map((tick, i) => {
			const previous = i === 0 ? 0 : this.ticks[i - 1];
			return tick - previous;
		});

		let sumBeforeTicks = segments.reduce((total, segment) => total + segment, 0);
		segments.push(this.max - sumBeforeTicks);

		const segmentTrim = this._fullGap * this.ticks.length / segments.length;

		const trackLength = this.trackMask.getTotalLength() + this._trackWidth;

		const dashArray = segments.filter(segment => {
			return segment > 0 && segment < this.max;
		}).map(segment => {
			return [
				(segment / this.max) * trackLength - segmentTrim,
				segmentTrim
			];
		}).flat();

		if (dashArray.some(length => length < 0)) {
			console.warn(`Ticks ${this.ticks.join(', ')} don't fit at these dimensions.`);
			this.trackMask.style.strokeDasharray = '';
		} else {
			this.trackMask.style.strokeDasharray = dashArray.join(',');
		}
	}

	_updateFill() {
		this.valueFill.setAttribute('d', this._arcPath);
		const fillAmount = this.value / this.max;
		const fillPathLength = this.valueFill.getTotalLength();
		const gapAllowance = (1 - fillAmount) * this._fullGap;
		const strokeLength = Math.max(0, fillAmount * fillPathLength) - gapAllowance;
		this.valueFill.style.strokeDasharray = `${strokeLength} 9999999`;
	}

	_updateView() {
		const trackBox = this.valueFill.getBBox();
		const iconHeight = this.iconContainer.offsetHeight;

		this.svg.setAttribute('viewBox', [
			trackBox.x - this._trackWidth / 2,
			trackBox.y - this._trackWidth / 2,
			trackBox.width + this._trackWidth,
			trackBox.height + this._trackWidth + iconHeight / 2
		].join(' '));
	}
}

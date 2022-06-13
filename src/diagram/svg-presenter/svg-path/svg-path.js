import { svgPositionSet, svgRotate } from '../../infrastructure/svg-utils.js';
import { shapeStateAdd, shapeStateDel } from '../../shape-utils.js';
import { stateClassSync } from '../svg-presenter-utils.js';

/** @implements {IPresenterPath} */
export class SvgPath {
	/**
	 * @param {object} param
	 * @param {SVGPathElement} param.svgEl
	 * @param {PresenterPathEnd} param.start
	 * @param {PresenterPathEnd} param.end
	 * @param {IPresenterConnector} param.startConnector
	 * @param {IPresenterConnector} param.endConnector
	 */
	constructor({ svgEl, start, end, startConnector, endConnector }) {
		/** @type {DiagramElementType} */
		this.type = 'path';
		/** @type {SVGGElement} */
		this.svgEl = svgEl;

		/**
		 * @type {SVGPathElement}
		 * @private
		 */
		this._path = svgEl.querySelector('[data-key="path"]');

		/**
		 * @type {SVGGraphicsElement}
		 * @private
		 */
		this._arrow = svgEl.querySelector('[data-key="arrow"]');

		/**
		 * @type {Set<DiagramShapeState>}
		 * @private
		 */
		this._state = new Set();

		this.start = startConnector;
		this.end = endConnector;

		this._start = start;
		this._end = end;

		this._pathUpdate();
		this._arrowUpdate();
	}

	/**
	 * @param {DiagramShapeState} state
	 * @returns {boolean}
	 */
	stateHas(state) { return this._state.has(state); }

	/** @returns {Set<DiagramShapeState>} */
	stateGet() { return new Set(this._state); }

	/**
	 * @param {PresenterPathUpdateParam} param
	 * @returns {void}
	 */
	update(param) {
		if (param.start) { Object.assign(this._start, param.start); }
		if (param.end) { Object.assign(this._end, param.end); this._arrowUpdate(); }
		if (param.start || param.end) {
			this._pathUpdate();
		}

		if (param.endConnector) { this.end = param.endConnector; }
		if (param.startConnector) { this.start = param.startConnector; }

		if (param.state) {
			this._state = param.state;

			stateClassSync(this._state, this.svgEl, 'selected');
			if (param.state.has('selected')) {
				this._selectedPath = /** @type {SVGPathElement} */(this._path.cloneNode());
				this._selectedPath.classList.add('selected');
				this.svgEl.append(this._selectedPath);

				shapeStateAdd(this.end.shape.connectable ? this.end.shape : this.end, 'selected');
			} else {
				if (this._selectedPath) { this._selectedPath.remove(); }
				shapeStateDel(this.end.shape.connectable ? this.end.shape : this.end, 'selected');
			}
		}
	}

	/** @private */
	_pathUpdate() {
		this._path.setAttribute('d', SvgPath._calcDAttr(70, this._start, this._end));
	}

	_arrowUpdate() {
		svgPositionSet(this._arrow, this._end.position);
		svgRotate(this._arrow,
			this._end.dir === 'right'
				? 180
				: this._end.dir === 'left'
					? 0
					: this._end.dir === 'bottom'
						? 270
						: 90);
	}

	/**
	 * @param {number} coef
	 * @param {PresenterPathEnd} start
	 * @param {PresenterPathEnd} end
	 * @returns {string}
	 * @private
	 */
	static _calcDAttr(coef, start, end) {
		return `M ${start.position.x} ${start.position.y} C ${SvgPath._cx(start.dir, start.position.x, coef)} ${SvgPath._cy(start.dir, start.position.y, coef)}, ` +
			`${SvgPath._cx(end.dir, end.position.x, coef)} ${SvgPath._cy(end.dir, end.position.y, coef)}, ${end.position.x} ${end.position.y}`;
	}

	/**
	 * @param {DiagramPathEndDirection} dir
	 * @param {number} x
	 * @param {number} coef
	 * @return {number}
	 * @private
	 */
	static _cx(dir, x, coef) {
		return (dir === 'right' || dir === 'left')
			? dir === 'right' ? x + coef : x - coef
			: x;
	}

	/**
	 * @param {DiagramPathEndDirection} dir
	 * @param {number} y
	 * @param {number} coef
	 * @return {number}
	 * @private
	 */
	static _cy(dir, y, coef) {
		return (dir === 'right' || dir === 'left')
			? y
			: dir === 'bottom' ? y + coef : y - coef;
	}
}

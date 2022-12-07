import { classAdd, classDel, classHas, evtCanvasPoint } from '../infrastructure/util.js';
import { moveEvtProc } from '../infrastructure/move-evt-proc.js';
import { path } from './path.js';
import { textareaCreate } from '../infrastructure/svg-text-area.js';
import { settingsPnlCreate } from './shape-settings.js';

/**
 * provides:
 *  - shape move
 *  - connectors
 *  - text editor
 *  - standard edit panel
 *  - onTextChange callback
 * @param {HTMLElement} svg
 * @param {CanvasData} canvasData
 * @param {SVGGraphicsElement} svgGrp
 * @param {{position: Point, title?: string}} shapeData
 * @param {ConnectorsData} connectorsInnerPosition
 * @param {SVGTextElement} textEl
 * @param {{():void}} onTextChange
 * @param {{(evt:CustomEvent<{cmd:string, arg:string}>):void}} onCmd
 */
export function shapeEditEvtProc(svg, canvasData, svgGrp, shapeData, connectorsInnerPosition, textEl, onTextChange, onCmd) {
	/** @type {{():void}} */
	let textEditorDel;

	/** @type { {position:(bottomX:number, bottomY:number)=>void, del:()=>void} } */
	let settingsPnl;

	const shapeProc = shapeEvtProc(svg, canvasData, svgGrp, shapeData.position, connectorsInnerPosition,
		// onEdit
		() => {
			textEditorDel = textareaCreate(textEl, 0, shapeData.title, onTxtChange, onTxtChange);

			const position = svgGrp.getBoundingClientRect();
			settingsPnl = settingsPnlCreate(position.left + 10, position.top + 10, onCmd);
		},
		// onEditStop
		del
	);

	function del() {
		if (textEditorDel) { textEditorDel(); textEditorDel = null; }
		settingsPnl?.del(); settingsPnl = null;
	}

	/** @param {string} txt */
	function onTxtChange(txt) {
		shapeData.title = txt;
		onTextChange();
	}

	return {
		draw: () => {
			if (settingsPnl) {
				const position = svgGrp.getBoundingClientRect();
				settingsPnl.position(position.left + 10, position.top + 10);
			}
			shapeProc.draw();
		},
		del: () => {
			del();
			shapeProc.del();
		}
	};
}

/**
 * provides:
 *  - shape move
 *  - connectors
 *  - onEdit, onEditStop callbacks
 * @param {HTMLElement} svg
 * @param {CanvasData} canvasData
 * @param {SVGGraphicsElement} svgGrp
 * @param {Point} shapePosition
 * @param {ConnectorsData} connectorsInnerPosition
 * @param {{():void}} onEdit
 * @param {{():void}} onEditStop
 */
function shapeEvtProc(svg, canvasData, svgGrp, shapePosition, connectorsInnerPosition, onEdit, onEditStop) {
	/** @type {ConnectorsData} */
	const connectorsData = JSON.parse(JSON.stringify(connectorsInnerPosition));

	/** @type { Set<Path> } */
	const paths = new Set();

	function draw() {
		svgGrp.style.transform = `translate(${shapePosition.x}px, ${shapePosition.y}px)`;

		// paths
		for (const connectorKey in connectorsInnerPosition) {
			connectorsData[connectorKey].position = {
				x: connectorsInnerPosition[connectorKey].position.x + shapePosition.x,
				y: connectorsInnerPosition[connectorKey].position.y + shapePosition.y
			};
		}

		for (const path of paths) {
			path.draw();
		}
	};

	function unSelect() {
		// in edit mode
		if (classHas(svgGrp, 'highlight')) { onEditStop(); }

		classDel(svgGrp, 'select');
		classDel(svgGrp, 'highlight');
	}

	const moveProcReset = moveEvtProc(
		svg,
		svgGrp,
		canvasData,
		shapePosition,
		// onMoveStart
		/** @param {PointerEvent & { target: Element} } evt */
		evt => {
			unSelect();

			const connectorKey = evt.target.getAttribute('data-connect');
			if (connectorKey) {
				moveProcReset();

				const pathShape = path(svg, canvasData, {
					startShape: { shapeEl: svgGrp, connectorKey },
					end: {
						dir: reversDir(connectorsData[connectorKey].dir),
						position: evtCanvasPoint(canvasData, evt)
					}
				});
				svgGrp.parentNode.append(pathShape.elem);
				pathShape.pointerCapture(evt);
				paths.add(pathShape);
			}
		},
		// onMove
		draw,
		// onMoveEnd
		_ => {
			placeToCell(shapePosition, canvasData.cell);
			draw();
		},
		// onClick
		() => {
			// in edit mode
			if (classHas(svgGrp, 'highlight')) { return; }

			// to edit mode
			if (classHas(svgGrp, 'select') && !classHas(svgGrp, 'highlight')) {
				classDel(svgGrp, 'select');
				classAdd(svgGrp, 'highlight');
				// edit mode
				onEdit();
				return;
			}

			// to select mode
			classAdd(svgGrp, 'select');
		},
		// onOutdown
		unSelect);

	/** @type {Shape} */
	const thisShape = {
		/**
		 * @param {string} connectorKey
		 * @param {Path} pathShape
		 */
		pathAdd: function(connectorKey, pathShape) {
			paths.add(pathShape);
			return connectorsData[connectorKey];
		},

		/** @param {Path} pathShape */
		pathDel: function(pathShape) {
			paths.delete(pathShape);
		}
	};

	svgGrp[ShapeSmbl] = thisShape;

	return {
		draw,
		del: () => {
			moveProcReset();
			for (const path of paths) {
				path.del();
			}
		}
	};
}

/**
 * @param {Point} shapePosition
 * @param {number} cell
 */
function placeToCell(shapePosition, cell) {
	const cellSizeHalf = cell / 2;
	function placeToCell(coordinate) {
		const coor = (Math.round(coordinate / cell) * cell);
		return (coordinate - coor > 0) ? coor + cellSizeHalf : coor - cellSizeHalf;
	}

	shapePosition.x = placeToCell(shapePosition.x);
	shapePosition.y = placeToCell(shapePosition.y);
}

/**
 * @param {PathDir} pathDir
 * @return {PathDir}
 */
function reversDir(pathDir) {
	return pathDir === 'left'
		? 'right'
		: pathDir === 'right'
			? 'left'
			: pathDir === 'top' ? 'bottom' : 'top';
}

/** @typedef { {x:number, y:number} } Point */
/** @typedef { {position:Point, scale:number, cell:number} } CanvasData */

/** @typedef { 'left' | 'right' | 'top' | 'bottom' } PathDir */
/** @typedef { {position: Point, dir: PathDir} } PathEnd */
/** @typedef { Object.<string, PathEnd> } ConnectorsData */

export const ShapeSmbl = Symbol('shape');
/**
 * @typedef {{
 * pathAdd(connectorKey:string, pathShape:Path):PathEnd
 * pathDel(pathShape:Path):void
 * }} Shape
 */
/** @typedef {Element & { [ShapeSmbl]?: Shape }} DgrmElement */
/** @typedef {import('./path.js').Path} Path */

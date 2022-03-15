import { svgDiagramCreate } from './svg-diagram-factory.js';
import { connectorEqual, textContentTrim } from './index-helpers.js';
import { serialize } from './serialize/serialize.js';

// elements
import './elements/panel/panel.js';

//
// html bind

const panel = /** @type {IPanel} */(document.getElementById('panel'))
	.on('shapeAddByKey', /** @param {CustomEvent<string>} evt */ evt => shapeAddByKey(evt.detail))
	.on('shapeDel', shapeDel)
	.on('shapeType', /** @param {CustomEvent<string>} evt */ evt => shapeUpdate(evt.detail))
	.on('generateLink', generateLink);

//
// logic

/** @type {Map<IDiagramShape, SerializeShape<string>>} */
const shapeData = new Map();

/** @type {IDiagramEventConnectDetail[]} */
let connectors = [];

/** @type {IDiagramShape} */
let selectedShape;

/** @ts-ignore */
const diagram = svgDiagramCreate(document.getElementById('diagram'))
	.on('select', /** @param { CustomEvent<IDiagramEventSelectDetail> } evt */ evt => shapeSelect(evt.detail.target))
	.on('connect', /** @param { CustomEvent<IDiagramEventConnectDetail> } evt */ evt => connectors.push(evt.detail))
	.on('disconnect', /** @param { CustomEvent<IDiagramEventConnectDetail> } evt */ evt =>
		connectors.splice(connectors.findIndex(el => connectorEqual(el, evt.detail)), 1));

/**
 * @param {SerializeShape} param
 * @returns {IDiagramShape}
 */
function shapeAdd(param) {
	param.props = {
		text: { textContent: textContentTrim(param.templateKey, param.detail) }
	};
	const shape = diagram.shapeAdd(param)
		.on('update', shapeOnUpdate);
	shapeData.set(shape, { templateKey: param.templateKey, detail: param.detail });
	return shape;
}

/**
 * @param { CustomEvent<IDiagramShapeEventUpdateDetail>} evt
 */
function shapeOnUpdate(evt) {
	shapeData.get(evt.detail.target).detail = /** @type {string} */ (evt.detail.props.text.textContent);
}

/** @param {string} templateKey */
function shapeAddByKey(templateKey) {
	shapeAdd({
		templateKey: templateKey,
		position: { x: 120, y: 120 },
		detail: 'Title'
	});
}

function shapeDel() {
	if (!selectedShape) { return; }

	shapeData.delete(selectedShape);
	connectors = connectors
		.filter(el => el.start.shape !== selectedShape && el.end.shape !== selectedShape);

	diagram.shapeDel(selectedShape);
	shapeSelect(null);
}

/**
 * @param {string} text
 */
function shapeUpdate(text) {
	if (!selectedShape) { return; }

	shapeData.get(selectedShape).detail = text;
	selectedShape.update({
		props: {
			text: {
				textContent: textContentTrim(shapeData.get(selectedShape).templateKey, text)
			}
		}
	});
}

/** @param {IDiagramShape} shape */
function shapeSelect(shape) {
	if (shape && shape.type === 'shape') {
		selectedShape = shape;

		if (shapeData.has(shape)) {
			panel.shapeSettingsUpdate({
				selected: true,
				text: shapeData.get(shape).detail,
				disabled: false
			});
		} else {
			panel.shapeSettingsUpdate({
				selected: true,
				text: null,
				disabled: true
			});
		}
	} else {
		selectedShape = null;
		panel.shapeSettingsUpdate({
			selected: false
		});
	}
}

function generateLink() {
	const dataStr = serialize(shapeData, connectors);
	if (dataStr) {
		const url = new URL(window.location.href);
		url.hash = encodeURIComponent(dataStr);
		navigator.clipboard.writeText(`${url.toString()}`).then(_ => alert('Link to diagram copied to clipboard'));
		return;
	}

	alert('Nothing to save');
}

if (window.location.hash) {
	/** @type {SerializeData} */
	const data = JSON.parse(decodeURIComponent(window.location.hash.substring(1)));

	if (data.s && data.s.length > 0) {
		const shapes = [];
		for (const shape of data.s) {
			shapes.push(shapeAdd(shape));
		}

		if (data.c && data.c.length > 0) {
			for (const con of data.c) {
				diagram.shapeConnect({
					start: { shape: shapes[con.s.i], connector: con.s.c },
					end: { shape: shapes[con.e.i], connector: con.e.c }
				});

				connectors.push({
					start: { type: 'connector', key: con.s.c, shape: shapes[con.s.i] },
					end: { type: 'connector', key: con.e.c, shape: shapes[con.e.i] }
				});
			}
		}
	}

	history.replaceState(null, null, ' ');
}
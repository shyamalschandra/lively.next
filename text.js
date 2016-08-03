import { string } from "lively.lang";
import { Color, pr } from "lively.graphics";
import { Morph, show } from "./index.js";

export class Text extends Morph {

  static makeLabel(string, props) {
    return new Text({
      textString: string,
      fontFamily: "Helvetica Neue, Arial",
      fontColor: Color.black,
      fontSize: 11,
      readOnly: true,
      ...props
    });
  }

  constructor(props) {
    super({
      readOnly: false,
      clipMode: "hidden",
      textString: "",
      fixedWidth: false, fixedHeight: false,
      draggable: false,
      _selection: { start: 0, end: 0 },
      fontFamily: "Sans-Serif",
      fontSize: 12,
      ...props
    });
    this.fit();
    this._needsFit = false;
    this._needsSelect = false;
  }

  get fontMetric() { return this.env.fontMetric; }

  get isText() { return true }

  get textString() { return this.getProperty("textString") }
  set textString(value) {
    let oldText = this.textString;
    oldText && this.deleteText(0, oldText.length);
    this.insertText(0, value);
  }

  get readOnly() { return this.getProperty("readOnly"); }
  set readOnly(value) {
    this.nativeCursor = value ? "default" : "auto";
    this.recordValueChange("readOnly", value);
  }

  get fixedWidth() { return this.getProperty("fixedWidth") }
  set fixedWidth(value) {
    this.recordValueChange("fixedWidth", value);
    this._needsFit = true;
  }

  get fixedHeight() { return this.getProperty("fixedHeight") }
  set fixedHeight(value) {
    this.recordValueChange("fixedHeight", value);
    this._needsFit = true;
  }

  get fontFamily() { return this.getProperty("fontFamily") }
  set fontFamily(value) {
    this.recordValueChange("fontFamily", value);
    this._needsFit = true;
  }

  get fontSize() { return this.getProperty("fontSize") }
  set fontSize(value) {
    this.recordValueChange("fontSize", value);
    this._needsFit = true;
  }

  get fontColor() { return this.getProperty("fontColor") }
  set fontColor(value) {
    this.recordValueChange("fontColor", value);
  }

  get placeholder() { return this.getProperty("placeholder") }
  set placeholder(value) {
    this.recordValueChange("placeholder", value);
    this._needsFit = true;
  }

  get _selection() { return this.getProperty("_selection") }
  set _selection(value) { this.recordValueChange("_selection", value); }

  get selection() { return new TextSelection(this) }

  insertText(pos, str) {
    var oldText = this.textString,
        newText = oldText ? oldText.substr(0, pos) + str + oldText.substr(pos) : str;
    this._needsFit = true;

    this.recordValueChange(
      "textString", newText,
      {action: "insert", pos: pos, str: str});
  }

  deleteText(start, end) {
    var oldText = this.textString,
        newText = oldText.substr(0, start) + oldText.substr(end);
    this._needsFit = true;

    this.recordValueChange(
      "textString", newText,
      {action: "delete", start: start, end: end});
  }

  selectionOrLineString() {
    var sel = this.selection;
    if (sel.text) return sel.text;
    var line = string.lineIndexComputer(this.textString)(sel.start),
        [start, end] = string.lineNumberToIndexesComputer(this.textString)(line);
    return this.textString.slice(start, end).trim();
  }

  aboutToRender() {
    super.aboutToRender();
    this.fitIfNeeded();
  }

  render(renderer) {
    return renderer.renderText(this);
  }

  fit() {
    var {fixedHeight, fixedWidth} = this;
    if (fixedHeight && fixedWidth) return;

    var {fontMetric, fontFamily, fontSize, placeholder, textString} = this,
        {height: placeholderHeight, width: placeholderWidth} = fontMetric.sizeForStr(fontFamily, fontSize, placeholder || " "),
        {height, width} = fontMetric.sizeForStr(fontFamily, fontSize, textString);
    if (!fixedHeight)
      this.height = Math.max(placeholderHeight, height);
    if (!fixedWidth)
      this.width = Math.max(placeholderWidth, width);
  }

  fitIfNeeded() {
    if (this._needsFit) { this.fit(); this._needsFit = false; }
  }

  recordSelectionFrom(domNode) {
    var { selectionStart: start, selectionEnd: end } = domNode;
    this._selection = { start: start, end: end };
  }

  applySelectionTo(domNode) {
    var { start, end } = this._selection;
    domNode && domNode.setSelectionRange(start, end);
  }

  onInput(evt) {
    this.textString = evt.domEvt.target.value;
  }

  onMouseUp(evt) { this.onSelect(evt); }

  onMouseDown(evt) { this.onSelect(evt); }

  onDeselect(evt) { this.onSelect(evt) }

  onSelect(evt) {
    this.recordSelectionFrom(evt.domEvt.target);
  }

  onDeselect(evt) {
    this._selection = { start: 0, end: 0 };
  }

  onKeyUp(evt) {
    switch (evt.keyString()) {
      case 'Command-D': case 'Command-P': evt.stop(); break;
    }
  }

  async onKeyDown(evt) {
    switch (evt.keyString()) {
      case 'Command-D':
        evt.stop();
        var result = await lively.vm.runEval(this.selectionOrLineString(), {System, targetModule: "lively://test-text/1"});
        this.world()[result.isError ? "logError" : "setStatusMessage"](result.value);
        break;

      case 'Command-P':
        var sel = this.selection;
        evt.stop();
        var result = await lively.vm.runEval(this.selectionOrLineString(), {System, targetModule: "lively://test-text/1"});
        this.textString = this.textString.slice(0, sel.end) + result.value + this.textString.slice(sel.end);
        break;
    }
  }

}


class TextSelection {

  constructor(textMorph) {
    this.textMorph = textMorph;
  }

  get range() { return this.textMorph._selection; }
  set range(rangeObj) {
    let morph = this.textMorph;
    morph._selection = rangeObj;
    morph._needsSelect = true;
  }

  get start() { return this.range.start; }
  set start(val) { this.range = { start: val, end: this.end }; }

  get end() { return this.range.end }
  set end(val) { this.range = { start: this.start, end: val }; }

  get text() { return this.textMorph.textString.substring(this.start, this.end) }
  set text(val) {
    let { start, end } = this.range,
        morph = this.textMorph;
    if (!this.isCollapsed) {
      morph.deleteText(start, end);
    }
    if (val.length) {
      morph.insertText(start, val);
    }
    this.range = { start: this.start, end: this.start + val.length };
  }

  get isCollapsed() { return this.start === this.end; }
  collapse(index = this.start) { this.range = { start: index, end: index }; }
}

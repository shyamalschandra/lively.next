/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../../rendering/dom-helper.js";
import { MorphicEnv } from "../../index.js";
import { World } from "../../index.js";
import { Range } from "../../text/range.js";
import { Text } from "../../text/morph.js";
import { TextAttribute } from "../../text/style.js";
import { Rectangle, Color, pt } from "lively.graphics";
import { obj } from "lively.lang";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";

const defaultStyle = {
  fontFamily: "Monaco, monospace",
  fontSize: 10,
  fontWeight: "normal",
  fontColor: Color.black,
  fontStyle: "normal",
  textDecoration: "none",
  fixedCharacterSpacing: false
}

function text(string, props) {
  return new Text({
    name: "text",
    textString: string,
    extent: pt(100,100),
    padding: Rectangle.inset(3),
    fontMetric,
    ...defaultStyle,
    ...props
  });
}

var world, sut;
function createDummyWorld() {
  world = new World({name: "world", extent: pt(300,300), submorphs: [
    text("hello", {
      position: pt(10.10),
      fill: Color.gray.lighter(2)
    })]})
  sut = world.get("text");
  return world;
}

var env;
async function createMorphicEnv() {
  env = new MorphicEnv(await createDOMEnvironment());
  env.domEnv.document.body.style = "margin: 0";
  MorphicEnv.pushDefault(env);
  await env.setWorld(createDummyWorld());
}

async function destroyMorphicEnv() { MorphicEnv.popDefault().uninstall(); }

function printStyleNormalized(style) { return obj.inspect(style).replace(/ /g, ""); }

var style_a = { fontSize: 12, fontStyle: "italic" },
    style_b = { fontSize: 14, fontWeight: "bold" },
    a = TextAttribute.create(style_a, 0, 1, 0, 3),
    b = TextAttribute.create(style_b, 0, 2, 0, 4),
    textAttributes;

describe("rich text", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  it("begins with default style range", () => {
    textAttributes = sut.document.textAttributesByLine[0];
    expect(textAttributes).property("length").equals(1);
    expect(textAttributes[0].range).stringEquals("Range(0/-1 -> 0/5)");
    expect(textAttributes[0].data).deep.equals(defaultStyle);
  });

  it("addTextAttribute merges style ranges", () => {
    sut.addTextAttribute(a);
    textAttributes = sut.document.textAttributesByLine[0];
    textAttributes.length

    expect(textAttributes).property("length").equals(2);
    expect(textAttributes[0].range).stringEquals("Range(0/-1 -> 0/5)");
    expect(textAttributes[1].range).stringEquals("Range(0/1 -> 0/3)");
    expect(textAttributes[0].data).deep.equals(defaultStyle);
    expect(textAttributes[1].data).deep.equals(style_a);

    sut.addTextAttribute(b);
    textAttributes = sut.document.textAttributesByLine[0];

    expect(textAttributes).property("length").equals(3);
    expect(textAttributes[0].range).stringEquals("Range(0/-1 -> 0/5)");
    expect(textAttributes[1].range).stringEquals("Range(0/1 -> 0/3)");
    expect(textAttributes[2].range).stringEquals("Range(0/2 -> 0/4)");
    expect(textAttributes[0].data).deep.equals(defaultStyle);
    expect(textAttributes[1].data).deep.equals(style_a);
    expect(textAttributes[2].data).deep.equals(style_b);
  });

  it("renders styles", async () => {
    sut.addTextAttribute(a);
    sut.addTextAttribute(b);

    await sut.whenRendered();

    let root = env.renderer.getNodeForMorph(sut),
        textLayer = root.getElementsByClassName("text-layer")[0],
        line = textLayer.childNodes[1], // index 0 is spacer
        chunks = line.childNodes;

    expect(chunks).property("length").equals(5);

    let styles = Array.from(chunks).map(ea => {
      let jsStyle =        env.domEnv.window.getComputedStyle(ea),
          fontFamily =     jsStyle.getPropertyValue("font-family"),
          fontSize =       parseInt(jsStyle.getPropertyValue("font-size").slice(0, -2)),
          fontWeight =     jsStyle.getPropertyValue("font-weight"),
          fontStyle =      jsStyle.getPropertyValue("font-style"),
          textDecoration = jsStyle.getPropertyValue("text-decoration");
      // note: when running the tests on Firefox "fontWeight" is differently
      // reported than on Chrome
      if (fontWeight == "400") fontWeight = "normal";
      if (fontWeight == "700") fontWeight = "bold";
      return { fontFamily, fontSize, fontWeight, fontStyle, textDecoration };
    });

    let strings = Array.from(chunks).map(ea => ea.textContent);

    expect(printStyleNormalized(styles[0])).equals(printStyleNormalized(obj.dissoc(defaultStyle,                                 ["fontColor", "fixedCharacterSpacing"])));
    expect(printStyleNormalized(styles[1])).equals(printStyleNormalized(obj.dissoc({...defaultStyle, ...style_a},                ["fontColor", "fixedCharacterSpacing"])));
    expect(printStyleNormalized(styles[2])).equals(printStyleNormalized(obj.dissoc({...defaultStyle, ...style_a, ...style_b},    ["fontColor", "fixedCharacterSpacing"])));
    expect(printStyleNormalized(styles[3])).equals(printStyleNormalized(obj.dissoc({...defaultStyle, ...style_b},                ["fontColor", "fixedCharacterSpacing"])));
    expect(printStyleNormalized(styles[4])).equals(printStyleNormalized(obj.dissoc(defaultStyle,                                 ["fontColor", "fixedCharacterSpacing"])));

    expect(strings).equals(["h", "e", "l", "l", "o"]);
  });
});

/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import TextTree from "../../text/document-tree.js";
import { arr } from "lively.lang";

var opts = {maxLeafSize: 3, minLeafSize: 2, maxNodeSize: 5, minNodeSize: 2};

function consistencyCheck(tree) {
  tree.root.traverse(ea => {
    var {
      isRoot,
      isLeaf,
      children,
      options: {maxLeafSize, maxNodeSize, minLeafSize, minNodeSize}
    } = ea;
    if (isRoot)
      return;
    var max = isLeaf ? maxLeafSize : maxNodeSize,
      min = isLeaf ? minLeafSize : minNodeSize;
    expect(children.length).within(min, max, `children count of ${ea}`);
    if (isLeaf)
      expect().assert(
        children.every(ea => ea.isLine),
        `children of ${ea} are not all lines!`
      );
    else
      expect().assert(
        children.every(ea => ea.isNode),
        `children of ${ea} are not all nodes!`
      );
  });
}

describe("text tree", () => {

  it("finds lines by row", () => {
    var textTree = new TextTree(["a", "b", "c", "d"]);
    consistencyCheck(textTree);
    var lines = [0,1,2,3,4].map(n => textTree.root.findRow(n));
    expect().assert(lines[0], "line 0 not found");
    expect().assert(lines[1], "line 1 not found");
    expect().assert(lines[2], "line 2 not found");
    expect().assert(lines[3], "line 3 not found");
    expect(lines[0]).containSubset({text: "a"});
    expect(lines[1]).containSubset({text: "b"});
    expect(lines[2]).containSubset({text: "c"});
    expect(lines[3]).containSubset({text: "d"});

    expect(lines[0].parent).equals(textTree.root.children[0], "parent line 0");
    expect(lines[1].parent).equals(textTree.root.children[0], "parent line 1");
    expect(lines[2].parent).equals(textTree.root.children[1], "parent line 2");
    expect(lines[3].parent).equals(textTree.root.children[1], "parent line 3");

    expect(lines[0].row).equals(0);
    expect(lines[1].row).equals(1);
    expect(lines[2].row).equals(2);
    expect(lines[3].row).equals(3);
  });


  it("balances leaf nodes", () => {
    var textTree = new TextTree(["a", "b", "c", "d"], opts);
    textTree.balance();
    expect(textTree.print()).equals(
      `root (size: 4)\n`
    + ` leaf (size: 2)\n`
    + `  line 0 (height: 0, text: "a")\n`
    + `  line 1 (height: 0, text: "b")\n`
    + ` leaf (size: 2)\n`
    + `  line 2 (height: 0, text: "c")\n`
    + `  line 3 (height: 0, text: "d")`);
  });

  describe("insertion", () => {

    it("appends", () => {
      var textTree = new TextTree();
      textTree.insertLine("hello world");
      expect(textTree.print()).equals(`root (size: 1)\n line 0 (height: 0, text: "hello world")`)
    });

    it("inserts", () => {
      var textTree = new TextTree();
      textTree.insertLine("c");
      textTree.insertLine("a", 0);
      textTree.insertLine("b", 1);
      expect(textTree.print()).equals(
        `root (size: 3)\n`
      + ` line 0 (height: 0, text: "a")\n`
      + ` line 1 (height: 0, text: "b")\n`
      + ` line 2 (height: 0, text: "c")`);
    });

    it("balances leaf nodes after insert", () => {
      var textTree = new TextTree(["a", "b"], opts);
      textTree.insertLine("x", 0);
      textTree.insertLine("y", 3);
      expect(textTree.print()).equals(
        `root (size: 4)\n`
      + ` leaf (size: 2)\n`
      + `  line 0 (height: 0, text: "x")\n`
      + `  line 1 (height: 0, text: "a")\n`
      + ` leaf (size: 2)\n`
      + `  line 2 (height: 0, text: "b")\n`
      + `  line 3 (height: 0, text: "y")`);
    });

    it("balances after insert 1", () => {
      var textTree = new TextTree([], opts);
      textTree.insertLines(["a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a"])
      textTree.insertLine("b");
      textTree.insertLine("b");
      consistencyCheck(textTree);
    });

    it("balances after insert 2", () => {
      var textTree = new TextTree([], opts);
      textTree.insertLines(["a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a"])
      textTree.insertLine("b");
      textTree.insertLine("b");
      consistencyCheck(textTree);
    });

  });


  describe("removal", () => {

    it("removes line", () => {
      var textTree = new TextTree(["a", "b", "c"]);
      textTree.removeLine(1);
      expect(textTree.print()).equals(`root (size: 2)\n line 0 (height: 0, text: "a")\n line 1 (height: 0, text: "c")`);
      textTree.removeLine(1);
      textTree.print2()

      expect(textTree.print()).equals(`root (size: 1)\n line 0 (height: 0, text: "a")`);
      textTree.removeLine(0);
      expect(textTree.print()).equals(`root (size: 0)`);
    });

    it("balances leaf nodes after remove 1", () => {
      var textTree = new TextTree(["a", "b", "c", "d"], opts);
      textTree.removeLine(3);
      expect(textTree.print()).equals(
          `root (size: 3)\n`
        + ` line 0 (height: 0, text: "a")\n`
        + ` line 1 (height: 0, text: "b")\n`
        + ` line 2 (height: 0, text: "c")`);
      textTree.removeLine(1);
      expect(textTree.print()).equals(
          `root (size: 2)\n`
        + ` line 0 (height: 0, text: "a")\n`
        + ` line 1 (height: 0, text: "c")`);
    });

    it("balances leaf nodes after remove 2", () => {
      var textTree = new TextTree(["a", "b", "c", "d"], opts);
      textTree.removeLine(1);
      expect(textTree.print()).equals(
          `root (size: 3)\n`
        + ` line 0 (height: 0, text: "a")\n`
        + ` line 1 (height: 0, text: "c")\n`
        + ` line 2 (height: 0, text: "d")`);
      textTree.removeLine(1);
      expect(textTree.print()).equals(
          `root (size: 2)\n`
        + ` line 0 (height: 0, text: "a")\n`
        + ` line 1 (height: 0, text: "d")`);
    });

  });


});


function fooo() {

  var textTree = new TextTree(["a", "b", "c", "d"], {maxLeafSize: 3, minLeafSize: 2});


  textTree.insertLines(["hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", ])
  textTree.print2()
}
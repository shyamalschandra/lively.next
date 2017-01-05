import { arr, obj, Path } from "lively.lang";
import { Morph, HorizontalLayout, GridLayout, config } from "lively.morphic";
import { pt, Color, Rectangle } from "lively.graphics";
import { JavaScriptEditorPlugin } from "../editor-plugin.js";
import { withSuperclasses, lexicalClassMembers, isClass } from "lively.classes/util.js";
import { TreeData, Tree } from "lively.morphic/tree.js";
import { connect } from "lively.bindings";
import { RuntimeSourceDescriptor } from "lively.classes/source-descriptors.js";
import { addScript } from "lively.classes/object-classes.js";
import { Icon } from "../../../icons.js";
import { interactivelyInjectImportIntoModule, interactivelyChooseImports } from "../import-helper.js";
import { module } from "lively.modules";


// var oe = ObjectEditor.open({target: this})

// var tree = oe.get("classTree");
// tree.treeData = new ClassTreeData(this.constructor);
// var td = oe.get("classTree").treeData
// oe.remove()

// td.getChildren(td.root)
// td.collapse(td.getChildren(td.root)[0], false)
// tree.update()
// td.isCollapsed(td.getChildren(td.root)[2])
// tree.onNodeCollapseChanged(td.root)

// var x = new ClassTreeData(this.constructor)
// x.getChildren(x.root)
// x.getChildren(x.getChildren(x.root)[1])

// tree.selection = x.getChildren(x.root)[2]

class ClassTreeData extends TreeData {

  constructor(target) {
    super({
      target,
      name: "root",
      isRoot: true,
      isCollapsed: false
    });
  }

  display(node) {
    if (!node) return "empty";

    if (node.isRoot)
      return node.target.name || node.target.id || "root object"

    if (isClass(node.target))
      return node.target.name;

    return node.name || "no name";
  }

  isLeaf(node) { if (!node) return true; return !node.isRoot && !isClass(node.target); }
  isCollapsed(node) { return !node || node.isCollapsed; }
  collapse(node, bool) { node && (node.isCollapsed = bool); }

  getChildren(node) {
    if (!node) return [];
    if (node.isCollapsed) return [];

    if (node.isRoot) {
      if (node.children) return node.children;
      var classes = arr.without(withSuperclasses(node.target), Object).reverse();
      return node.children = classes.map(klass => ({target: klass, isCollapsed: true}))
    }

    if (isClass(node.target)) {
      try {
        return node.children
          || (node.children = lexicalClassMembers(node.target).map(ea => {
            var {static: _static, name} = ea;
            return {name: (_static ? "static " : "") + name, target: ea};
          }));
      } catch (e) { $world.showError(e); return node.children = []; }
    }

    return [];
  }

}


export class ObjectEditor extends Morph {

  static open(options = {}) {
    var ed = new this(options),
        winOpts = {name: "ObjectEditor window", title: options.title || "ObjectEditor"},
        win = ed.openInWindow(winOpts).activate();

    return win;
  }

  constructor(props = {}) {
    super({
      extent: pt(800, 500),
      ...obj.dissoc(props, ["target"])
    });
    this.state = {target: null, selectedClass: null, selectedMethod: null};
    this.build(props);
    if (props.target) this.target = props.target;
  }

  get target() { return this.state.target; }
  set target(obj) {
    this.state.target = obj;
    this.state.selectedClass = null;
    this.state.selectedMethod = null;
    var tree = this.get("classTree");
    tree.treeData = new ClassTreeData(obj.constructor);

    Object.assign(this.editorPlugin.evalEnvironment, {
      targetModule: "lively://object-editor/" + this.id,
      context: this.target,
      format: "esm"
    });
  }

  build(props) {
    var listStyle = {
          // borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"
        },

        textStyle = {
          borderWidth: 1, borderColor: Color.gray,
          type: "text",
          ...config.codeEditor.defaultStyle,
          plugins: [new JavaScriptEditorPlugin(config.codeEditor.defaultTheme)]
        },

        btnStyle = {
          type: "button",
          fontSize: 10,
          activeStyle: {
            fill: Color.white,
            border: {color: Color.lightGray, style: "solid", radius: 5},
            nativeCursor: "pointer"
          },
          extent: pt(26,24),
        };

    this.submorphs = [
      {type: Tree, name: "classTree", treeData: new ClassTreeData(null)},
      {name: "controls",
        layout: new HorizontalLayout({direction: "centered", spacing: 2}), submorphs: [
          {...btnStyle, name: "addMethodButton", label: Icon.makeLabel("plus")},
          {...btnStyle, name: "removeMethodButton", label: Icon.makeLabel("minus")}]},

      {name: "sourceEditor", ...textStyle, doSave: () => this.save()},

      new ImportController({name: "importController"})
    ];

    var l = this.layout = new GridLayout({
      grid: [
        ["classTree", "sourceEditor", "importController"],
        ["controls", "sourceEditor", "importController"],
      ]});
    l.col(0).fixed = 180;
    l.col(2).fixed = 180;
    l.row(1).fixed = 30;
    // var oe = ObjectEditor.open({target: this})

    // l.col(2).fixed = 100; l.row(0).paddingTop = 1; l.row(0).paddingBottom = 1;

    connect(this.get("classTree"), "selection", this, "onClassTreeSelection");
    connect(this.get("addMethodButton"), "fire", this, "interactivelyAddMethod");
    connect(this.get("removeMethodButton"), "fire", this, "interactivelyRemoveMethod");

    connect(this.get("addImportButton"), "fire", this, "interactivelyAddImport");
    connect(this.get("removeImportButton"), "fire", this, "interactivelyRemoveImport");
  }

  async systemInterface() {
    var livelySystem = await System.import("lively-system-interface"),
        remote = this.backend;
    return !remote || remote === "local" ?
      livelySystem.localInterface :
      livelySystem.serverInterfaceFor(remote);
  }

  get backend() { return this.editorPlugin.evalEnvironment.remote || "local"; }
  set backend(remote) {
    this.editorPlugin.evalEnvironment.remote = remote;
  }

  get editorPlugin() { return this.get("sourceEditor").pluginFind(p => p.isEditorPlugin); }

  onClassTreeSelection(node) {
    if (!node) {
      this.get("sourceEditor").textString = "";
      return;
    }

    if (isClass(node.target)) {
      this.selectClass(node.target);
      return;
    }

    var tree = this.get("classTree"),
        parentNode = tree.treeData.parentNode(node);

    var isClick = !!this.env.eventDispatcher.eventState.clickedOnMorph;
    this.selectMethod(parentNode.target, node.target, isClick);
  }

  sourceDescriptorFor(klass) {
    return RuntimeSourceDescriptor.for(klass);
  }

  async selectClass(klass) {
    var tree = this.get("classTree");
    if (!tree.selection || tree.selection.target !== klass) {
      var node = tree.nodes.find(ea => !ea.isRoot && ea.target === klass);
      tree.selection = node;
    }

    var ed = this.get("sourceEditor"),
        descr = this.sourceDescriptorFor(klass),
        source = await descr.source,
        system = await this.systemInterface(),
        format = (await system.moduleFormat(descr.module.id)) || "esm",
        [_, ext] = descr.module.id.match(/\.([^\.]+)$/) || [];

    ed.textString = source;

    Object.assign(this.editorPlugin.evalEnvironment, {
      targetModule: descr.module.id,
      context: this.target,
      format
    });
    await this.updateKnownGlobals();

    this.state.selectedMethod = null;
    this.state.selectedClass = klass;

    this.get("importController").module = descr.module;

  }

  async selectMethod(klass, methodSpec, highlight = true) {
    if (this.state.selectedClass !== klass)
      await this.selectClass(klass);

    var tree = this.get("classTree");
    tree.uncollapse(tree.selection);
    if (tree.selection.target !== methodSpec) {
      var node = tree.nodes.find(ea => ea.target.owner === klass && ea.target.name === methodSpec.name);
      tree.selection = node;
    }

    var ed = this.get("sourceEditor"),
        descr = RuntimeSourceDescriptor.for(klass),
        parsed = await descr.ast,
        methods = Path("body.body").get(parsed),
        method = methods.find(({key: {name}}) => name === methodSpec.name);

    this.state.selectedMethod = methodSpec;

    if (!method) {
      this.setStatusMessage(`Cannot find method ${methodSpec.name}`);
      return;
    }

    if (highlight) {
      ed.cursorPosition = ed.indexToPosition(method.key.start);
      var methodRange = {
        start: ed.indexToPosition(method.start),
        end: ed.indexToPosition(method.end)
      }
      ed.flash(methodRange, {id: 'method', time: 1000, fill: Color.rgb(200,235,255)});
      ed.centerRow();
    }
  }

  async updateKnownGlobals() {
    var declaredNames = [], klass = this.state.selectedClass;
    if (klass) {
      var descr = this.sourceDescriptorFor(klass);
      ({declaredNames} = await descr.declaredAndUndeclaredNames);
    }
    Object.assign(this.editorPlugin.evalEnvironment, {
      knownGlobals: declaredNames,
    });
    this.editorPlugin.highlight();
  }

  async interactivelyAddMethod() {
    try {
      let input = await this.world().prompt("Enter method name",
                        {historyId: "object-editor-method-name-hist"});
      if (!input) return;
      let {methodName} = await addScript(this.target, "function() {}", input);
      await this.refresh();
      await this.selectMethod(this.target.constructor, {name: methodName});
      this.focus();
    } catch (e) {
      this.showError(e);
    }
  }

  async interactivelyRemoveMethod() {
    this.setStatusMessage("Not yet implemented")
  }

  async interactivelyAddImport() {
    try {
      var {selectedClass, selectedMethod} = this.state;
      if (!selectedClass) {
        this.showError(new Error("No class selected"));
        return;
      }

      var system = await this.editorPlugin.systemInterface(),
          choices = await interactivelyChooseImports(system);
      if (!choices) return null;

      // FIXME move this into system interface!
      var m = module(this.editorPlugin.evalEnvironment.targetModule);
      await m.addImports(choices);

      await this.get("importController").updateImports();
      await this.updateKnownGlobals();
      this.get("sourceEditor").focus();
    } catch (e) { this.showError(e); }
  }

  async interactivelyRemoveImport() {
    try {
      var sels = this.get("importsList").selections;
      if (!sels || !sels.length) return;
      var really = await this.world().confirm(
        "Really remove imports \n" + arr.pluck(sels, "local").join("\n") + "?")
      if (!really) return;
      var m = module(this.editorPlugin.evalEnvironment.targetModule);
      await m.removeImports(sels);
      this.get("importsList").selection = null;
      await this.get("importController").updateImports();
      await this.updateKnownGlobals();
      this.get("sourceEditor").focus();
    } catch (e) { this.showError(e); }
  }

  async refresh() {
    var {selectedClass, selectedMethod} = this.state,
        tree = this.get("classTree");

    await tree.maintainViewStateWhile(async () => {
      this.target = this.target;
    }, node => node.target ?
                  node.target.name
                    + node.target.kind
                    + (node.target.owner ? "." + node.target.owner.name : "") :
                  node.name);

    if (selectedClass && selectedMethod && !tree.selection) {
      // method rename, old selectedMethod does no longer exist
      await this.selectClass(selectedClass);
    }
  }


  async doSave() {
    var {selectedClass, selectedMethod} = this.state;

    if (!selectedClass) throw new Error("No class selected");

    var editor = this.get("sourceEditor"),
        descr = RuntimeSourceDescriptor.for(selectedClass);

var store = JSON.parse(localStorage["oe helper"] || '{"saves": []}')
store.saves.push(editor.textString);
if (store.saves.length > 300) store.saves = store.saves.slice(-300)
localStorage["oe helper"] = JSON.stringify(store);

    await descr.changeSource(editor.textString)

    await editor.saveExcursion(async () => {
      await this.refresh();
      // if (selectedMethod) await this.selectMethod(selectedClass, selectedMethod, false);
      // else await this.selectClass(selectedClass);
    });


  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  focus() { this.get("sourceEditor").focus(); }

  get keybindings() {
    return [
      {keys: "F1", command: "focus class tree"},
      {keys: "F2", command: "focus code editor"},
      {keys: {mac: "Command-S", win: "Ctrl-S"}, command: "save source"},
    ].concat(super.keybindings);
  }

  get commands() {
    return commands;
  }

}


// new ImportController().openInWorld()
class ImportController extends Morph {

  constructor(props) {
    super({
      extent: pt(300,600),
      ...props
    });
    this.build();
    connect(this, "module", this, "updateImports");
  }

  build() {

    var listStyle = {
          // borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif",
          type: "list"
        },

        btnStyle = {
          type: "button",
          fontSize: 10,
          activeStyle: {
            fill: Color.white,
            border: {color: Color.lightGray, style: "solid", radius: 5},
            nativeCursor: "pointer"
          },
          extent: pt(26,24),
        };

    this.submorphs = [
      {...listStyle, name: "importsList", multiSelect: true},
      {name: "buttons", layout: new HorizontalLayout({direction: "centered", spacing: 2}),
        submorphs: [
        {...btnStyle, name: "addImportButton", label: Icon.makeLabel("plus")},
        {...btnStyle, name: "removeImportButton", label: Icon.makeLabel("minus")},
        {...btnStyle, name: "cleanupButton", label: "cleanup"},
      ]},
    ]

    this.layout = new GridLayout({
      grid: [
        ["importsList"],
        ["buttons"]
      ]});
    this.layout.row(1).fixed = 30;
  }

  async updateImports() {
    if (!this.module) return;
    var m = lively.modules.module(this.module);
    var imports = await m.imports()
    imports[0]

    var items = imports.map(ea => {
      var label = [];
      var alias = ea.local !== ea.imported && ea.imported !== "default" ? ea.local : null;
      if (alias) label.push([`${ea.imported} as `, {}])
      label.push([alias || ea.local, {fontWeight: "bold"}])
      label.push([` from ${ea.fromModule}`]);
      return {isListItem: true, value: ea, label}
    });

    this.get("importsList").items = items;
  }

  get module() { return this.getProperty("module"); }
  set module(moduleOrId) {
    var id = !moduleOrId ? null : typeof moduleOrId === "string" ? moduleOrId : moduleOrId.id;
    this.setProperty("module", id);
  }

  save() {
    // import { serializeMorph } from "lively.morphic/serialization.js";
    window.snapshot = serializeMorph(this).snapshot;
  }


}

var commands = [

  {
    name: "focus class tree",
    exec: ed => { var m = ed.get("classTree"); m.show(); m.focus(); return true; }
  },

  {
    name: "focus code editor",
    exec: ed => { var m = ed.get("sourceEditor"); m.show(); m.focus(); return true; }
  },

  {
    name: "save source",
    exec: async ed => {
      try {
        await ed.doSave();
        ed.setStatusMessage("saved", Color.green);
      } catch (e) { ed.showError(e); }
      return true;
    }
  }
];
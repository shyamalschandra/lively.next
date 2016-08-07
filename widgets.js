import { arr, num, obj } from "lively.lang";
import { pt, Color } from "lively.graphics";
import { Morph, Ellipse, Text } from "./index.js";

export class ObjectDrawer extends Morph {

  constructor(props) {
    super({
      name: "object-drawer",
      position: pt(20, 20),
      extent: pt(4 * (140 + 10) + 15, 140),
      fill: Color.white,
      borderWidth: 1,
      borderColor: Color.gray,
      ...props
    });
    this.setup();
  }

  setup() {
    var n = 4,
        margin = pt(5,5),
        objExt = pt(((this.width - margin.x) / n) - margin.x, this.height - margin.y*2),
        pos = margin;

    this.addMorph({
      type: "ellipse",
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy,
      init() { this.fill = Color.random(); }
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy,
      init() { this.fill = Color.random(); }
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "image",
      position: pos, extent: objExt,
      fill: null, grabbable: false,
      onDrag: doCopy
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "text",
      textString: "Lively rocks!",
      position: pos, extent: objExt,
      fill: Color.white, grabbable: false,
      readOnly: true,
      fontSize: 16,
      onDrag: doCopy,
      draggable: true,
      init() {
        this.draggable = false;
        this.grabbable = false;
        this.readOnly = false;
      }
    });

    function doCopy(evt) {
      evt.stop();
      var copy = Object.assign(this.copy(), {position: evt.positionIn(this).negated()});
      var name = copy.constructor.name.toLowerCase();
      name = (name[0].match(/[aeiou]/) ? "an " : "a ") + name;
      var i = 1; while (this.world().get(name + " " + i)) i++
      copy.name = name + " " + i;
      evt.hand.grab(copy);
      delete copy.onDrag;
      copy.init && copy.init();
    }
  }
}

export class Window extends Morph {

  constructor(props = {}) {
    super({
      fill: Color.lightGray,
      borderRadius: 7,
      dropShadow: true,
      borderColor: Color.gray,
      borderWidth: 1,
      clipMode: "hidden",
      ...obj.dissoc(props, ["title"])
    });
    this.submorphs = this.submorphs.concat(this.makeTitleBar());
    this.title = props.title || this.name || "";
  }

  resizeBy(delta) {
    this.styleClasses = ["morph"];
    super.resizeBy(delta);
    this.titleLabel().center = pt(Math.max(this.extent.x / 2, 100), 10);
  }

  makeTitleBar() {
    return this.buttons()
           .concat(this.titleLabel())
           .concat(this.resizer());
  }

  buttons() {

    const extent = pt(13,13);

    return [

      this.getSubmorphNamed("close") || {
        type: "ellipse",
        extent,
        center: pt(15,13),
        name: "close",
        borderWith: 1,
        borderColor: Color.darkRed,
        fill: Color.rgb(255,96,82),
        onMouseDown(evt) { this.owner.close(); },
        onHoverIn() { this.submorphs[0].visible = true; },
        onHoverOut() { this.submorphs[0].visible = false; },
        submorphs: [{
          fill: Color.black.withA(0), scale: 0.7, visible: false,
          styleClasses: ["morph", "fa", "fa-times"],
          center: pt(5.5, 5), opacity: 0.5
        }]
      },

      this.getSubmorphNamed("minimize") || {
        type: "ellipse",
        extent,
        center: pt(35,13),
        name: "minimize",
        borderWith: 1,
        borderColor: Color.brown,
        fill: Color.rgb(255,190,6),
        onHoverIn() { this.submorphs[0].visible = true; },
        onHoverOut() { this.submorphs[0].visible = false; },
        onMouseDown(evt) { this.owner.toggleMinimize(); },
        submorphs: [{
          fill: Color.black.withA(0), scale: 0.7, visible: false,
          styleClasses: ["morph", "fa", "fa-minus"], center: pt(5.5,5), opacity: 0.5
        }]
      },

      this.getSubmorphNamed("maximize") || {
        type: "ellipse",
        extent,
        name: "maximize",
        center: pt(55,13),
        borderWith: 1,
        borderColor: Color.darkGreen,
        fill: Color.green,
        onMouseDown(evt) { this.owner.toggleMaximize(); },
        onHoverIn() { this.submorphs[0].visible = true; },
        onHoverOut() { this.submorphs[0].visible = false; },
        submorphs: [{
          fill: Color.black.withA(0), scale: 0.7, visible: false,
          styleClasses: ["morph", "fa", "fa-plus"], center: pt(5.5,5), opacity: 0.5
        }]
     }

   ]
  }

  titleLabel() {
    return this.getSubmorphNamed("titleLabel") || {
      type: "text",
      name: "titleLabel",
      readOnly: true,
      draggable: false,
      grabbable: false,
      fill: Color.gray.withA(0),
      fontColor: Color.darkGray,
      center: pt(this.extent.x / 2, 10)
    };
  }

  resizer() {
    return this.getSubmorphNamed("resizer") || {
      name: "resizer",
      styleClasses: ["morph", "fa", "fa-chevron-down"],
      extent: pt(20,20),
      origin: pt(10,10),
      opacity: 0.5,
      fill: Color.gray.withA(0),
      rotation: num.toRadians(-45),
      bottomRight: this.extent,
      onDrag(evt) {
        this.owner.resizeBy(evt.state.dragDelta);
        this.bottomRight = this.owner.extent;
      }
    };
  }

  get title() { return this.titleLabel().textString; }
  set title(title) { this.titleLabel().textString = title; }
  
  toggleMinimize() {
    this.styleClasses = ["morph", "smooth-extent"]
    if (this.minimized) {
      this.extent = this.cachedExtent;
      this.resizer().visible = true
      this.minimized = false;
    } else {
      this.cachedExtent =  this.extent;
      this.extent = pt(this.extent.x, 25);
      this.resizer().visible = false;
      this.minimized = true;
    }
  }

  toggleMaximize() {
    // FIXME: if the corresponding dom now is going to be
    // respawned in the next render cycle by teh virtual-dom
    // the animation will not be triggered, since a completely new
    // node with the already changed values will appear. CSS animations
    // will not trigger. Maybe move away from CSS animations to something
    // more explicit, i.e. velocity.js?
    this.styleClasses = ["morph", "smooth-extent"]
    if (this.maximized) {
      this.setBounds(this.cachedBounds);
      this.resizer().bottomRight = this.extent;
      this.maximized = false;
    } else {
      this.cachedBounds = this.bounds();
      this.setBounds(this.world().bounds());
      this.resizer().bottomRight = this.extent;
      this.resizer().visible = true;
      this.maximized = true;
      this.minimized = false;
    }
  }

  close() {
    this.remove()
  }

  onMouseDown(evt) {
    this.bringToFront();
    this.styleClasses = ["morph"];
  }

}

export class Button extends Morph {
  
  constructor(props) {
    super({
      draggable: false,
      action: () => this.world().setStatusMessage(this.name + " clicked!"),
      borderRadius: 15,
      extent: pt(100,24),
      borderWidth: 1,
      active: true,
      ...props
    });
    const label = new Text({
        name: "label",
        readOnly: true,
        fontColor: this.active ? Color.rgb(17,103,189) : Color.gray,
        textString: props.label || this.name,
        fill: Color.white.withA(0),
    });
    label.center = this.innerBounds().center();
    this.addMorph(label);
  }
  
  get action() { return this.getProperty("action") }
  set action(value) { this.addValueChange("action", value); }
  get active() { return this.getProperty("active") }
  set active(value) {
    if (value) {
      this.borderColor = Color.rgb(17,103,189);
      this.fill = Color.rgb(213,228,248);
    } else {
      this.borderColor = Color.gray;
      this.fill = Color.lightGray;
    }
    this.addValueChange("active", value)
  }
  
  onMouseDown(evt) {
    if (this.active) {
      this.fill = Color.rgb(161,173,188);
      try {
        if (typeof this.action !== "function")
          throw new Error(`Button ${this.name} as no executable action!`)
        this.action();
      } catch (err) {
        var w = this.world();
        if (w) w.logError(err);
        else console.error(err);
      } 
    }
  }
  
  onMouseUp(evt) {
    if (this.active) this.fill = Color.rgb(213,228,248); 
  }
}

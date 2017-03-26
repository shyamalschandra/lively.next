import { registerExtension, Resource } from "lively.resources";
import Database from "./index.js";

const debug = false,
      slashRe = /\//g;

function applyExclude(resource, exclude) {
  if (!exclude) return true;
  if (typeof exclude === "string") return !resource.url.includes(exclude);
  if (typeof exclude === "function") return !exclude(resource);
  if (exclude instanceof RegExp) return !exclude.test(resource.url);
  return true;
}

export class StorageDatabase extends Database {

  static ensureDB(name, options) {
    return super.ensureDB("lively.storage-" + name, options);
  }

}

export default class LivelyStorageResource extends Resource {

  get db() {
    return this._db || (this._db = StorageDatabase.ensureDB(this.host()));
  }

  async read() {
    debug && console.log(`[${this}] read`);
    let file = await this.db.get(this.path());
    return file ? file.content : "";
  }

  async write(content) {
    debug && console.log(`[${this}] write`);
    if (!content) content = "";
    else content = String(content);

    if (this.isDirectory())
      throw new Error(`Cannot write into a directory! (${this.url})`);

    await this.db.update(this.path(), spec => {
      if (spec && spec.isDirectory)
        throw new Error(`${this.url} already exists and is a directory (cannot write into it!)`);
      let t = Date.now();
      if (!spec) {
        return {
          etag: undefined,
          type: undefined,
          contentType: undefined,
          user: undefined,
          group: undefined,
          mode: undefined,
          lastModified: t,
          created: t,
          size: content.length,
          content
        }
      }

      return {
        ...spec,
        lastModified: t,
        size: content.length,
        content
      }
    });

    return this;
  }

  async mkdir() {
    debug && console.log(`[${this}] mkdir`);
    if (!this.isDirectory())
      throw new Error(`Cannot mkdir a file! (${this.url})`);
    let spec = await this.db.get(this.path());
    if (spec) {
      if (!spec.isDirectory)
        throw new Error(`${this.url} already exists and is a file (cannot mkdir it!)`);
      return this;
    }
    let t = Date.now();
    await this.db.set(this.path(), {
      etag: undefined,
      type: undefined,
      contentType: undefined,
      user: undefined,
      group: undefined,
      mode: undefined,
      lastModified: t,
      created: t,
      isDirectory: true
    })
    return this;
  }

  async exists() {
    debug && console.log(`[${this}] exists`);
    return this.isRoot() || !!await this.db.get(this.path());
  }

  async remove() {
    debug && console.log(`[${this}] remove`);
    let thisPath = this.path(),
        db = this.db,
        matching = await db.docList({startkey: thisPath, endkey: thisPath + "\uffff"});
    await db.setDocuments(matching.map(({id: _id, rev: _rev}) => ({_id, _rev, _deleted: true})));
    return this;
  }

  readProperties() {
    debug && console.log(`[${this}] readProperties`);
    return this.db.get(this.path());
  }

  async dirList(depth = 1, opts = {}) {
    debug && console.log(`[${this}] dirList`);
    if (!this.isDirectory()) return this.asDirectory().dirList(depth, opts);
  
    let {exclude} = opts,
        prefix = this.path(),
        children = [],
        docs = await this.db.getAll({startkey: prefix, endkey: prefix + "\uffff"})

    if (depth === "infinity") depth = Infinity;

    for (let i = 0; i < docs.length; i++) {
      let doc = docs[i],
          {_id: path, isDirectory} = doc;
      if (!path.startsWith(prefix) || prefix === path) continue;
      let trailing = path.slice(prefix.length),
          childDepth = trailing.includes("/") ? trailing.match(slashRe).length+1 : 1;
      if (childDepth > depth) {
        // add the dirs pointing to child
        let dirToChild = this.join(trailing.split("/").slice(0, depth).join("/") + "/");
        if (!children.some(ea => ea.equals(dirToChild))) children.push(dirToChild);
        continue;
      }

      let child = this.join(trailing);
      if (exclude && !applyExclude(child, exclude)) continue;
      children.push(child);
      let propNames = ["created","lastModified","mode","group","user","contentType","type","etag","size"],
          props = {};
      for (let i = 0; i < propNames.length; i++) child[propNames[i]] = doc[propNames[i]];
    }

    return children;
  }

}


const resourceExtension = {
  name: "lively.storage",
  matches: (url) => url.startsWith("lively.storage:"),
  resourceClass: LivelyStorageResource
}

registerExtension(resourceExtension);

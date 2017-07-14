/*global System*/
import LivelyServer from "../server.js";
import { resource } from "lively.resources";

export default class WorldLoadingPlugin {

  constructor() {
    this.resetHTMLCache();
  }
  setOptions({route} = {}) {}

  get pluginId() { return "world-loading" }

  get before() { return ["jsdav"]; }

  setup(livelyServer) {}

  async close() {}

  resetHTMLCache() { this.cachedHTML = {}; }

  async handleRequest(req, res, next) {
    let [url, query] = req.url.split("?");
    query = query ? "?" + query : "";

    if ((url === "/" || url === "/index.html") && req.method.toUpperCase() === "GET") {
      res.writeHead(301,  {location: "/worlds/" + query});
      res.end();
      return;
    }

    if (!url.startsWith("/worlds")) return next();

    let htmlFile = url === "/worlds" || url === "/worlds/" ?
          "static-world-listing.html" : "morphic.html";
    if (!this.cachedHTML[htmlFile]) {
      let htmlResource = resource(System.baseURL).join("lively.morphic/web/" + htmlFile);
      this.cachedHTML[htmlFile] = await htmlResource.read();
    }

    res.setHeader('content-type', 'text/html');
    res.end(this.cachedHTML[htmlFile]);
  }

}

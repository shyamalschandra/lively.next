export const Token = {
  keyword: "keyword",
  id: "id",
  numeric: "numeric",
  string: "string",
  comment: "comment",
  default: "default"
};

// type Token = "keyword" | "id" | "numeric" | "string" | "comment" | "default"

// type Style = { [string]: any };

export class Mode {
  reset() {
    // reset internal state
    throw new Error("not implemented");
  }
  process(char, row, column) { // string, number, number -> Token
    // process next character, updating internal state
    throw new Error("not implemented");
  }
}

export class Theme {
  background() { // -> Color
    throw new Error("not implemented");
  }
  style(token) { // Token -> Style
    // return style for token
    throw new Error("not implemented");
  }
}

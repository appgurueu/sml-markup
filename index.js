"use strict";
const lustils = require("lustils");
const dom = require("./dom.js");
const {
    unescape_sets,
    escape_sets
} = require("./escape_sets.js");

const {
    Element,
    Document,
    element_builders
} = dom;

function isHexDigit(c) {
    return (c >= "0" && c <= "9") || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");
}

function isLetter(c) {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

const {
    InputError,
    SyntaxError
} = lustils.error;

const {
    StringBuilder,
    StreamLocator,
    obtainInputStream,
    obtainOutputStream,
} = lustils.stream;

const State = lustils.parse.MealyState;
const SpecialState = lustils.parse.MealySpecialState;
const MachineBase = lustils.parse.ExtendedMealyMachineBase;
const Machine = lustils.parse.ExtendedMealyMachine;

let content = new State();
content.setAnyTransition({
    state: content
});
let tag_reader = new MachineBase(undefined, content);
let tag_error = new State();
let escape_error = new State();
let close_or_autoclose = new SpecialState();
let opening = new SpecialState();
let comment_incoming = new State();
let comment_incoming_2 = new State();
let comment = new State();
comment.setAnyTransition({
    state: comment
});
comment_incoming.setTransition("-", {
    state: comment_incoming_2
});
comment_incoming_2.setTransition("-", {
    state: comment
});
let comment_outcomings = [comment];
let ending = "-->";
for (let i = 0; i < ending.length; i++) {
    let co = new State();
    co.setAnyTransition({
        state: comment
    });
    comment_outcomings.push(co);
    comment_outcomings[i].setTransition(ending.charAt(i), {
        state: comment_outcomings[i + 1]
    });
}
let comment_finished = comment_outcomings[comment_outcomings.length - 1];

comment_incoming.setAnyTransition({
    state: tag_error
});
let tag = new SpecialState();
content.setTransition("<", {
    state: tag
});
let escape = new SpecialState();
content.setTransition("&", {
    state: escape
});
let id_escape = new SpecialState();
let identifier_escape = new State();
id_escape.setConsumer((_machine, c) => {
    if (isLetter(c)) {
        return {
            state: id_escape,
            write: true
        };
    } else if (c === ";") {
        return {
            state: identifier_escape
        };
    } else {
        return {
            state: escape_error
        };
    }
});
let num_escape = new SpecialState();
let numeric_escape = new State();
num_escape.setConsumer((_machine, c) => {
    if (isHexDigit(c)) {
        return {
            state: num_escape,
            write: true
        };
    } else if (c === ";") {
        return {
            state: numeric_escape
        };
    } else {
        return {
            state: escape_error
        };
    }
});
escape.setConsumer((_machine, c) => {
    if (c === "#") {
        return {
            state: num_escape
        };
    } else if (isLetter(c)) {
        return {
            state: id_escape,
            write: true
        };
    } else {
        return {
            state: tag_error
        };
    }
});
tag.setConsumer((_machine, c) => {
    if (c === "/") {
        return {
            state: close_or_autoclose
        };
    } else if (isLetter(c)) {
        return {
            state: opening,
            write: true
        };
    } else if (c === "!") {
        return {
            state: comment_incoming
        };
    } else {
        return {
            state: tag_error
        };
    }
});
let self_enclosing = new State();
let opened = new State();
opening.setConsumer((_machine, c) => {
    if (c === "/") {
        return {
            state: self_enclosing
        };
    } else if (isLetter(c)) {
        return {
            state: opening,
            write: true
        };
    } else if (c === ">") {
        return {
            state: opened
        };
    } else {
        return {
            state: tag_error
        };
    }
});
let self_enclosed = new State();
self_enclosing.setTransition(">", {
    state: self_enclosed
});
self_enclosing.setAnyTransition({
    state: tag_error
});
let autoclose = new State();
let close_name = new SpecialState();
close_or_autoclose.setConsumer((_machine, c) => {
    if (c === ">") {
        return {
            state: autoclose
        };
    } else if (isLetter(c)) {
        return {
            state: close_name,
            write: true
        };
    } else {
        return {
            state: tag_error
        };
    }
});
let closed = new State();
close_name.setConsumer((_machine, c) => {
    if (c === ">") {
        return {
            state: closed
        };
    } else if (isLetter(c)) {
        return {
            state: close_name,
            write: true
        };
    } else {
        return {
            state: tag_error
        };
    }
});

function error(message, stream) {
    throw new SyntaxError(message + " at " + stream.row + ":" + stream.col);
}

let readers = {};

const reader_confs = {
    default: {
        strict_tag: false,
        strict_comment: true,
        strict_escape: true,
        closing: "forcing_searching",
        escape_set: "html"
    },
    strict: {
        strict_tag: true,
        strict_comment: true,
        strict_escape: true,
        closing: "strict",
        escape_set: "minimal"
    },
    ignore: {
        strict_tag: false,
        strict_comment: false,
        strict_escape: false,
        closing: "forcing_searching",
        escape_set: "html"
    },
};

function reader(conf) {
    if (typeof (conf) !== "object") {
        return readers[conf] || readers.default;
    }

    conf = Object.freeze(lustils.object.complete(conf || {}, reader_confs.default));

    const {
        strict_tag,
        strict_comment,
        strict_escape,
        closing,
        escape_set
    } = conf;

    const ElementBuilder = element_builders[closing] || element_builders.strict;
    const escapes = unescape_sets[escape_set] || unescape_sets.minimal;

    function read(stream) {
        stream = new StreamLocator(obtainInputStream(stream));
        let doc = new ElementBuilder(new Document());
        let c;
        let tag_name = new StringBuilder();
        let machine = new Machine(tag_reader, tag_name);
        let text_content = "";
        // eslint-disable-next-line no-cond-assign
        while (c = stream.read()) {
            machine.consume(c, tag_name);
            if (machine.current_state === tag || machine.current_state === escape) {
                doc.appendText(text_content);
                text_content = "";
            }
            reset: {
                if (machine.current_state === closed) {
                    doc.closeElement(tag_name.text);
                } else if (machine.current_state === opened) {
                    doc.openChild(new Element(tag_name.text));
                } else if (machine.current_state === self_enclosed) {
                    doc.appendChild(new Element(tag_name.text, false));
                } else if (machine.current_state === autoclose) {
                    doc.closeActive();
                } else if (machine.current_state === identifier_escape) {
                    let char = escapes[tag_name.text];
                    if (char === undefined) {
                        if (strict_escape) {
                            error("invalid escape sequence", stream);
                        }
                    } else {
                        doc.appendText(char);
                    }
                } else if (machine.current_state === numeric_escape) {
                    let num = Number.parseInt(tag_name.text, 16);
                    if (num > 0x10FFFF) {
                        if (strict_escape) {
                            error("invalid escape sequence", stream);
                        }
                    } else {
                        doc.appendText(String.fromCodePoint(num));
                    }
                } else if (machine.current_state === comment_finished) {
                    // comment finished
                } else if (machine.current_state === tag_error) {
                    if (strict_tag) {
                        error("invalid tag", stream);
                    }
                    doc.appendText(text_content);
                } else if (machine.current_state === escape_error) {
                    if (strict_tag) {
                        error("invalid escape sequence", stream);
                    }
                    doc.appendText(text_content);
                } else {
                    break reset;
                }
                tag_name = new StringBuilder();
                text_content = "";
                machine = new Machine(tag_reader, tag_name);
                continue;
            }
            text_content += c;
        }
        if (machine && machine.current_state === comment && strict_comment) {
            error("unclosed comment", stream);
        }
        doc.appendText(text_content);
        return doc.build();
    }
    const reader = {
        conf,
        read
    };
    Object.freeze(reader);
    return reader;
}

for (let r_conf in reader_confs) {
    readers[r_conf] = reader(reader_confs[r_conf]);
}

const writer_confs = {
    default: {
        indent: undefined,
        autoclose: false,
        spacing: "",
        escape_set: "minimal"
    },
    compress: {
        autoclose: true
    },
    beautify: {
        indent: "  ",
        spacing: "\n",
    }
};

let writers = {};

function writer(conf) {
    if (typeof (conf) !== "object") {
        return writers[conf] || writers.default;
    }

    conf = Object.freeze(lustils.object.complete(conf, writer_confs.default));

    const {
        indent,
        autoclose,
        spacing,
        escape_set
    } = conf;

    const escapes = escape_sets[escape_set] || escape_sets.minimal;

    function writeIndent(level, out) {
        if (!indent) {
            return;
        }
        for (let i = 0; i < level; i++) {
            out.write(indent);
        }
    }

    function _write(elem, out, level) {
        out.write(spacing);
        for (let child of elem.content) {
            writeIndent(level, out);
            if (typeof (child) === "string") {
                for (let c of child) {
                    let e;
                    if ((e = escapes[c]) !== undefined) {
                        out.write("&");
                        out.write(e);
                        out.write(";");
                    } else {
                        let code = c.charCodeAt(0);
                        if (code <= 31 || code === 127) {
                            out.write("&");
                            out.write(code.toString(16));
                            out.write(";");
                        }
                    }
                }
                out.write(child);
            } else {
                out.write("<");
                out.write(child.name);
                out.write(">");
                _write(child, out, level + 1);
                out.write("</");
                if (!autoclose) {
                    out.write(child.name);
                }
                out.write(">");
            }
            out.write(spacing);
        }
    }

    function write(doc, out) {
        out = obtainOutputStream(out);
        _write(doc, out, 0);
        return out;
    }

    const writer = {
        conf,
        write
    };

    Object.freeze(writer);

    return writer;
}

for (let w_conf in writer_confs) {
    writers[w_conf] = writer(writer_confs[w_conf]);
}

function isInvalidEntry(entry) {
    return entry.name !== "entry" || entry.content.length !== 2 || entry.content[1].name !== "value" || entry.content[1].content.length !== 1;
}

function readObj(obj) {
    if (typeof (obj) === "string") {
        return obj;
    } else {
        if (obj.name === "nil") {
            return undefined;
        }
        if (obj.name === "true") {
            return true;
        }
        if (obj.name === "false") {
            return false;
        }
        if (obj.name === "text") {
            if (obj.content.length === 1) {
                return "";
            } else if (obj.content.length === 1) {
                return obj.content[0];
            } else {
                throw new InputError("invalid text");
            }
        }
        if (obj.name === "number") {
            if (obj.content.length === 1) {
                return Number.parseFloat(obj.content[0]);
            } else {
                throw new InputError("invalid number");
            }
        }
        let result;
        if (obj.name === "set") {
            result = new Set();
            for (let elem of obj.content) {
                result.add(readObj(elem));
            }
        } else if (obj.name === "list") {
            result = [];
            for (let elem of obj.content) {
                result.push(readObj(elem));
            }
        } else if (obj.name === "map") {
            result = new Map();
            for (let entry of obj.content) {
                if (isInvalidEntry(entry)) {
                    throw new InputError("invalid entry");
                }
                result.set(readObj(entry.content[0]), entry.content[1].content[0]);
            }
        } else if (obj.name === "dictionairy") {
            result = {};
            for (let entry of obj.content) {
                if (isInvalidEntry(entry)) {
                    throw new InputError("invalid entry");
                }
                result[readObj(entry.content[0])] = entry.content[1].content[0];
            }
        }
        return result;
    }
}

// Note: Right now there is no usage for conf, but there may be later, and the below code ensures backwards compat later on

let object_readers = {};

const object_reader_confs = {
    default: {}
};

function objectReader(conf) {
    if (typeof (conf) !== "object") {
        return object_readers[conf] || object_readers.default;
    }

    conf = Object.freeze(lustils.object.complete(conf, object_reader_confs.default));

    function read(doc) {
        if (doc.content.length === 1) {
            return readObj(doc.content[0]);
        } else if (doc.content.length > 1) {
            let list = [];
            for (let element of doc.content) {
                list.push(element);
            }
            return list;
        }
        throw new InputError("Empty document");
    }

    const reader = {
        conf,
        read
    };

    Object.freeze(reader);

    return reader;
}

for (let or_conf in object_reader_confs) {
    object_readers[or_conf] = objectReader(object_reader_confs[or_conf]);
}

let object_writers = {};

const object_writer_confs = {
    default: {
        write_function: "writeSML"
    },
    strict: {
        write_function: undefined
    }
};

function objectWriter(conf) {
    if (typeof (conf) !== "object") {
        return object_writers[conf] || object_writers.default;
    }

    conf = Object.freeze(lustils.object.complete(conf, object_writer_confs.default));
    const write_function = conf.write_function;

    function _writeMap(map, parent) {
        for (let key in map) {
            let elem = new Element("entry");
            elem.appendChild(write(key));
            let value = new Element("value");
            value.appendChild(write(value));
            elem.appendChild(value);
            parent.appendChild(elem);
        }
    }

    function write(object) {
        let element;
        if (object === true) {
            element = new Element("true", false);
        } else if (object === false) {
            element = new Element("false", false);
        } else if (object === undefined || object === null) {
            element = new Element("nil", false);
        } else {
            let t = typeof (object);
            if (t === "string") {
                element = new Element("text");
                element.appendText(object);
            } else if (t === "number") {
                let element = new Element("number");
                element.appendText(object.toString(10));
            } else if (t === "object") {
                if (Array.isArray(object)) {
                    element = new Element("list");
                    for (let elem of object) {
                        element.appendChild(write(elem));
                    }
                } else if (object instanceof Set) {
                    element = new Element("set");
                    for (let elem of object) {
                        element.appendChild(write(elem));
                    }
                } else if (object instanceof Map) {
                    element = new Element("map");
                    _writeMap(object, element);
                } else {
                    let wfunc;
                    if (write_function && (wfunc = object[write_function]) && typeof (object(wfunc)) === "function") {
                        element.content.push(wfunc());
                    } else {
                        element = new Element("dictionairy");
                        _writeMap(object, element);
                    }
                }
            } else {
                throw new InputError("invalid object");
            }
        }
        return element;
    }

    const writer = {
        conf,
        write,
    };

    return Object.freeze(writer);
}

for (let ow_conf in object_writer_confs) {
    object_writers[ow_conf] = objectWriter(object_writer_confs[ow_conf]);
}

let exps = {
    reader,
    objectReader,
    readObject: objectReader().read,
    read: reader().read,
    readStrict: reader("strict").read,
    readIgnore: reader("ignore").read,
    writer,
    write: writer().write,
    writeCompressed: writer("compress").write,
    writeBeautified: writer("beautify").write,
    objectWriter,
    writeObject: objectWriter().write,
    writeObjectStrict: objectWriter("strict").write
};

for (let write_func of ["write", "writeCompressed", "writeBeautified"]) {
    exps[write_func + "Text"] = object => exps[write_func](object).text;
}

for (let e in dom) {
    exps[e] = dom[e];
}

module.exports = exps;
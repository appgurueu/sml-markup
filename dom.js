"use strict";
const lustils = require("lustils");

const {
    InputError
} = lustils.error;

class Element {
    constructor(name, ...content) {
        this.name = name;
        if (content) {
            this.content = [];
            for (let val of content) {
                if (typeof(val) === "string") {
                    this.appendText(val);
                } else {
                    this.appendChild(val instanceof Element ? val:(Array.isArray(val) ? new Element(val[0], val[1]):new Element(val.name, val.content)));
                }
            }
        }
    }

    appendText(text) {
        if (text.length === 0) {
            return;
        }
        let last = this.content[this.content.length - 1];
        if (typeof (last) !== "string") {
            this.content.push(text);
        } else {
            this.content[this.content.length - 1] = last + text;
        }
    }

    appendChild(element) {
        this.content.push(element);
        element.parent = this;
    }
}

class Document extends Element {
    constructor(...content) {
        super(undefined, ...content);
    }
}

class ElementBuilder {
    constructor(element) {
        this.root = element;
        this.active_tag = this.root;
    }

    closeAuto() {
        this.active_tag = this.active_tag.parent;
    }

    appendChild(element) {
        this.active_tag.appendChild(element);
    }

    openChild(element) {
        this.appendChild(element);
        this.active_tag = element;
    }

    appendText(text) {
        this.active_tag.appendText(text);
    }

    build() {
        return this.root;
    }
}

class ForcingElementBuilder extends ElementBuilder {
    closeElement(_name) {
        this.closeAuto();
    }
}

class IgnoringElementBuilder extends ElementBuilder {
    closeElement(name) {
        if (this.active_tag.name === name) {
            this.active_tag = this.active_tag.parent;
        }
    }
}

class StrictElementBuilder extends ElementBuilder {
    closeElement(name) {
        if (this.active_tag.name === name) {
            this.active_tag = this.active_tag.parent;
        } else {
            throw new InputError("invalid closing tag");
        }
    }
}

class SearchingElementBuilder extends ElementBuilder {
    closeElement(name) {
        let cursor = this.active_tag;
        while (cursor.name !== name && cursor.parent) {
            cursor = cursor.parent;
        }
        this.active_tag = cursor.parent;
    }
}

class StrictSearchingElementBuilder extends ElementBuilder {
    closeElement(name) {
        let cursor = this.active_tag;
        while (cursor.name !== name) {
            if (!cursor.parent) {
                throw new InputError("invalid closing tag");
            }
            cursor = cursor.parent;
        }
        this.active_tag = cursor.parent;
    }
}

class ForcingSearchingElementBuilder extends ElementBuilder {
    closeElement(name) {
        let cursor = this.active_tag;
        while (cursor.name !== name) {
            if (!cursor.parent) {
                this.active_tag = this.active_tag.parent;
                return;
            }
            cursor = cursor.parent;
        }
        this.active_tag = cursor.parent;
    }
}

class IgnoringSearchingElementBuilder extends ElementBuilder {
    closeElement(name) {
        let cursor = this.active_tag;
        while (cursor.name !== name) {
            if (!cursor.parent) {
                return;
            }
            cursor = cursor.parent;
        }
        this.active_tag = cursor.parent;
    }
}

module.exports = {
    Element,
    Document,
    ElementBuilder,
    element_builders: {
        forcing: ForcingElementBuilder,
        strict: StrictElementBuilder,
        ignoring: IgnoringElementBuilder,
        searching: SearchingElementBuilder,
        strict_searching: StrictSearchingElementBuilder,
        forcing_searching: ForcingSearchingElementBuilder,
        ignoring_searching: IgnoringSearchingElementBuilder
    },
    ForcingElementBuilder,
    StrictElementBuilder,
    IgnoringElementBuilder,
    SearchingElementBuilder,
    StrictSearchingElementBuilder,
    ForcingSearchingElementBuilder,
    IgnoringSearchingElementBuilder
};
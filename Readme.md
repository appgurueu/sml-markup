# SML

Small & Simple Markup Language. Similar to XML.

## Specification

### Context-Free Grammar

The entire syntax (including semantic tokens) is notated in BNF as follows:

Nonterminals: `<nonterminal>`, terminals: `"terminal"`, productions: `<a1> = <b1> + "b2" + ... | ...`

```bnf
<digit> = "1"-"9"
<hex_digit> = <digit> | "a"-"f" | "A"-"F"
<letter> = "a"-"z" | "A"-"Z"
<letter_or_underscore> = <letter> | "_"
<any> = "\u00000" - "\u10FFFF"
<word> = <letter> | <letter> + <word>
<tag_name> = <letter_or_underscore> | <letter_or_underscore> + <tag_name>
<space> = " " | "\t" | "\n"
<spaces> = <space> | <space> + <spaces>
<two_digits> = <hex_digit> + <hex_digit>
<four_digits> = <two_digits> + <two_digits>
<escape_num> = <hex_digit> | <two_digits> | <hex_digit> + <two_digits> | <four_digits> | <hex_digit> + <four_digits> | <two_digits> + <four_digits>
<escape_tex> = <word>
<escape_con> = "#" + <escape_num> | <escape_tex>
<escape_seq> = "&" + <escape_con> + ";"
<opening_tag> = "<" + <tag_name> + ">"
<closing_tag> = "</" + <tag_name> + ">"
<self_enclosing_tag> = "<" + <tag_name> + "/>"
<content> = <any> | <any> + <content>
<tag_con> = <tag> | <content> | <tag_con> <tag_con>
<tag_content> = "" | <spaces> | <spaces> + <tag_con> + <spaces>
<tag_start> = <opening_tag> + <tag_content>
<comment> = "<!--" + <content> + "-->"
<tag> = <tag_start> <closing_tag> | <self_enclosing_tag> | <tag_start> + "</>" | <comment>
<document> = "" | <tag_content>
```

### Explanation

SML resembles XML. It is dramatically simplified, however, to the better for some applications.#
There are some differences, though. For example, SML doesn't allow you to have spaces in tags (like `<tag   >`) as there's no need for spaces as there are no attributes.

SML is particularly useful for ASTs (Abstract Syntax Trees) performed by the tokenizer using a CFG (like the one above).

In general, it is a language for noting nested tree hierarchies. Branches of the tree are represented using tags, the root being the document, and you can think of content as "leaves".

Escape sequences are written as codepoint or identifier, with `&` and `;` enclosing the sequence. To escape `<`, for example, use `&lt;`.

The content of each tag is trimmed, i.e. spacing is removed at the beginning & the end. `" \t\n con tent \n "` would become `"con tent"`.
You can force spaces, however, by using escapes - `"&20;\t\n con tent \n&20;"` would remain the same (but the escapes would be converted).

Regarding indentation: the spaces until the first newline of a tag's content are stored as indentation, and are repeatedly removed after each newline.

### Example

```sml
An example document
<body>
    <!-- No attributes, use tags instead -->
    <attribute>value</attribute>
    <!-- Syntactic Sugar -->
    <attr>value</>
    <booleanAttr/>
    Some content, spaces are trimmed
    Indentation works as well
<body>
```

### Object Notation

Similar to [Luon](https://github.com/appgurueu/luon), SML can be used for representing any object.

* Atomics: Self-enclosing tags: the booleans `<true/>` and `<false/>` as well as `<nil\>` (both `null` & `undefined`)
* Numbers: `<number>` tag with decimal representation as content
* Text: Implicit (`text` would be `"text"`), but `text` tag can be used
* Lists: `<list>` tag containing all elements
* Sets: `<set>` tag containing all elements
* Objects: `<dictionairy>` tag with `<entry>key<value>value</value></entry>` entries
* Maps: Same as objects, however using the `<map>` tag

## API

Note that the architecture of SML resembles [Luon](https://npmjs.com/package/luon).

### Versions

* 1.0.0
  * Initial release

### Installation

Install the NPM package [`sml-markup`](https://npmjs.com/package/sml-markup):

```bash
npm install s-m-l
```

The API supports various levels of restrictions, and thus many functions are configurable.

### Import

```javascript
const sml=require("sml-markup");
```
#### DOM

The document object model is quite simple in SML.
Every tag is an `Element` in SML - even the root element, the document, is one. 

##### `Element`

* `name`: tag name, `undefined` for the `Document` element.
* `content`: array of element content, `undefined` for self enclosing tags
  
##### `Document`

Extends `Element`, but has no name.

##### Element Builders

###### `ElementBuilder`

The base element builder which helps you create a DOM by having a pointer to the current open tag and allowing operations like auto closing, opening, appending etc. All `ElementBuilder`s can be accessed using the following lookup, or `NameInCamelCase` + `ElementBuilder` (for example `StrictSearchingElementBuilder`).

###### **`element_builders`**

Various inheriting classes, which only differ in the way they handle closing tags by name.

###### `forcing`

Always closes the current open tag.

###### `strict`

Will throw an error if the current active tag has a different name.

###### `ignoring`

Silently ignores that the current open tag can not be closed.

###### `searching`

Searches for a matching tag and closes the top tag if none is found.

###### `strict_searching`

Searches for a matching tag and if none is found, throws an error.

###### `forcing_searching`

Searches for a matching tag and if none is found, closes the current tag.

###### `ignore_searching`

Searches for a matching tag and closes it. Silently fails.

#### Reading

Operates on streams, just like Luon.

##### `reader(config)`

Creates a reader with a `read(input_stream)` function which returns a SML DOM.
`config` can either be an object with configuration options, or a name to look up from the predefined readers.

Examples: 

```javascript
const html_escape_reader = sml.reader({escape_set: "html"});
const default_reader = sml.reader();
const strict = sml.reader("strict");
const ignoring = sml.reader("ignoring");
```

###### `readStrict`

Shorthand for `sml.reader("strict").read`

###### `readIgnore`

Shorthand for `sml.reader("ignore").read`

##### `objectReader(config)`

Creates an object reader with a `read(dom)` function which returns a JS object.
`config` can either be an object with configuration options, or a name to look up from the predefined readers.

###### `readObject(dom)`

Shorthand for `sml.objectReader().read`

#### Writing

Operates on streams as well, just like Luon.

##### `writer(config)`

Creates a writer with a `write(output_stream)` function which returns a SML DOM.
`config` can either be an object with configuration options, or a name to look up from the predefined readers.

Examples: 

```javascript
const html_escape_writer = sml.writer({escape_set: "html"});
const default_reader = sml.writer();
const compressing = sml.writer("compress");
const beautifying = sml.writer("beautify");
```

##### `objectWriter(config)`

Creates an object writer with a `write(object)` function which returns a SML DOM representing the object.
`config` can either be an object with configuration options, or a name to look up from the predefined readers.

###### `writeObject(dom)`

Shorthand for `sml.objectWriter().read`

###### `writeObjectStrict(dom)`

Shorthand for `sml.objectWriter("strict").read`

## Recommendations

Do **not** confuse SML and XML; they are similar, but SML is not fully compatible with XML.
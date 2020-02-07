"use strict";
const litest = require("litests");
const sml = require("./index.js");

new litest.BulkTester(sml).testEqualsAll([
    "read",
    {
        "content": new sml.Document("content"),
        "con<!--comment-->tent": new sml.Document("content"),
        "<tag><tag>content</tag></tag>": new sml.Document(["tag", ["tag", "content"]]),
        "1&lt;2": new sml.Document("1<2")
    },
    "writeText", [
        new sml.Document("test"), "test"
    ]
]);
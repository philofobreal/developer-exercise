// @ts-nocheck
// Generated from docs/schema.json by scripts/sync-schema.mjs. Do not edit.
"use strict";
export const validate = validate20;
export default validate20;
const schema31 = { "$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "https://philofobreal.github.io/developer-exercise/schema.json", "title": "ngDynamic CodeLine v2 Exercise", "type": "object", "additionalProperties": false, "required": ["schemaVersion", "id", "revision", "language", "title", "description", "lines", "blocks"], "properties": { "schemaVersion": { "const": 2 }, "id": { "type": "string", "minLength": 1, "maxLength": 200 }, "revision": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "language": { "enum": ["javascript", "typescript"] }, "title": { "type": "string", "maxLength": 140 }, "description": { "type": "string", "maxLength": 500 }, "lines": { "type": "array", "minItems": 1, "maxItems": 500, "items": { "$ref": "#/$defs/codeLine" } }, "blocks": { "type": "array", "maxItems": 250, "items": { "$ref": "#/$defs/block" } }, "edges": { "type": "array", "items": { "$ref": "#/$defs/edge" }, "maxItems": 5000 }, "profiles": { "type": "array", "maxItems": 32, "items": { "type": "object", "required": ["id", "edges"], "additionalProperties": false, "properties": { "id": { "type": "string", "minLength": 1, "maxLength": 200 }, "edges": { "type": "array", "items": { "$ref": "#/$defs/edge" }, "maxItems": 5000 } } } }, "authoring": { "type": "object", "additionalProperties": false, "properties": { "strategy": { "type": "string", "maxLength": 100 }, "reason": { "type": "string", "maxLength": 500 }, "note": { "type": "string", "maxLength": 1000 }, "omittedBlocks": { "type": "integer", "minimum": 0, "maximum": 500 }, "semanticEquivalenceProven": { "const": false }, "dependencyHints": { "type": "array", "maxItems": 200, "items": { "type": "object", "additionalProperties": false, "required": ["name", "declarationLine", "usageLine"], "properties": { "name": { "type": "string", "maxLength": 2048 }, "declarationLine": { "type": "integer", "minimum": 1, "maximum": 50000 }, "usageLine": { "type": "integer", "minimum": 1, "maximum": 50000 } } } }, "dependencyPolicy": { "type": "string", "enum": ["primitive-const-islands-v1", "scoped-primitive-dag-v2"] } } } }, "$defs": { "codeLine": { "type": "object", "additionalProperties": false, "required": ["id", "code", "dependencies", "fixed", "functionBlock", "scopeId"], "properties": { "id": { "type": "integer", "minimum": 1, "maximum": 9007199254740991, "description": "Stable identity within this exercise revision; never the current solution position." }, "code": { "type": "string", "maxLength": 2048, "pattern": "^[^\\r\\n\\u2028\\u2029]*$" }, "dependencies": { "type": "array", "uniqueItems": true, "items": { "type": "integer", "minimum": 1 }, "maxItems": 500, "description": "IDs of all required predecessors. Each must occur earlier, at any distance; array order is irrelevant." }, "fixed": { "type": "boolean" }, "functionBlock": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "scopeId": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 200 }, { "type": "null" }] }, "normalization": { "enum": ["indent", "exact"] }, "sourceLine": { "type": "integer", "minimum": 1, "maximum": 50000, "description": "Optional one-based original physical source line; informational, never an identity or ordering constraint." } } }, "block": { "type": "object", "additionalProperties": false, "required": ["id", "kind", "parentScopeId", "openLineId", "closeLineId"], "properties": { "id": { "type": "string", "minLength": 1, "maxLength": 200 }, "kind": { "enum": ["function", "block"] }, "functionBlock": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "parentScopeId": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 200 }, { "type": "null" }] }, "openLineId": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "closeLineId": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } }, "anyOf": [{ "properties": { "kind": { "const": "function" }, "functionBlock": {} }, "required": ["functionBlock"] }, { "properties": { "kind": { "const": "block" } }, "not": { "required": ["functionBlock"], "properties": { "functionBlock": {} } } }] }, "edge": { "type": "object", "additionalProperties": false, "required": ["before", "after"], "properties": { "before": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "after": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } } } } };
const schema32 = { "type": "object", "additionalProperties": false, "required": ["id", "code", "dependencies", "fixed", "functionBlock", "scopeId"], "properties": { "id": { "type": "integer", "minimum": 1, "maximum": 9007199254740991, "description": "Stable identity within this exercise revision; never the current solution position." }, "code": { "type": "string", "maxLength": 2048, "pattern": "^[^\\r\\n\\u2028\\u2029]*$" }, "dependencies": { "type": "array", "uniqueItems": true, "items": { "type": "integer", "minimum": 1 }, "maxItems": 500, "description": "IDs of all required predecessors. Each must occur earlier, at any distance; array order is irrelevant." }, "fixed": { "type": "boolean" }, "functionBlock": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "scopeId": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 200 }, { "type": "null" }] }, "normalization": { "enum": ["indent", "exact"] }, "sourceLine": { "type": "integer", "minimum": 1, "maximum": 50000, "description": "Optional one-based original physical source line; informational, never an identity or ordering constraint." } } };
const schema33 = { "type": "object", "additionalProperties": false, "required": ["id", "kind", "parentScopeId", "openLineId", "closeLineId"], "properties": { "id": { "type": "string", "minLength": 1, "maxLength": 200 }, "kind": { "enum": ["function", "block"] }, "functionBlock": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "parentScopeId": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 200 }, { "type": "null" }] }, "openLineId": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "closeLineId": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } }, "anyOf": [{ "properties": { "kind": { "const": "function" }, "functionBlock": {} }, "required": ["functionBlock"] }, { "properties": { "kind": { "const": "block" } }, "not": { "required": ["functionBlock"], "properties": { "functionBlock": {} } } }] };
const schema34 = { "type": "object", "additionalProperties": false, "required": ["before", "after"], "properties": { "before": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "after": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } } };
const func1 = Object.prototype.hasOwnProperty;
const func2 = ((value) => Array.from(value).length);
const pattern4 = new RegExp("^[^\\r\\n\\u2028\\u2029]*$", "u");
function validate20(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) { /*# sourceURL="https://philofobreal.github.io/developer-exercise/schema.json" */ ; let vErrors = null; let errors = 0; const evaluated0 = validate20.evaluated; if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
} if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if (((((((((data.schemaVersion === undefined) && (missing0 = "schemaVersion")) || ((data.id === undefined) && (missing0 = "id"))) || ((data.revision === undefined) && (missing0 = "revision"))) || ((data.language === undefined) && (missing0 = "language"))) || ((data.title === undefined) && (missing0 = "title"))) || ((data.description === undefined) && (missing0 = "description"))) || ((data.lines === undefined) && (missing0 = "lines"))) || ((data.blocks === undefined) && (missing0 = "blocks"))) {
            validate20.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!(func1.call(schema31.properties, key0))) {
                    validate20.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.schemaVersion !== undefined) {
                    const _errs2 = errors;
                    if (2 !== data.schemaVersion) {
                        validate20.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: 2 }, message: "must be equal to constant" }];
                        return false;
                    }
                    var valid0 = _errs2 === errors;
                }
                else {
                    var valid0 = true;
                }
                if (valid0) {
                    if (data.id !== undefined) {
                        let data1 = data.id;
                        const _errs3 = errors;
                        if (errors === _errs3) {
                            if (typeof data1 === "string") {
                                if (func2(data1) > 200) {
                                    validate20.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                    return false;
                                }
                                else {
                                    if (func2(data1) < 1) {
                                        validate20.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                    }
                                }
                            }
                            else {
                                validate20.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                            }
                        }
                        var valid0 = _errs3 === errors;
                    }
                    else {
                        var valid0 = true;
                    }
                    if (valid0) {
                        if (data.revision !== undefined) {
                            let data2 = data.revision;
                            const _errs5 = errors;
                            if (!(((typeof data2 == "number") && (!(data2 % 1) && !isNaN(data2))) && (isFinite(data2)))) {
                                validate20.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                return false;
                            }
                            if (errors === _errs5) {
                                if ((typeof data2 == "number") && (isFinite(data2))) {
                                    if (data2 > 9007199254740991 || isNaN(data2)) {
                                        validate20.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                        return false;
                                    }
                                    else {
                                        if (data2 < 1 || isNaN(data2)) {
                                            validate20.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                            return false;
                                        }
                                    }
                                }
                            }
                            var valid0 = _errs5 === errors;
                        }
                        else {
                            var valid0 = true;
                        }
                        if (valid0) {
                            if (data.language !== undefined) {
                                let data3 = data.language;
                                const _errs7 = errors;
                                if (!((data3 === "javascript") || (data3 === "typescript"))) {
                                    validate20.errors = [{ instancePath: instancePath + "/language", schemaPath: "#/properties/language/enum", keyword: "enum", params: { allowedValues: schema31.properties.language.enum }, message: "must be equal to one of the allowed values" }];
                                    return false;
                                }
                                var valid0 = _errs7 === errors;
                            }
                            else {
                                var valid0 = true;
                            }
                            if (valid0) {
                                if (data.title !== undefined) {
                                    let data4 = data.title;
                                    const _errs8 = errors;
                                    if (errors === _errs8) {
                                        if (typeof data4 === "string") {
                                            if (func2(data4) > 140) {
                                                validate20.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/maxLength", keyword: "maxLength", params: { limit: 140 }, message: "must NOT have more than 140 characters" }];
                                                return false;
                                            }
                                        }
                                        else {
                                            validate20.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                        }
                                    }
                                    var valid0 = _errs8 === errors;
                                }
                                else {
                                    var valid0 = true;
                                }
                                if (valid0) {
                                    if (data.description !== undefined) {
                                        let data5 = data.description;
                                        const _errs10 = errors;
                                        if (errors === _errs10) {
                                            if (typeof data5 === "string") {
                                                if (func2(data5) > 500) {
                                                    validate20.errors = [{ instancePath: instancePath + "/description", schemaPath: "#/properties/description/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" }];
                                                    return false;
                                                }
                                            }
                                            else {
                                                validate20.errors = [{ instancePath: instancePath + "/description", schemaPath: "#/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                return false;
                                            }
                                        }
                                        var valid0 = _errs10 === errors;
                                    }
                                    else {
                                        var valid0 = true;
                                    }
                                    if (valid0) {
                                        if (data.lines !== undefined) {
                                            let data6 = data.lines;
                                            const _errs12 = errors;
                                            if (errors === _errs12) {
                                                if (Array.isArray(data6)) {
                                                    if (data6.length > 500) {
                                                        validate20.errors = [{ instancePath: instancePath + "/lines", schemaPath: "#/properties/lines/maxItems", keyword: "maxItems", params: { limit: 500 }, message: "must NOT have more than 500 items" }];
                                                        return false;
                                                    }
                                                    else {
                                                        if (data6.length < 1) {
                                                            validate20.errors = [{ instancePath: instancePath + "/lines", schemaPath: "#/properties/lines/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                            return false;
                                                        }
                                                        else {
                                                            var valid1 = true;
                                                            const len0 = data6.length;
                                                            for (let i0 = 0; i0 < len0; i0++) {
                                                                let data7 = data6[i0];
                                                                const _errs14 = errors;
                                                                const _errs15 = errors;
                                                                if (errors === _errs15) {
                                                                    if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
                                                                        let missing1;
                                                                        if (((((((data7.id === undefined) && (missing1 = "id")) || ((data7.code === undefined) && (missing1 = "code"))) || ((data7.dependencies === undefined) && (missing1 = "dependencies"))) || ((data7.fixed === undefined) && (missing1 = "fixed"))) || ((data7.functionBlock === undefined) && (missing1 = "functionBlock"))) || ((data7.scopeId === undefined) && (missing1 = "scopeId"))) {
                                                                            validate20.errors = [{ instancePath: instancePath + "/lines/" + i0, schemaPath: "#/$defs/codeLine/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                                                            return false;
                                                                        }
                                                                        else {
                                                                            const _errs17 = errors;
                                                                            for (const key1 in data7) {
                                                                                if (!((((((((key1 === "id") || (key1 === "code")) || (key1 === "dependencies")) || (key1 === "fixed")) || (key1 === "functionBlock")) || (key1 === "scopeId")) || (key1 === "normalization")) || (key1 === "sourceLine"))) {
                                                                                    validate20.errors = [{ instancePath: instancePath + "/lines/" + i0, schemaPath: "#/$defs/codeLine/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                                                                    return false;
                                                                                    break;
                                                                                }
                                                                            }
                                                                            if (_errs17 === errors) {
                                                                                if (data7.id !== undefined) {
                                                                                    let data8 = data7.id;
                                                                                    const _errs18 = errors;
                                                                                    if (!(((typeof data8 == "number") && (!(data8 % 1) && !isNaN(data8))) && (isFinite(data8)))) {
                                                                                        validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/id", schemaPath: "#/$defs/codeLine/properties/id/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                        return false;
                                                                                    }
                                                                                    if (errors === _errs18) {
                                                                                        if ((typeof data8 == "number") && (isFinite(data8))) {
                                                                                            if (data8 > 9007199254740991 || isNaN(data8)) {
                                                                                                validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/id", schemaPath: "#/$defs/codeLine/properties/id/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                return false;
                                                                                            }
                                                                                            else {
                                                                                                if (data8 < 1 || isNaN(data8)) {
                                                                                                    validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/id", schemaPath: "#/$defs/codeLine/properties/id/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                    return false;
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    var valid3 = _errs18 === errors;
                                                                                }
                                                                                else {
                                                                                    var valid3 = true;
                                                                                }
                                                                                if (valid3) {
                                                                                    if (data7.code !== undefined) {
                                                                                        let data9 = data7.code;
                                                                                        const _errs20 = errors;
                                                                                        if (errors === _errs20) {
                                                                                            if (typeof data9 === "string") {
                                                                                                if (func2(data9) > 2048) {
                                                                                                    validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/code", schemaPath: "#/$defs/codeLine/properties/code/maxLength", keyword: "maxLength", params: { limit: 2048 }, message: "must NOT have more than 2048 characters" }];
                                                                                                    return false;
                                                                                                }
                                                                                                else {
                                                                                                    if (!pattern4.test(data9)) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/code", schemaPath: "#/$defs/codeLine/properties/code/pattern", keyword: "pattern", params: { pattern: "^[^\\r\\n\\u2028\\u2029]*$" }, message: "must match pattern \"" + "^[^\\r\\n\\u2028\\u2029]*$" + "\"" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                            else {
                                                                                                validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/code", schemaPath: "#/$defs/codeLine/properties/code/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                return false;
                                                                                            }
                                                                                        }
                                                                                        var valid3 = _errs20 === errors;
                                                                                    }
                                                                                    else {
                                                                                        var valid3 = true;
                                                                                    }
                                                                                    if (valid3) {
                                                                                        if (data7.dependencies !== undefined) {
                                                                                            let data10 = data7.dependencies;
                                                                                            const _errs22 = errors;
                                                                                            if (errors === _errs22) {
                                                                                                if (Array.isArray(data10)) {
                                                                                                    if (data10.length > 500) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/dependencies", schemaPath: "#/$defs/codeLine/properties/dependencies/maxItems", keyword: "maxItems", params: { limit: 500 }, message: "must NOT have more than 500 items" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                    else {
                                                                                                        var valid4 = true;
                                                                                                        const len1 = data10.length;
                                                                                                        for (let i1 = 0; i1 < len1; i1++) {
                                                                                                            let data11 = data10[i1];
                                                                                                            const _errs24 = errors;
                                                                                                            if (!(((typeof data11 == "number") && (!(data11 % 1) && !isNaN(data11))) && (isFinite(data11)))) {
                                                                                                                validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/dependencies/" + i1, schemaPath: "#/$defs/codeLine/properties/dependencies/items/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                                return false;
                                                                                                            }
                                                                                                            if (errors === _errs24) {
                                                                                                                if ((typeof data11 == "number") && (isFinite(data11))) {
                                                                                                                    if (data11 < 1 || isNaN(data11)) {
                                                                                                                        validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/dependencies/" + i1, schemaPath: "#/$defs/codeLine/properties/dependencies/items/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                        return false;
                                                                                                                    }
                                                                                                                }
                                                                                                            }
                                                                                                            var valid4 = _errs24 === errors;
                                                                                                            if (!valid4) {
                                                                                                                break;
                                                                                                            }
                                                                                                        }
                                                                                                        if (valid4) {
                                                                                                            let i2 = data10.length;
                                                                                                            let j0;
                                                                                                            if (i2 > 1) {
                                                                                                                const indices0 = {};
                                                                                                                for (; i2--;) {
                                                                                                                    let item0 = data10[i2];
                                                                                                                    if (!(((typeof item0 == "number") && (!(item0 % 1) && !isNaN(item0))) && (isFinite(item0)))) {
                                                                                                                        continue;
                                                                                                                    }
                                                                                                                    if (typeof indices0[item0] == "number") {
                                                                                                                        j0 = indices0[item0];
                                                                                                                        validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/dependencies", schemaPath: "#/$defs/codeLine/properties/dependencies/uniqueItems", keyword: "uniqueItems", params: { i: i2, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i2 + " are identical)" }];
                                                                                                                        return false;
                                                                                                                        break;
                                                                                                                    }
                                                                                                                    indices0[item0] = i2;
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                                else {
                                                                                                    validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/dependencies", schemaPath: "#/$defs/codeLine/properties/dependencies/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                                                                    return false;
                                                                                                }
                                                                                            }
                                                                                            var valid3 = _errs22 === errors;
                                                                                        }
                                                                                        else {
                                                                                            var valid3 = true;
                                                                                        }
                                                                                        if (valid3) {
                                                                                            if (data7.fixed !== undefined) {
                                                                                                const _errs26 = errors;
                                                                                                if (typeof data7.fixed !== "boolean") {
                                                                                                    validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/fixed", schemaPath: "#/$defs/codeLine/properties/fixed/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                                                                                    return false;
                                                                                                }
                                                                                                var valid3 = _errs26 === errors;
                                                                                            }
                                                                                            else {
                                                                                                var valid3 = true;
                                                                                            }
                                                                                            if (valid3) {
                                                                                                if (data7.functionBlock !== undefined) {
                                                                                                    let data13 = data7.functionBlock;
                                                                                                    const _errs28 = errors;
                                                                                                    if (!(((typeof data13 == "number") && (!(data13 % 1) && !isNaN(data13))) && (isFinite(data13)))) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/functionBlock", schemaPath: "#/$defs/codeLine/properties/functionBlock/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                    if (errors === _errs28) {
                                                                                                        if ((typeof data13 == "number") && (isFinite(data13))) {
                                                                                                            if (data13 > 9007199254740991 || isNaN(data13)) {
                                                                                                                validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/functionBlock", schemaPath: "#/$defs/codeLine/properties/functionBlock/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                                return false;
                                                                                                            }
                                                                                                            else {
                                                                                                                if (data13 < 0 || isNaN(data13)) {
                                                                                                                    validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/functionBlock", schemaPath: "#/$defs/codeLine/properties/functionBlock/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                                    return false;
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                    var valid3 = _errs28 === errors;
                                                                                                }
                                                                                                else {
                                                                                                    var valid3 = true;
                                                                                                }
                                                                                                if (valid3) {
                                                                                                    if (data7.scopeId !== undefined) {
                                                                                                        let data14 = data7.scopeId;
                                                                                                        const _errs30 = errors;
                                                                                                        const _errs31 = errors;
                                                                                                        let valid6 = false;
                                                                                                        const _errs32 = errors;
                                                                                                        if (errors === _errs32) {
                                                                                                            if (typeof data14 === "string") {
                                                                                                                if (func2(data14) > 200) {
                                                                                                                    const err0 = { instancePath: instancePath + "/lines/" + i0 + "/scopeId", schemaPath: "#/$defs/codeLine/properties/scopeId/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                                                                                                                    if (vErrors === null) {
                                                                                                                        vErrors = [err0];
                                                                                                                    }
                                                                                                                    else {
                                                                                                                        vErrors.push(err0);
                                                                                                                    }
                                                                                                                    errors++;
                                                                                                                }
                                                                                                                else {
                                                                                                                    if (func2(data14) < 1) {
                                                                                                                        const err1 = { instancePath: instancePath + "/lines/" + i0 + "/scopeId", schemaPath: "#/$defs/codeLine/properties/scopeId/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                                                                                        if (vErrors === null) {
                                                                                                                            vErrors = [err1];
                                                                                                                        }
                                                                                                                        else {
                                                                                                                            vErrors.push(err1);
                                                                                                                        }
                                                                                                                        errors++;
                                                                                                                    }
                                                                                                                }
                                                                                                            }
                                                                                                            else {
                                                                                                                const err2 = { instancePath: instancePath + "/lines/" + i0 + "/scopeId", schemaPath: "#/$defs/codeLine/properties/scopeId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                                                                if (vErrors === null) {
                                                                                                                    vErrors = [err2];
                                                                                                                }
                                                                                                                else {
                                                                                                                    vErrors.push(err2);
                                                                                                                }
                                                                                                                errors++;
                                                                                                            }
                                                                                                        }
                                                                                                        var _valid0 = _errs32 === errors;
                                                                                                        valid6 = valid6 || _valid0;
                                                                                                        const _errs34 = errors;
                                                                                                        if (data14 !== null) {
                                                                                                            const err3 = { instancePath: instancePath + "/lines/" + i0 + "/scopeId", schemaPath: "#/$defs/codeLine/properties/scopeId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                                                                            if (vErrors === null) {
                                                                                                                vErrors = [err3];
                                                                                                            }
                                                                                                            else {
                                                                                                                vErrors.push(err3);
                                                                                                            }
                                                                                                            errors++;
                                                                                                        }
                                                                                                        var _valid0 = _errs34 === errors;
                                                                                                        valid6 = valid6 || _valid0;
                                                                                                        if (!valid6) {
                                                                                                            const err4 = { instancePath: instancePath + "/lines/" + i0 + "/scopeId", schemaPath: "#/$defs/codeLine/properties/scopeId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                                                            if (vErrors === null) {
                                                                                                                vErrors = [err4];
                                                                                                            }
                                                                                                            else {
                                                                                                                vErrors.push(err4);
                                                                                                            }
                                                                                                            errors++;
                                                                                                            validate20.errors = vErrors;
                                                                                                            return false;
                                                                                                        }
                                                                                                        else {
                                                                                                            errors = _errs31;
                                                                                                            if (vErrors !== null) {
                                                                                                                if (_errs31) {
                                                                                                                    vErrors.length = _errs31;
                                                                                                                }
                                                                                                                else {
                                                                                                                    vErrors = null;
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                        var valid3 = _errs30 === errors;
                                                                                                    }
                                                                                                    else {
                                                                                                        var valid3 = true;
                                                                                                    }
                                                                                                    if (valid3) {
                                                                                                        if (data7.normalization !== undefined) {
                                                                                                            let data15 = data7.normalization;
                                                                                                            const _errs36 = errors;
                                                                                                            if (!((data15 === "indent") || (data15 === "exact"))) {
                                                                                                                validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/normalization", schemaPath: "#/$defs/codeLine/properties/normalization/enum", keyword: "enum", params: { allowedValues: schema32.properties.normalization.enum }, message: "must be equal to one of the allowed values" }];
                                                                                                                return false;
                                                                                                            }
                                                                                                            var valid3 = _errs36 === errors;
                                                                                                        }
                                                                                                        else {
                                                                                                            var valid3 = true;
                                                                                                        }
                                                                                                        if (valid3) {
                                                                                                            if (data7.sourceLine !== undefined) {
                                                                                                                let data16 = data7.sourceLine;
                                                                                                                const _errs37 = errors;
                                                                                                                if (!(((typeof data16 == "number") && (!(data16 % 1) && !isNaN(data16))) && (isFinite(data16)))) {
                                                                                                                    validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/sourceLine", schemaPath: "#/$defs/codeLine/properties/sourceLine/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                                    return false;
                                                                                                                }
                                                                                                                if (errors === _errs37) {
                                                                                                                    if ((typeof data16 == "number") && (isFinite(data16))) {
                                                                                                                        if (data16 > 50000 || isNaN(data16)) {
                                                                                                                            validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/sourceLine", schemaPath: "#/$defs/codeLine/properties/sourceLine/maximum", keyword: "maximum", params: { comparison: "<=", limit: 50000 }, message: "must be <= 50000" }];
                                                                                                                            return false;
                                                                                                                        }
                                                                                                                        else {
                                                                                                                            if (data16 < 1 || isNaN(data16)) {
                                                                                                                                validate20.errors = [{ instancePath: instancePath + "/lines/" + i0 + "/sourceLine", schemaPath: "#/$defs/codeLine/properties/sourceLine/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                                return false;
                                                                                                                            }
                                                                                                                        }
                                                                                                                    }
                                                                                                                }
                                                                                                                var valid3 = _errs37 === errors;
                                                                                                            }
                                                                                                            else {
                                                                                                                var valid3 = true;
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                    else {
                                                                        validate20.errors = [{ instancePath: instancePath + "/lines/" + i0, schemaPath: "#/$defs/codeLine/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                        return false;
                                                                    }
                                                                }
                                                                var valid1 = _errs14 === errors;
                                                                if (!valid1) {
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                else {
                                                    validate20.errors = [{ instancePath: instancePath + "/lines", schemaPath: "#/properties/lines/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                    return false;
                                                }
                                            }
                                            var valid0 = _errs12 === errors;
                                        }
                                        else {
                                            var valid0 = true;
                                        }
                                        if (valid0) {
                                            if (data.blocks !== undefined) {
                                                let data17 = data.blocks;
                                                const _errs39 = errors;
                                                if (errors === _errs39) {
                                                    if (Array.isArray(data17)) {
                                                        if (data17.length > 250) {
                                                            validate20.errors = [{ instancePath: instancePath + "/blocks", schemaPath: "#/properties/blocks/maxItems", keyword: "maxItems", params: { limit: 250 }, message: "must NOT have more than 250 items" }];
                                                            return false;
                                                        }
                                                        else {
                                                            var valid7 = true;
                                                            const len2 = data17.length;
                                                            for (let i3 = 0; i3 < len2; i3++) {
                                                                let data18 = data17[i3];
                                                                const _errs41 = errors;
                                                                const _errs42 = errors;
                                                                const _errs44 = errors;
                                                                let valid9 = false;
                                                                const _errs45 = errors;
                                                                if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                                                                    let missing2;
                                                                    if ((data18.functionBlock === undefined) && (missing2 = "functionBlock")) {
                                                                        const err5 = { instancePath: instancePath + "/blocks/" + i3, schemaPath: "#/$defs/block/anyOf/0/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                                                                        if (vErrors === null) {
                                                                            vErrors = [err5];
                                                                        }
                                                                        else {
                                                                            vErrors.push(err5);
                                                                        }
                                                                        errors++;
                                                                    }
                                                                    else {
                                                                        if (data18.kind !== undefined) {
                                                                            if ("function" !== data18.kind) {
                                                                                const err6 = { instancePath: instancePath + "/blocks/" + i3 + "/kind", schemaPath: "#/$defs/block/anyOf/0/properties/kind/const", keyword: "const", params: { allowedValue: "function" }, message: "must be equal to constant" };
                                                                                if (vErrors === null) {
                                                                                    vErrors = [err6];
                                                                                }
                                                                                else {
                                                                                    vErrors.push(err6);
                                                                                }
                                                                                errors++;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                var _valid1 = _errs45 === errors;
                                                                valid9 = valid9 || _valid1;
                                                                if (_valid1) {
                                                                    var props0 = {};
                                                                    props0.kind = true;
                                                                    props0.functionBlock = true;
                                                                }
                                                                const _errs47 = errors;
                                                                const _errs48 = errors;
                                                                const _errs49 = errors;
                                                                if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                                                                    let missing3;
                                                                    if ((data18.functionBlock === undefined) && (missing3 = "functionBlock")) {
                                                                        const err7 = {};
                                                                        if (vErrors === null) {
                                                                            vErrors = [err7];
                                                                        }
                                                                        else {
                                                                            vErrors.push(err7);
                                                                        }
                                                                        errors++;
                                                                    }
                                                                }
                                                                var valid11 = _errs49 === errors;
                                                                if (valid11) {
                                                                    const err8 = { instancePath: instancePath + "/blocks/" + i3, schemaPath: "#/$defs/block/anyOf/1/not", keyword: "not", params: {}, message: "must NOT be valid" };
                                                                    if (vErrors === null) {
                                                                        vErrors = [err8];
                                                                    }
                                                                    else {
                                                                        vErrors.push(err8);
                                                                    }
                                                                    errors++;
                                                                }
                                                                else {
                                                                    errors = _errs48;
                                                                    if (vErrors !== null) {
                                                                        if (_errs48) {
                                                                            vErrors.length = _errs48;
                                                                        }
                                                                        else {
                                                                            vErrors = null;
                                                                        }
                                                                    }
                                                                }
                                                                if (errors === _errs47) {
                                                                    if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                                                                        if (data18.kind !== undefined) {
                                                                            if ("block" !== data18.kind) {
                                                                                const err9 = { instancePath: instancePath + "/blocks/" + i3 + "/kind", schemaPath: "#/$defs/block/anyOf/1/properties/kind/const", keyword: "const", params: { allowedValue: "block" }, message: "must be equal to constant" };
                                                                                if (vErrors === null) {
                                                                                    vErrors = [err9];
                                                                                }
                                                                                else {
                                                                                    vErrors.push(err9);
                                                                                }
                                                                                errors++;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                var _valid1 = _errs47 === errors;
                                                                valid9 = valid9 || _valid1;
                                                                if (_valid1) {
                                                                    if (props0 !== true) {
                                                                        props0 = props0 || {};
                                                                        props0.kind = true;
                                                                    }
                                                                }
                                                                if (!valid9) {
                                                                    const err10 = { instancePath: instancePath + "/blocks/" + i3, schemaPath: "#/$defs/block/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                    if (vErrors === null) {
                                                                        vErrors = [err10];
                                                                    }
                                                                    else {
                                                                        vErrors.push(err10);
                                                                    }
                                                                    errors++;
                                                                    validate20.errors = vErrors;
                                                                    return false;
                                                                }
                                                                else {
                                                                    errors = _errs44;
                                                                    if (vErrors !== null) {
                                                                        if (_errs44) {
                                                                            vErrors.length = _errs44;
                                                                        }
                                                                        else {
                                                                            vErrors = null;
                                                                        }
                                                                    }
                                                                }
                                                                if (errors === _errs42) {
                                                                    if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                                                                        let missing4;
                                                                        if ((((((data18.id === undefined) && (missing4 = "id")) || ((data18.kind === undefined) && (missing4 = "kind"))) || ((data18.parentScopeId === undefined) && (missing4 = "parentScopeId"))) || ((data18.openLineId === undefined) && (missing4 = "openLineId"))) || ((data18.closeLineId === undefined) && (missing4 = "closeLineId"))) {
                                                                            validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3, schemaPath: "#/$defs/block/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                                                            return false;
                                                                        }
                                                                        else {
                                                                            const _errs51 = errors;
                                                                            for (const key2 in data18) {
                                                                                if (!((((((key2 === "id") || (key2 === "kind")) || (key2 === "functionBlock")) || (key2 === "parentScopeId")) || (key2 === "openLineId")) || (key2 === "closeLineId"))) {
                                                                                    validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3, schemaPath: "#/$defs/block/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                                                                    return false;
                                                                                    break;
                                                                                }
                                                                            }
                                                                            if (_errs51 === errors) {
                                                                                if (data18.id !== undefined) {
                                                                                    let data21 = data18.id;
                                                                                    const _errs52 = errors;
                                                                                    if (errors === _errs52) {
                                                                                        if (typeof data21 === "string") {
                                                                                            if (func2(data21) > 200) {
                                                                                                validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/id", schemaPath: "#/$defs/block/properties/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                                                                return false;
                                                                                            }
                                                                                            else {
                                                                                                if (func2(data21) < 1) {
                                                                                                    validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/id", schemaPath: "#/$defs/block/properties/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                                                    return false;
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                        else {
                                                                                            validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/id", schemaPath: "#/$defs/block/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                            return false;
                                                                                        }
                                                                                    }
                                                                                    var valid13 = _errs52 === errors;
                                                                                }
                                                                                else {
                                                                                    var valid13 = true;
                                                                                }
                                                                                if (valid13) {
                                                                                    if (data18.kind !== undefined) {
                                                                                        let data22 = data18.kind;
                                                                                        const _errs54 = errors;
                                                                                        if (!((data22 === "function") || (data22 === "block"))) {
                                                                                            validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/kind", schemaPath: "#/$defs/block/properties/kind/enum", keyword: "enum", params: { allowedValues: schema33.properties.kind.enum }, message: "must be equal to one of the allowed values" }];
                                                                                            return false;
                                                                                        }
                                                                                        var valid13 = _errs54 === errors;
                                                                                    }
                                                                                    else {
                                                                                        var valid13 = true;
                                                                                    }
                                                                                    if (valid13) {
                                                                                        if (data18.functionBlock !== undefined) {
                                                                                            let data23 = data18.functionBlock;
                                                                                            const _errs55 = errors;
                                                                                            if (!(((typeof data23 == "number") && (!(data23 % 1) && !isNaN(data23))) && (isFinite(data23)))) {
                                                                                                validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/functionBlock", schemaPath: "#/$defs/block/properties/functionBlock/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                return false;
                                                                                            }
                                                                                            if (errors === _errs55) {
                                                                                                if ((typeof data23 == "number") && (isFinite(data23))) {
                                                                                                    if (data23 > 9007199254740991 || isNaN(data23)) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/functionBlock", schemaPath: "#/$defs/block/properties/functionBlock/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                    else {
                                                                                                        if (data23 < 1 || isNaN(data23)) {
                                                                                                            validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/functionBlock", schemaPath: "#/$defs/block/properties/functionBlock/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                            return false;
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                            var valid13 = _errs55 === errors;
                                                                                        }
                                                                                        else {
                                                                                            var valid13 = true;
                                                                                        }
                                                                                        if (valid13) {
                                                                                            if (data18.parentScopeId !== undefined) {
                                                                                                let data24 = data18.parentScopeId;
                                                                                                const _errs57 = errors;
                                                                                                const _errs58 = errors;
                                                                                                let valid14 = false;
                                                                                                const _errs59 = errors;
                                                                                                if (errors === _errs59) {
                                                                                                    if (typeof data24 === "string") {
                                                                                                        if (func2(data24) > 200) {
                                                                                                            const err11 = { instancePath: instancePath + "/blocks/" + i3 + "/parentScopeId", schemaPath: "#/$defs/block/properties/parentScopeId/anyOf/0/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
                                                                                                            if (vErrors === null) {
                                                                                                                vErrors = [err11];
                                                                                                            }
                                                                                                            else {
                                                                                                                vErrors.push(err11);
                                                                                                            }
                                                                                                            errors++;
                                                                                                        }
                                                                                                        else {
                                                                                                            if (func2(data24) < 1) {
                                                                                                                const err12 = { instancePath: instancePath + "/blocks/" + i3 + "/parentScopeId", schemaPath: "#/$defs/block/properties/parentScopeId/anyOf/0/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
                                                                                                                if (vErrors === null) {
                                                                                                                    vErrors = [err12];
                                                                                                                }
                                                                                                                else {
                                                                                                                    vErrors.push(err12);
                                                                                                                }
                                                                                                                errors++;
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                    else {
                                                                                                        const err13 = { instancePath: instancePath + "/blocks/" + i3 + "/parentScopeId", schemaPath: "#/$defs/block/properties/parentScopeId/anyOf/0/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                                                                        if (vErrors === null) {
                                                                                                            vErrors = [err13];
                                                                                                        }
                                                                                                        else {
                                                                                                            vErrors.push(err13);
                                                                                                        }
                                                                                                        errors++;
                                                                                                    }
                                                                                                }
                                                                                                var _valid2 = _errs59 === errors;
                                                                                                valid14 = valid14 || _valid2;
                                                                                                const _errs61 = errors;
                                                                                                if (data24 !== null) {
                                                                                                    const err14 = { instancePath: instancePath + "/blocks/" + i3 + "/parentScopeId", schemaPath: "#/$defs/block/properties/parentScopeId/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
                                                                                                    if (vErrors === null) {
                                                                                                        vErrors = [err14];
                                                                                                    }
                                                                                                    else {
                                                                                                        vErrors.push(err14);
                                                                                                    }
                                                                                                    errors++;
                                                                                                }
                                                                                                var _valid2 = _errs61 === errors;
                                                                                                valid14 = valid14 || _valid2;
                                                                                                if (!valid14) {
                                                                                                    const err15 = { instancePath: instancePath + "/blocks/" + i3 + "/parentScopeId", schemaPath: "#/$defs/block/properties/parentScopeId/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
                                                                                                    if (vErrors === null) {
                                                                                                        vErrors = [err15];
                                                                                                    }
                                                                                                    else {
                                                                                                        vErrors.push(err15);
                                                                                                    }
                                                                                                    errors++;
                                                                                                    validate20.errors = vErrors;
                                                                                                    return false;
                                                                                                }
                                                                                                else {
                                                                                                    errors = _errs58;
                                                                                                    if (vErrors !== null) {
                                                                                                        if (_errs58) {
                                                                                                            vErrors.length = _errs58;
                                                                                                        }
                                                                                                        else {
                                                                                                            vErrors = null;
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                                var valid13 = _errs57 === errors;
                                                                                            }
                                                                                            else {
                                                                                                var valid13 = true;
                                                                                            }
                                                                                            if (valid13) {
                                                                                                if (data18.openLineId !== undefined) {
                                                                                                    let data25 = data18.openLineId;
                                                                                                    const _errs63 = errors;
                                                                                                    if (!(((typeof data25 == "number") && (!(data25 % 1) && !isNaN(data25))) && (isFinite(data25)))) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/openLineId", schemaPath: "#/$defs/block/properties/openLineId/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                    if (errors === _errs63) {
                                                                                                        if ((typeof data25 == "number") && (isFinite(data25))) {
                                                                                                            if (data25 > 9007199254740991 || isNaN(data25)) {
                                                                                                                validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/openLineId", schemaPath: "#/$defs/block/properties/openLineId/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                                return false;
                                                                                                            }
                                                                                                            else {
                                                                                                                if (data25 < 1 || isNaN(data25)) {
                                                                                                                    validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/openLineId", schemaPath: "#/$defs/block/properties/openLineId/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                    return false;
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                    var valid13 = _errs63 === errors;
                                                                                                }
                                                                                                else {
                                                                                                    var valid13 = true;
                                                                                                }
                                                                                                if (valid13) {
                                                                                                    if (data18.closeLineId !== undefined) {
                                                                                                        let data26 = data18.closeLineId;
                                                                                                        const _errs65 = errors;
                                                                                                        if (!(((typeof data26 == "number") && (!(data26 % 1) && !isNaN(data26))) && (isFinite(data26)))) {
                                                                                                            validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/closeLineId", schemaPath: "#/$defs/block/properties/closeLineId/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                            return false;
                                                                                                        }
                                                                                                        if (errors === _errs65) {
                                                                                                            if ((typeof data26 == "number") && (isFinite(data26))) {
                                                                                                                if (data26 > 9007199254740991 || isNaN(data26)) {
                                                                                                                    validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/closeLineId", schemaPath: "#/$defs/block/properties/closeLineId/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                                    return false;
                                                                                                                }
                                                                                                                else {
                                                                                                                    if (data26 < 1 || isNaN(data26)) {
                                                                                                                        validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3 + "/closeLineId", schemaPath: "#/$defs/block/properties/closeLineId/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                        return false;
                                                                                                                    }
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                        var valid13 = _errs65 === errors;
                                                                                                    }
                                                                                                    else {
                                                                                                        var valid13 = true;
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                    else {
                                                                        validate20.errors = [{ instancePath: instancePath + "/blocks/" + i3, schemaPath: "#/$defs/block/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                        return false;
                                                                    }
                                                                }
                                                                var valid7 = _errs41 === errors;
                                                                if (!valid7) {
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                    else {
                                                        validate20.errors = [{ instancePath: instancePath + "/blocks", schemaPath: "#/properties/blocks/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                        return false;
                                                    }
                                                }
                                                var valid0 = _errs39 === errors;
                                            }
                                            else {
                                                var valid0 = true;
                                            }
                                            if (valid0) {
                                                if (data.edges !== undefined) {
                                                    let data27 = data.edges;
                                                    const _errs67 = errors;
                                                    if (errors === _errs67) {
                                                        if (Array.isArray(data27)) {
                                                            if (data27.length > 5000) {
                                                                validate20.errors = [{ instancePath: instancePath + "/edges", schemaPath: "#/properties/edges/maxItems", keyword: "maxItems", params: { limit: 5000 }, message: "must NOT have more than 5000 items" }];
                                                                return false;
                                                            }
                                                            else {
                                                                var valid15 = true;
                                                                const len3 = data27.length;
                                                                for (let i4 = 0; i4 < len3; i4++) {
                                                                    let data28 = data27[i4];
                                                                    const _errs69 = errors;
                                                                    const _errs70 = errors;
                                                                    if (errors === _errs70) {
                                                                        if (data28 && typeof data28 == "object" && !Array.isArray(data28)) {
                                                                            let missing5;
                                                                            if (((data28.before === undefined) && (missing5 = "before")) || ((data28.after === undefined) && (missing5 = "after"))) {
                                                                                validate20.errors = [{ instancePath: instancePath + "/edges/" + i4, schemaPath: "#/$defs/edge/required", keyword: "required", params: { missingProperty: missing5 }, message: "must have required property '" + missing5 + "'" }];
                                                                                return false;
                                                                            }
                                                                            else {
                                                                                const _errs72 = errors;
                                                                                for (const key3 in data28) {
                                                                                    if (!((key3 === "before") || (key3 === "after"))) {
                                                                                        validate20.errors = [{ instancePath: instancePath + "/edges/" + i4, schemaPath: "#/$defs/edge/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                                                                        return false;
                                                                                        break;
                                                                                    }
                                                                                }
                                                                                if (_errs72 === errors) {
                                                                                    if (data28.before !== undefined) {
                                                                                        let data29 = data28.before;
                                                                                        const _errs73 = errors;
                                                                                        if (!(((typeof data29 == "number") && (!(data29 % 1) && !isNaN(data29))) && (isFinite(data29)))) {
                                                                                            validate20.errors = [{ instancePath: instancePath + "/edges/" + i4 + "/before", schemaPath: "#/$defs/edge/properties/before/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                            return false;
                                                                                        }
                                                                                        if (errors === _errs73) {
                                                                                            if ((typeof data29 == "number") && (isFinite(data29))) {
                                                                                                if (data29 > 9007199254740991 || isNaN(data29)) {
                                                                                                    validate20.errors = [{ instancePath: instancePath + "/edges/" + i4 + "/before", schemaPath: "#/$defs/edge/properties/before/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                    return false;
                                                                                                }
                                                                                                else {
                                                                                                    if (data29 < 1 || isNaN(data29)) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/edges/" + i4 + "/before", schemaPath: "#/$defs/edge/properties/before/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                        var valid17 = _errs73 === errors;
                                                                                    }
                                                                                    else {
                                                                                        var valid17 = true;
                                                                                    }
                                                                                    if (valid17) {
                                                                                        if (data28.after !== undefined) {
                                                                                            let data30 = data28.after;
                                                                                            const _errs75 = errors;
                                                                                            if (!(((typeof data30 == "number") && (!(data30 % 1) && !isNaN(data30))) && (isFinite(data30)))) {
                                                                                                validate20.errors = [{ instancePath: instancePath + "/edges/" + i4 + "/after", schemaPath: "#/$defs/edge/properties/after/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                return false;
                                                                                            }
                                                                                            if (errors === _errs75) {
                                                                                                if ((typeof data30 == "number") && (isFinite(data30))) {
                                                                                                    if (data30 > 9007199254740991 || isNaN(data30)) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/edges/" + i4 + "/after", schemaPath: "#/$defs/edge/properties/after/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                    else {
                                                                                                        if (data30 < 1 || isNaN(data30)) {
                                                                                                            validate20.errors = [{ instancePath: instancePath + "/edges/" + i4 + "/after", schemaPath: "#/$defs/edge/properties/after/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                            return false;
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                            var valid17 = _errs75 === errors;
                                                                                        }
                                                                                        else {
                                                                                            var valid17 = true;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                        else {
                                                                            validate20.errors = [{ instancePath: instancePath + "/edges/" + i4, schemaPath: "#/$defs/edge/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                            return false;
                                                                        }
                                                                    }
                                                                    var valid15 = _errs69 === errors;
                                                                    if (!valid15) {
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        else {
                                                            validate20.errors = [{ instancePath: instancePath + "/edges", schemaPath: "#/properties/edges/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                            return false;
                                                        }
                                                    }
                                                    var valid0 = _errs67 === errors;
                                                }
                                                else {
                                                    var valid0 = true;
                                                }
                                                if (valid0) {
                                                    if (data.profiles !== undefined) {
                                                        let data31 = data.profiles;
                                                        const _errs77 = errors;
                                                        if (errors === _errs77) {
                                                            if (Array.isArray(data31)) {
                                                                if (data31.length > 32) {
                                                                    validate20.errors = [{ instancePath: instancePath + "/profiles", schemaPath: "#/properties/profiles/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                                                                    return false;
                                                                }
                                                                else {
                                                                    var valid18 = true;
                                                                    const len4 = data31.length;
                                                                    for (let i5 = 0; i5 < len4; i5++) {
                                                                        let data32 = data31[i5];
                                                                        const _errs79 = errors;
                                                                        if (errors === _errs79) {
                                                                            if (data32 && typeof data32 == "object" && !Array.isArray(data32)) {
                                                                                let missing6;
                                                                                if (((data32.id === undefined) && (missing6 = "id")) || ((data32.edges === undefined) && (missing6 = "edges"))) {
                                                                                    validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5, schemaPath: "#/properties/profiles/items/required", keyword: "required", params: { missingProperty: missing6 }, message: "must have required property '" + missing6 + "'" }];
                                                                                    return false;
                                                                                }
                                                                                else {
                                                                                    const _errs81 = errors;
                                                                                    for (const key4 in data32) {
                                                                                        if (!((key4 === "id") || (key4 === "edges"))) {
                                                                                            validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5, schemaPath: "#/properties/profiles/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                                                                            return false;
                                                                                            break;
                                                                                        }
                                                                                    }
                                                                                    if (_errs81 === errors) {
                                                                                        if (data32.id !== undefined) {
                                                                                            let data33 = data32.id;
                                                                                            const _errs82 = errors;
                                                                                            if (errors === _errs82) {
                                                                                                if (typeof data33 === "string") {
                                                                                                    if (func2(data33) > 200) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/id", schemaPath: "#/properties/profiles/items/properties/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                    else {
                                                                                                        if (func2(data33) < 1) {
                                                                                                            validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/id", schemaPath: "#/properties/profiles/items/properties/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                                                            return false;
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                                else {
                                                                                                    validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/id", schemaPath: "#/properties/profiles/items/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                    return false;
                                                                                                }
                                                                                            }
                                                                                            var valid19 = _errs82 === errors;
                                                                                        }
                                                                                        else {
                                                                                            var valid19 = true;
                                                                                        }
                                                                                        if (valid19) {
                                                                                            if (data32.edges !== undefined) {
                                                                                                let data34 = data32.edges;
                                                                                                const _errs84 = errors;
                                                                                                if (errors === _errs84) {
                                                                                                    if (Array.isArray(data34)) {
                                                                                                        if (data34.length > 5000) {
                                                                                                            validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges", schemaPath: "#/properties/profiles/items/properties/edges/maxItems", keyword: "maxItems", params: { limit: 5000 }, message: "must NOT have more than 5000 items" }];
                                                                                                            return false;
                                                                                                        }
                                                                                                        else {
                                                                                                            var valid20 = true;
                                                                                                            const len5 = data34.length;
                                                                                                            for (let i6 = 0; i6 < len5; i6++) {
                                                                                                                let data35 = data34[i6];
                                                                                                                const _errs86 = errors;
                                                                                                                const _errs87 = errors;
                                                                                                                if (errors === _errs87) {
                                                                                                                    if (data35 && typeof data35 == "object" && !Array.isArray(data35)) {
                                                                                                                        let missing7;
                                                                                                                        if (((data35.before === undefined) && (missing7 = "before")) || ((data35.after === undefined) && (missing7 = "after"))) {
                                                                                                                            validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges/" + i6, schemaPath: "#/$defs/edge/required", keyword: "required", params: { missingProperty: missing7 }, message: "must have required property '" + missing7 + "'" }];
                                                                                                                            return false;
                                                                                                                        }
                                                                                                                        else {
                                                                                                                            const _errs89 = errors;
                                                                                                                            for (const key5 in data35) {
                                                                                                                                if (!((key5 === "before") || (key5 === "after"))) {
                                                                                                                                    validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges/" + i6, schemaPath: "#/$defs/edge/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                                                                                                                                    return false;
                                                                                                                                    break;
                                                                                                                                }
                                                                                                                            }
                                                                                                                            if (_errs89 === errors) {
                                                                                                                                if (data35.before !== undefined) {
                                                                                                                                    let data36 = data35.before;
                                                                                                                                    const _errs90 = errors;
                                                                                                                                    if (!(((typeof data36 == "number") && (!(data36 % 1) && !isNaN(data36))) && (isFinite(data36)))) {
                                                                                                                                        validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges/" + i6 + "/before", schemaPath: "#/$defs/edge/properties/before/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                                                        return false;
                                                                                                                                    }
                                                                                                                                    if (errors === _errs90) {
                                                                                                                                        if ((typeof data36 == "number") && (isFinite(data36))) {
                                                                                                                                            if (data36 > 9007199254740991 || isNaN(data36)) {
                                                                                                                                                validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges/" + i6 + "/before", schemaPath: "#/$defs/edge/properties/before/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                                                                return false;
                                                                                                                                            }
                                                                                                                                            else {
                                                                                                                                                if (data36 < 1 || isNaN(data36)) {
                                                                                                                                                    validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges/" + i6 + "/before", schemaPath: "#/$defs/edge/properties/before/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                                                    return false;
                                                                                                                                                }
                                                                                                                                            }
                                                                                                                                        }
                                                                                                                                    }
                                                                                                                                    var valid22 = _errs90 === errors;
                                                                                                                                }
                                                                                                                                else {
                                                                                                                                    var valid22 = true;
                                                                                                                                }
                                                                                                                                if (valid22) {
                                                                                                                                    if (data35.after !== undefined) {
                                                                                                                                        let data37 = data35.after;
                                                                                                                                        const _errs92 = errors;
                                                                                                                                        if (!(((typeof data37 == "number") && (!(data37 % 1) && !isNaN(data37))) && (isFinite(data37)))) {
                                                                                                                                            validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges/" + i6 + "/after", schemaPath: "#/$defs/edge/properties/after/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                                                            return false;
                                                                                                                                        }
                                                                                                                                        if (errors === _errs92) {
                                                                                                                                            if ((typeof data37 == "number") && (isFinite(data37))) {
                                                                                                                                                if (data37 > 9007199254740991 || isNaN(data37)) {
                                                                                                                                                    validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges/" + i6 + "/after", schemaPath: "#/$defs/edge/properties/after/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                                                                                                                                    return false;
                                                                                                                                                }
                                                                                                                                                else {
                                                                                                                                                    if (data37 < 1 || isNaN(data37)) {
                                                                                                                                                        validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges/" + i6 + "/after", schemaPath: "#/$defs/edge/properties/after/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                                                        return false;
                                                                                                                                                    }
                                                                                                                                                }
                                                                                                                                            }
                                                                                                                                        }
                                                                                                                                        var valid22 = _errs92 === errors;
                                                                                                                                    }
                                                                                                                                    else {
                                                                                                                                        var valid22 = true;
                                                                                                                                    }
                                                                                                                                }
                                                                                                                            }
                                                                                                                        }
                                                                                                                    }
                                                                                                                    else {
                                                                                                                        validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges/" + i6, schemaPath: "#/$defs/edge/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                                                        return false;
                                                                                                                    }
                                                                                                                }
                                                                                                                var valid20 = _errs86 === errors;
                                                                                                                if (!valid20) {
                                                                                                                    break;
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                    else {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5 + "/edges", schemaPath: "#/properties/profiles/items/properties/edges/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                }
                                                                                                var valid19 = _errs84 === errors;
                                                                                            }
                                                                                            else {
                                                                                                var valid19 = true;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                            else {
                                                                                validate20.errors = [{ instancePath: instancePath + "/profiles/" + i5, schemaPath: "#/properties/profiles/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                return false;
                                                                            }
                                                                        }
                                                                        var valid18 = _errs79 === errors;
                                                                        if (!valid18) {
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            else {
                                                                validate20.errors = [{ instancePath: instancePath + "/profiles", schemaPath: "#/properties/profiles/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                                return false;
                                                            }
                                                        }
                                                        var valid0 = _errs77 === errors;
                                                    }
                                                    else {
                                                        var valid0 = true;
                                                    }
                                                    if (valid0) {
                                                        if (data.authoring !== undefined) {
                                                            let data38 = data.authoring;
                                                            const _errs94 = errors;
                                                            if (errors === _errs94) {
                                                                if (data38 && typeof data38 == "object" && !Array.isArray(data38)) {
                                                                    const _errs96 = errors;
                                                                    for (const key6 in data38) {
                                                                        if (!(((((((key6 === "strategy") || (key6 === "reason")) || (key6 === "note")) || (key6 === "omittedBlocks")) || (key6 === "semanticEquivalenceProven")) || (key6 === "dependencyHints")) || (key6 === "dependencyPolicy"))) {
                                                                            validate20.errors = [{ instancePath: instancePath + "/authoring", schemaPath: "#/properties/authoring/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key6 }, message: "must NOT have additional properties" }];
                                                                            return false;
                                                                            break;
                                                                        }
                                                                    }
                                                                    if (_errs96 === errors) {
                                                                        if (data38.strategy !== undefined) {
                                                                            let data39 = data38.strategy;
                                                                            const _errs97 = errors;
                                                                            if (errors === _errs97) {
                                                                                if (typeof data39 === "string") {
                                                                                    if (func2(data39) > 100) {
                                                                                        validate20.errors = [{ instancePath: instancePath + "/authoring/strategy", schemaPath: "#/properties/authoring/properties/strategy/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" }];
                                                                                        return false;
                                                                                    }
                                                                                }
                                                                                else {
                                                                                    validate20.errors = [{ instancePath: instancePath + "/authoring/strategy", schemaPath: "#/properties/authoring/properties/strategy/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                    return false;
                                                                                }
                                                                            }
                                                                            var valid23 = _errs97 === errors;
                                                                        }
                                                                        else {
                                                                            var valid23 = true;
                                                                        }
                                                                        if (valid23) {
                                                                            if (data38.reason !== undefined) {
                                                                                let data40 = data38.reason;
                                                                                const _errs99 = errors;
                                                                                if (errors === _errs99) {
                                                                                    if (typeof data40 === "string") {
                                                                                        if (func2(data40) > 500) {
                                                                                            validate20.errors = [{ instancePath: instancePath + "/authoring/reason", schemaPath: "#/properties/authoring/properties/reason/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" }];
                                                                                            return false;
                                                                                        }
                                                                                    }
                                                                                    else {
                                                                                        validate20.errors = [{ instancePath: instancePath + "/authoring/reason", schemaPath: "#/properties/authoring/properties/reason/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                        return false;
                                                                                    }
                                                                                }
                                                                                var valid23 = _errs99 === errors;
                                                                            }
                                                                            else {
                                                                                var valid23 = true;
                                                                            }
                                                                            if (valid23) {
                                                                                if (data38.note !== undefined) {
                                                                                    let data41 = data38.note;
                                                                                    const _errs101 = errors;
                                                                                    if (errors === _errs101) {
                                                                                        if (typeof data41 === "string") {
                                                                                            if (func2(data41) > 1000) {
                                                                                                validate20.errors = [{ instancePath: instancePath + "/authoring/note", schemaPath: "#/properties/authoring/properties/note/maxLength", keyword: "maxLength", params: { limit: 1000 }, message: "must NOT have more than 1000 characters" }];
                                                                                                return false;
                                                                                            }
                                                                                        }
                                                                                        else {
                                                                                            validate20.errors = [{ instancePath: instancePath + "/authoring/note", schemaPath: "#/properties/authoring/properties/note/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                            return false;
                                                                                        }
                                                                                    }
                                                                                    var valid23 = _errs101 === errors;
                                                                                }
                                                                                else {
                                                                                    var valid23 = true;
                                                                                }
                                                                                if (valid23) {
                                                                                    if (data38.omittedBlocks !== undefined) {
                                                                                        let data42 = data38.omittedBlocks;
                                                                                        const _errs103 = errors;
                                                                                        if (!(((typeof data42 == "number") && (!(data42 % 1) && !isNaN(data42))) && (isFinite(data42)))) {
                                                                                            validate20.errors = [{ instancePath: instancePath + "/authoring/omittedBlocks", schemaPath: "#/properties/authoring/properties/omittedBlocks/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                            return false;
                                                                                        }
                                                                                        if (errors === _errs103) {
                                                                                            if ((typeof data42 == "number") && (isFinite(data42))) {
                                                                                                if (data42 > 500 || isNaN(data42)) {
                                                                                                    validate20.errors = [{ instancePath: instancePath + "/authoring/omittedBlocks", schemaPath: "#/properties/authoring/properties/omittedBlocks/maximum", keyword: "maximum", params: { comparison: "<=", limit: 500 }, message: "must be <= 500" }];
                                                                                                    return false;
                                                                                                }
                                                                                                else {
                                                                                                    if (data42 < 0 || isNaN(data42)) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/authoring/omittedBlocks", schemaPath: "#/properties/authoring/properties/omittedBlocks/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                        var valid23 = _errs103 === errors;
                                                                                    }
                                                                                    else {
                                                                                        var valid23 = true;
                                                                                    }
                                                                                    if (valid23) {
                                                                                        if (data38.semanticEquivalenceProven !== undefined) {
                                                                                            const _errs105 = errors;
                                                                                            if (false !== data38.semanticEquivalenceProven) {
                                                                                                validate20.errors = [{ instancePath: instancePath + "/authoring/semanticEquivalenceProven", schemaPath: "#/properties/authoring/properties/semanticEquivalenceProven/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" }];
                                                                                                return false;
                                                                                            }
                                                                                            var valid23 = _errs105 === errors;
                                                                                        }
                                                                                        else {
                                                                                            var valid23 = true;
                                                                                        }
                                                                                        if (valid23) {
                                                                                            if (data38.dependencyHints !== undefined) {
                                                                                                let data44 = data38.dependencyHints;
                                                                                                const _errs106 = errors;
                                                                                                if (errors === _errs106) {
                                                                                                    if (Array.isArray(data44)) {
                                                                                                        if (data44.length > 200) {
                                                                                                            validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints", schemaPath: "#/properties/authoring/properties/dependencyHints/maxItems", keyword: "maxItems", params: { limit: 200 }, message: "must NOT have more than 200 items" }];
                                                                                                            return false;
                                                                                                        }
                                                                                                        else {
                                                                                                            var valid24 = true;
                                                                                                            const len6 = data44.length;
                                                                                                            for (let i7 = 0; i7 < len6; i7++) {
                                                                                                                let data45 = data44[i7];
                                                                                                                const _errs108 = errors;
                                                                                                                if (errors === _errs108) {
                                                                                                                    if (data45 && typeof data45 == "object" && !Array.isArray(data45)) {
                                                                                                                        let missing8;
                                                                                                                        if ((((data45.name === undefined) && (missing8 = "name")) || ((data45.declarationLine === undefined) && (missing8 = "declarationLine"))) || ((data45.usageLine === undefined) && (missing8 = "usageLine"))) {
                                                                                                                            validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7, schemaPath: "#/properties/authoring/properties/dependencyHints/items/required", keyword: "required", params: { missingProperty: missing8 }, message: "must have required property '" + missing8 + "'" }];
                                                                                                                            return false;
                                                                                                                        }
                                                                                                                        else {
                                                                                                                            const _errs110 = errors;
                                                                                                                            for (const key7 in data45) {
                                                                                                                                if (!(((key7 === "name") || (key7 === "declarationLine")) || (key7 === "usageLine"))) {
                                                                                                                                    validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7, schemaPath: "#/properties/authoring/properties/dependencyHints/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key7 }, message: "must NOT have additional properties" }];
                                                                                                                                    return false;
                                                                                                                                    break;
                                                                                                                                }
                                                                                                                            }
                                                                                                                            if (_errs110 === errors) {
                                                                                                                                if (data45.name !== undefined) {
                                                                                                                                    let data46 = data45.name;
                                                                                                                                    const _errs111 = errors;
                                                                                                                                    if (errors === _errs111) {
                                                                                                                                        if (typeof data46 === "string") {
                                                                                                                                            if (func2(data46) > 2048) {
                                                                                                                                                validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7 + "/name", schemaPath: "#/properties/authoring/properties/dependencyHints/items/properties/name/maxLength", keyword: "maxLength", params: { limit: 2048 }, message: "must NOT have more than 2048 characters" }];
                                                                                                                                                return false;
                                                                                                                                            }
                                                                                                                                        }
                                                                                                                                        else {
                                                                                                                                            validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7 + "/name", schemaPath: "#/properties/authoring/properties/dependencyHints/items/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                                                            return false;
                                                                                                                                        }
                                                                                                                                    }
                                                                                                                                    var valid25 = _errs111 === errors;
                                                                                                                                }
                                                                                                                                else {
                                                                                                                                    var valid25 = true;
                                                                                                                                }
                                                                                                                                if (valid25) {
                                                                                                                                    if (data45.declarationLine !== undefined) {
                                                                                                                                        let data47 = data45.declarationLine;
                                                                                                                                        const _errs113 = errors;
                                                                                                                                        if (!(((typeof data47 == "number") && (!(data47 % 1) && !isNaN(data47))) && (isFinite(data47)))) {
                                                                                                                                            validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7 + "/declarationLine", schemaPath: "#/properties/authoring/properties/dependencyHints/items/properties/declarationLine/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                                                            return false;
                                                                                                                                        }
                                                                                                                                        if (errors === _errs113) {
                                                                                                                                            if ((typeof data47 == "number") && (isFinite(data47))) {
                                                                                                                                                if (data47 > 50000 || isNaN(data47)) {
                                                                                                                                                    validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7 + "/declarationLine", schemaPath: "#/properties/authoring/properties/dependencyHints/items/properties/declarationLine/maximum", keyword: "maximum", params: { comparison: "<=", limit: 50000 }, message: "must be <= 50000" }];
                                                                                                                                                    return false;
                                                                                                                                                }
                                                                                                                                                else {
                                                                                                                                                    if (data47 < 1 || isNaN(data47)) {
                                                                                                                                                        validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7 + "/declarationLine", schemaPath: "#/properties/authoring/properties/dependencyHints/items/properties/declarationLine/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                                                        return false;
                                                                                                                                                    }
                                                                                                                                                }
                                                                                                                                            }
                                                                                                                                        }
                                                                                                                                        var valid25 = _errs113 === errors;
                                                                                                                                    }
                                                                                                                                    else {
                                                                                                                                        var valid25 = true;
                                                                                                                                    }
                                                                                                                                    if (valid25) {
                                                                                                                                        if (data45.usageLine !== undefined) {
                                                                                                                                            let data48 = data45.usageLine;
                                                                                                                                            const _errs115 = errors;
                                                                                                                                            if (!(((typeof data48 == "number") && (!(data48 % 1) && !isNaN(data48))) && (isFinite(data48)))) {
                                                                                                                                                validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7 + "/usageLine", schemaPath: "#/properties/authoring/properties/dependencyHints/items/properties/usageLine/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                                                                return false;
                                                                                                                                            }
                                                                                                                                            if (errors === _errs115) {
                                                                                                                                                if ((typeof data48 == "number") && (isFinite(data48))) {
                                                                                                                                                    if (data48 > 50000 || isNaN(data48)) {
                                                                                                                                                        validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7 + "/usageLine", schemaPath: "#/properties/authoring/properties/dependencyHints/items/properties/usageLine/maximum", keyword: "maximum", params: { comparison: "<=", limit: 50000 }, message: "must be <= 50000" }];
                                                                                                                                                        return false;
                                                                                                                                                    }
                                                                                                                                                    else {
                                                                                                                                                        if (data48 < 1 || isNaN(data48)) {
                                                                                                                                                            validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7 + "/usageLine", schemaPath: "#/properties/authoring/properties/dependencyHints/items/properties/usageLine/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                                                            return false;
                                                                                                                                                        }
                                                                                                                                                    }
                                                                                                                                                }
                                                                                                                                            }
                                                                                                                                            var valid25 = _errs115 === errors;
                                                                                                                                        }
                                                                                                                                        else {
                                                                                                                                            var valid25 = true;
                                                                                                                                        }
                                                                                                                                    }
                                                                                                                                }
                                                                                                                            }
                                                                                                                        }
                                                                                                                    }
                                                                                                                    else {
                                                                                                                        validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints/" + i7, schemaPath: "#/properties/authoring/properties/dependencyHints/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                                                        return false;
                                                                                                                    }
                                                                                                                }
                                                                                                                var valid24 = _errs108 === errors;
                                                                                                                if (!valid24) {
                                                                                                                    break;
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                    else {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyHints", schemaPath: "#/properties/authoring/properties/dependencyHints/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                }
                                                                                                var valid23 = _errs106 === errors;
                                                                                            }
                                                                                            else {
                                                                                                var valid23 = true;
                                                                                            }
                                                                                            if (valid23) {
                                                                                                if (data38.dependencyPolicy !== undefined) {
                                                                                                    let data49 = data38.dependencyPolicy;
                                                                                                    const _errs117 = errors;
                                                                                                    if (typeof data49 !== "string") {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyPolicy", schemaPath: "#/properties/authoring/properties/dependencyPolicy/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                    if (!((data49 === "primitive-const-islands-v1") || (data49 === "scoped-primitive-dag-v2"))) {
                                                                                                        validate20.errors = [{ instancePath: instancePath + "/authoring/dependencyPolicy", schemaPath: "#/properties/authoring/properties/dependencyPolicy/enum", keyword: "enum", params: { allowedValues: schema31.properties.authoring.properties.dependencyPolicy.enum }, message: "must be equal to one of the allowed values" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                    var valid23 = _errs117 === errors;
                                                                                                }
                                                                                                else {
                                                                                                    var valid23 = true;
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                else {
                                                                    validate20.errors = [{ instancePath: instancePath + "/authoring", schemaPath: "#/properties/authoring/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                    return false;
                                                                }
                                                            }
                                                            var valid0 = _errs94 === errors;
                                                        }
                                                        else {
                                                            var valid0 = true;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    else {
        validate20.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate20.errors = vErrors; return errors === 0; }
validate20.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
//# sourceMappingURL=schema-check.js.map
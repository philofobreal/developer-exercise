// @ts-nocheck
// Generated from docs/schema.json, language-ir.schema.json and codeline-v3.schema.json by scripts/sync-schema.mjs. Do not edit.
"use strict";
export const validateV2 = validate20;
const schema31 = { "$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "https://philofobreal.github.io/developer-exercise/schema.json", "title": "ngDynamic CodeLine v2 Exercise", "type": "object", "additionalProperties": false, "required": ["schemaVersion", "id", "revision", "language", "title", "description", "lines", "blocks"], "properties": { "schemaVersion": { "const": 2 }, "id": { "type": "string", "minLength": 1, "maxLength": 200 }, "revision": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "language": { "enum": ["javascript", "typescript"] }, "title": { "type": "string", "maxLength": 140 }, "description": { "type": "string", "maxLength": 500 }, "lines": { "type": "array", "minItems": 1, "maxItems": 500, "items": { "$ref": "#/$defs/codeLine" } }, "blocks": { "type": "array", "maxItems": 250, "items": { "$ref": "#/$defs/block" } }, "edges": { "type": "array", "items": { "$ref": "#/$defs/edge" }, "maxItems": 5000 }, "profiles": { "type": "array", "maxItems": 32, "items": { "type": "object", "required": ["id", "edges"], "additionalProperties": false, "properties": { "id": { "type": "string", "minLength": 1, "maxLength": 200 }, "edges": { "type": "array", "items": { "$ref": "#/$defs/edge" }, "maxItems": 5000 } } } }, "authoring": { "type": "object", "additionalProperties": false, "properties": { "strategy": { "type": "string", "maxLength": 100 }, "reason": { "type": "string", "maxLength": 500 }, "note": { "type": "string", "maxLength": 1000 }, "omittedBlocks": { "type": "integer", "minimum": 0, "maximum": 500 }, "semanticEquivalenceProven": { "const": false }, "dependencyHints": { "type": "array", "maxItems": 200, "items": { "type": "object", "additionalProperties": false, "required": ["name", "declarationLine", "usageLine"], "properties": { "name": { "type": "string", "maxLength": 2048 }, "declarationLine": { "type": "integer", "minimum": 1, "maximum": 50000 }, "usageLine": { "type": "integer", "minimum": 1, "maximum": 50000 } } } }, "dependencyPolicy": { "type": "string", "enum": ["primitive-const-islands-v1", "scoped-primitive-dag-v2", "scoped-type-members-v3", "scoped-effect-analysis-v4", "scoped-effect-analysis-v5", "scoped-effect-analysis-v6", "scoped-effect-analysis-v7"] } } } }, "$defs": { "codeLine": { "type": "object", "additionalProperties": false, "required": ["id", "code", "dependencies", "fixed", "functionBlock", "scopeId"], "properties": { "id": { "type": "integer", "minimum": 1, "maximum": 9007199254740991, "description": "Stable identity within this exercise revision; never the current solution position." }, "code": { "type": "string", "maxLength": 2048, "pattern": "^[^\\r\\n\\u2028\\u2029]*$" }, "dependencies": { "type": "array", "uniqueItems": true, "items": { "type": "integer", "minimum": 1 }, "maxItems": 500, "description": "IDs of all required predecessors. Each must occur earlier, at any distance; array order is irrelevant." }, "fixed": { "type": "boolean" }, "functionBlock": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "scopeId": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 200 }, { "type": "null" }] }, "normalization": { "enum": ["indent", "exact"] }, "sourceLine": { "type": "integer", "minimum": 1, "maximum": 50000, "description": "Optional one-based original physical source line; informational, never an identity or ordering constraint." } } }, "block": { "type": "object", "additionalProperties": false, "required": ["id", "kind", "parentScopeId", "openLineId", "closeLineId"], "properties": { "id": { "type": "string", "minLength": 1, "maxLength": 200 }, "kind": { "enum": ["function", "block"] }, "functionBlock": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "parentScopeId": { "anyOf": [{ "type": "string", "minLength": 1, "maxLength": 200 }, { "type": "null" }] }, "openLineId": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "closeLineId": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } }, "anyOf": [{ "properties": { "kind": { "const": "function" }, "functionBlock": {} }, "required": ["functionBlock"] }, { "properties": { "kind": { "const": "block" } }, "not": { "required": ["functionBlock"], "properties": { "functionBlock": {} } } }] }, "edge": { "type": "object", "additionalProperties": false, "required": ["before", "after"], "properties": { "before": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "after": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 } } } } };
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
                                                                                                    if (!(((((((data49 === "primitive-const-islands-v1") || (data49 === "scoped-primitive-dag-v2")) || (data49 === "scoped-type-members-v3")) || (data49 === "scoped-effect-analysis-v4")) || (data49 === "scoped-effect-analysis-v5")) || (data49 === "scoped-effect-analysis-v6")) || (data49 === "scoped-effect-analysis-v7"))) {
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
export const validateIR = validate21;
const schema36 = { "$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "https://philofobreal.github.io/developer-exercise/language-ir-v1.schema.json", "title": "Language IR v1", "type": "object", "additionalProperties": false, "required": ["irVersion", "language", "source", "lines", "units", "containers", "bindingScopes", "boundaries", "edges", "profiles", "indentPolicy", "analysis"], "properties": { "irVersion": { "const": 1 }, "language": { "$ref": "#/$defs/id" }, "source": { "type": "string", "maxLength": 1048576, "not": { "pattern": "[\\r\\u2028\\u2029]" } }, "lines": { "type": "array", "minItems": 1, "maxItems": 500, "items": { "$ref": "#/$defs/line" } }, "units": { "type": "array", "minItems": 1, "maxItems": 500, "items": { "$ref": "#/$defs/unit" } }, "containers": { "type": "array", "maxItems": 250, "items": { "$ref": "#/$defs/container" } }, "bindingScopes": { "type": "array", "maxItems": 500, "items": { "$ref": "#/$defs/container" } }, "boundaries": { "type": "array", "maxItems": 500, "items": { "$ref": "#/$defs/boundary" } }, "edges": { "type": "array", "maxItems": 5000, "items": { "$ref": "#/$defs/edge" } }, "profiles": { "type": "array", "maxItems": 32, "items": { "type": "object", "additionalProperties": false, "required": ["id", "edges"], "properties": { "id": { "$ref": "#/$defs/id" }, "edges": { "type": "array", "maxItems": 5000, "items": { "$ref": "#/$defs/edge" } } } } }, "indentPolicy": { "type": "object", "additionalProperties": false, "required": ["mode", "tabWidth", "display"], "properties": { "mode": { "enum": ["presentation", "semantic"] }, "tabWidth": { "type": "integer", "minimum": 1, "maximum": 16 }, "display": { "enum": ["adapter", "preserve"] } }, "if": { "properties": { "mode": { "const": "semantic" } } }, "then": { "properties": { "display": { "const": "preserve" } } } }, "analysis": { "type": "object", "additionalProperties": false, "required": ["strategy", "sourceOrigin", "semanticEquivalenceProven"], "properties": { "strategy": { "enum": ["legacy-v2-projection", "native"] }, "sourceOrigin": { "enum": ["original", "reconstructed-v2"] }, "semanticEquivalenceProven": { "const": false }, "legacyAuthoring": { "$ref": "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring" } } } }, "$defs": { "id": { "type": "string", "minLength": 1, "maxLength": 200 }, "nullableId": { "anyOf": [{ "$ref": "#/$defs/id" }, { "type": "null" }] }, "position": { "type": "object", "additionalProperties": false, "required": ["offset", "line", "column"], "properties": { "offset": { "type": "integer", "minimum": 0, "maximum": 2100000 }, "line": { "type": "integer", "minimum": 1, "maximum": 1048577 }, "column": { "type": "integer", "minimum": 0, "maximum": 2100000 } } }, "line": { "type": "object", "additionalProperties": false, "required": ["id", "code", "sourceSpan", "normalization"], "properties": { "id": { "$ref": "#/$defs/id" }, "code": { "type": "string", "maxLength": 2048, "not": { "pattern": "[\\r\\n\\u2028\\u2029]" } }, "normalization": { "enum": ["indent", "exact"] }, "sourceSpan": { "type": "object", "additionalProperties": false, "required": ["start", "end"], "properties": { "start": { "$ref": "#/$defs/position" }, "end": { "$ref": "#/$defs/position" } } } } }, "unit": { "type": "object", "additionalProperties": false, "required": ["id", "lineIds", "containerId", "bindingScopeId", "dependencies", "fixed"], "properties": { "id": { "$ref": "#/$defs/id" }, "lineIds": { "type": "array", "minItems": 1, "maxItems": 500, "uniqueItems": true, "items": { "type": "string", "minLength": 1, "maxLength": 200 } }, "containerId": { "$ref": "#/$defs/nullableId" }, "bindingScopeId": { "$ref": "#/$defs/nullableId" }, "dependencies": { "type": "array", "maxItems": 500, "uniqueItems": true, "items": { "type": "string", "minLength": 1, "maxLength": 200 } }, "fixed": { "type": "boolean" } } }, "container": { "type": "object", "additionalProperties": false, "required": ["id", "parentId", "kind"], "properties": { "id": { "$ref": "#/$defs/id" }, "parentId": { "$ref": "#/$defs/nullableId" }, "kind": { "$ref": "#/$defs/id" } } }, "boundary": { "type": "object", "additionalProperties": false, "required": ["containerId", "unitId", "phase", "action", "virtual"], "properties": { "containerId": { "$ref": "#/$defs/id" }, "unitId": { "$ref": "#/$defs/id" }, "phase": { "enum": ["before", "after"] }, "action": { "enum": ["open", "close"] }, "virtual": { "type": "boolean" } } }, "edge": { "type": "object", "additionalProperties": false, "required": ["before", "after"], "properties": { "before": { "$ref": "#/$defs/id" }, "after": { "$ref": "#/$defs/id" } } } } };
const schema37 = { "type": "string", "minLength": 1, "maxLength": 200 };
const schema56 = { "type": "object", "additionalProperties": false, "properties": { "strategy": { "type": "string", "maxLength": 100 }, "reason": { "type": "string", "maxLength": 500 }, "note": { "type": "string", "maxLength": 1000 }, "omittedBlocks": { "type": "integer", "minimum": 0, "maximum": 500 }, "semanticEquivalenceProven": { "const": false }, "dependencyHints": { "type": "array", "maxItems": 200, "items": { "type": "object", "additionalProperties": false, "required": ["name", "declarationLine", "usageLine"], "properties": { "name": { "type": "string", "maxLength": 2048 }, "declarationLine": { "type": "integer", "minimum": 1, "maximum": 50000 }, "usageLine": { "type": "integer", "minimum": 1, "maximum": 50000 } } } }, "dependencyPolicy": { "type": "string", "enum": ["primitive-const-islands-v1", "scoped-primitive-dag-v2", "scoped-type-members-v3", "scoped-effect-analysis-v4", "scoped-effect-analysis-v5", "scoped-effect-analysis-v6", "scoped-effect-analysis-v7"] } } };
const pattern5 = new RegExp("[\\r\\u2028\\u2029]", "u");
const schema38 = { "type": "object", "additionalProperties": false, "required": ["id", "code", "sourceSpan", "normalization"], "properties": { "id": { "$ref": "#/$defs/id" }, "code": { "type": "string", "maxLength": 2048, "not": { "pattern": "[\\r\\n\\u2028\\u2029]" } }, "normalization": { "enum": ["indent", "exact"] }, "sourceSpan": { "type": "object", "additionalProperties": false, "required": ["start", "end"], "properties": { "start": { "$ref": "#/$defs/position" }, "end": { "$ref": "#/$defs/position" } } } } };
const schema40 = { "type": "object", "additionalProperties": false, "required": ["offset", "line", "column"], "properties": { "offset": { "type": "integer", "minimum": 0, "maximum": 2100000 }, "line": { "type": "integer", "minimum": 1, "maximum": 1048577 }, "column": { "type": "integer", "minimum": 0, "maximum": 2100000 } } };
const pattern6 = new RegExp("[\\r\\n\\u2028\\u2029]", "u");
function validate22(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) { let vErrors = null; let errors = 0; const evaluated0 = validate22.evaluated; if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
} if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if (((((data.id === undefined) && (missing0 = "id")) || ((data.code === undefined) && (missing0 = "code"))) || ((data.sourceSpan === undefined) && (missing0 = "sourceSpan"))) || ((data.normalization === undefined) && (missing0 = "normalization"))) {
            validate22.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!((((key0 === "id") || (key0 === "code")) || (key0 === "normalization")) || (key0 === "sourceSpan"))) {
                    validate22.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.id !== undefined) {
                    let data0 = data.id;
                    const _errs2 = errors;
                    const _errs3 = errors;
                    if (errors === _errs3) {
                        if (typeof data0 === "string") {
                            if (func2(data0) > 200) {
                                validate22.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                return false;
                            }
                            else {
                                if (func2(data0) < 1) {
                                    validate22.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                }
                            }
                        }
                        else {
                            validate22.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                        }
                    }
                    var valid0 = _errs2 === errors;
                }
                else {
                    var valid0 = true;
                }
                if (valid0) {
                    if (data.code !== undefined) {
                        let data1 = data.code;
                        const _errs5 = errors;
                        const _errs7 = errors;
                        const _errs8 = errors;
                        if (typeof data1 === "string") {
                            if (!pattern6.test(data1)) {
                                const err0 = {};
                                if (vErrors === null) {
                                    vErrors = [err0];
                                }
                                else {
                                    vErrors.push(err0);
                                }
                                errors++;
                            }
                        }
                        var valid2 = _errs8 === errors;
                        if (valid2) {
                            validate22.errors = [{ instancePath: instancePath + "/code", schemaPath: "#/properties/code/not", keyword: "not", params: {}, message: "must NOT be valid" }];
                            return false;
                        }
                        else {
                            errors = _errs7;
                            if (vErrors !== null) {
                                if (_errs7) {
                                    vErrors.length = _errs7;
                                }
                                else {
                                    vErrors = null;
                                }
                            }
                        }
                        if (errors === _errs5) {
                            if (typeof data1 === "string") {
                                if (func2(data1) > 2048) {
                                    validate22.errors = [{ instancePath: instancePath + "/code", schemaPath: "#/properties/code/maxLength", keyword: "maxLength", params: { limit: 2048 }, message: "must NOT have more than 2048 characters" }];
                                    return false;
                                }
                            }
                            else {
                                validate22.errors = [{ instancePath: instancePath + "/code", schemaPath: "#/properties/code/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                            }
                        }
                        var valid0 = _errs5 === errors;
                    }
                    else {
                        var valid0 = true;
                    }
                    if (valid0) {
                        if (data.normalization !== undefined) {
                            let data2 = data.normalization;
                            const _errs9 = errors;
                            if (!((data2 === "indent") || (data2 === "exact"))) {
                                validate22.errors = [{ instancePath: instancePath + "/normalization", schemaPath: "#/properties/normalization/enum", keyword: "enum", params: { allowedValues: schema38.properties.normalization.enum }, message: "must be equal to one of the allowed values" }];
                                return false;
                            }
                            var valid0 = _errs9 === errors;
                        }
                        else {
                            var valid0 = true;
                        }
                        if (valid0) {
                            if (data.sourceSpan !== undefined) {
                                let data3 = data.sourceSpan;
                                const _errs10 = errors;
                                if (errors === _errs10) {
                                    if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
                                        let missing1;
                                        if (((data3.start === undefined) && (missing1 = "start")) || ((data3.end === undefined) && (missing1 = "end"))) {
                                            validate22.errors = [{ instancePath: instancePath + "/sourceSpan", schemaPath: "#/properties/sourceSpan/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                            return false;
                                        }
                                        else {
                                            const _errs12 = errors;
                                            for (const key1 in data3) {
                                                if (!((key1 === "start") || (key1 === "end"))) {
                                                    validate22.errors = [{ instancePath: instancePath + "/sourceSpan", schemaPath: "#/properties/sourceSpan/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                                    return false;
                                                    break;
                                                }
                                            }
                                            if (_errs12 === errors) {
                                                if (data3.start !== undefined) {
                                                    let data4 = data3.start;
                                                    const _errs13 = errors;
                                                    const _errs14 = errors;
                                                    if (errors === _errs14) {
                                                        if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
                                                            let missing2;
                                                            if ((((data4.offset === undefined) && (missing2 = "offset")) || ((data4.line === undefined) && (missing2 = "line"))) || ((data4.column === undefined) && (missing2 = "column"))) {
                                                                validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start", schemaPath: "#/$defs/position/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                                                return false;
                                                            }
                                                            else {
                                                                const _errs16 = errors;
                                                                for (const key2 in data4) {
                                                                    if (!(((key2 === "offset") || (key2 === "line")) || (key2 === "column"))) {
                                                                        validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start", schemaPath: "#/$defs/position/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                                                        return false;
                                                                        break;
                                                                    }
                                                                }
                                                                if (_errs16 === errors) {
                                                                    if (data4.offset !== undefined) {
                                                                        let data5 = data4.offset;
                                                                        const _errs17 = errors;
                                                                        if (!(((typeof data5 == "number") && (!(data5 % 1) && !isNaN(data5))) && (isFinite(data5)))) {
                                                                            validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start/offset", schemaPath: "#/$defs/position/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                            return false;
                                                                        }
                                                                        if (errors === _errs17) {
                                                                            if ((typeof data5 == "number") && (isFinite(data5))) {
                                                                                if (data5 > 2100000 || isNaN(data5)) {
                                                                                    validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start/offset", schemaPath: "#/$defs/position/properties/offset/maximum", keyword: "maximum", params: { comparison: "<=", limit: 2100000 }, message: "must be <= 2100000" }];
                                                                                    return false;
                                                                                }
                                                                                else {
                                                                                    if (data5 < 0 || isNaN(data5)) {
                                                                                        validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start/offset", schemaPath: "#/$defs/position/properties/offset/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                        return false;
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                        var valid5 = _errs17 === errors;
                                                                    }
                                                                    else {
                                                                        var valid5 = true;
                                                                    }
                                                                    if (valid5) {
                                                                        if (data4.line !== undefined) {
                                                                            let data6 = data4.line;
                                                                            const _errs19 = errors;
                                                                            if (!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))) {
                                                                                validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start/line", schemaPath: "#/$defs/position/properties/line/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                return false;
                                                                            }
                                                                            if (errors === _errs19) {
                                                                                if ((typeof data6 == "number") && (isFinite(data6))) {
                                                                                    if (data6 > 1048577 || isNaN(data6)) {
                                                                                        validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start/line", schemaPath: "#/$defs/position/properties/line/maximum", keyword: "maximum", params: { comparison: "<=", limit: 1048577 }, message: "must be <= 1048577" }];
                                                                                        return false;
                                                                                    }
                                                                                    else {
                                                                                        if (data6 < 1 || isNaN(data6)) {
                                                                                            validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start/line", schemaPath: "#/$defs/position/properties/line/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                            return false;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                            var valid5 = _errs19 === errors;
                                                                        }
                                                                        else {
                                                                            var valid5 = true;
                                                                        }
                                                                        if (valid5) {
                                                                            if (data4.column !== undefined) {
                                                                                let data7 = data4.column;
                                                                                const _errs21 = errors;
                                                                                if (!(((typeof data7 == "number") && (!(data7 % 1) && !isNaN(data7))) && (isFinite(data7)))) {
                                                                                    validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start/column", schemaPath: "#/$defs/position/properties/column/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                    return false;
                                                                                }
                                                                                if (errors === _errs21) {
                                                                                    if ((typeof data7 == "number") && (isFinite(data7))) {
                                                                                        if (data7 > 2100000 || isNaN(data7)) {
                                                                                            validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start/column", schemaPath: "#/$defs/position/properties/column/maximum", keyword: "maximum", params: { comparison: "<=", limit: 2100000 }, message: "must be <= 2100000" }];
                                                                                            return false;
                                                                                        }
                                                                                        else {
                                                                                            if (data7 < 0 || isNaN(data7)) {
                                                                                                validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start/column", schemaPath: "#/$defs/position/properties/column/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                return false;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                                var valid5 = _errs21 === errors;
                                                                            }
                                                                            else {
                                                                                var valid5 = true;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        else {
                                                            validate22.errors = [{ instancePath: instancePath + "/sourceSpan/start", schemaPath: "#/$defs/position/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                            return false;
                                                        }
                                                    }
                                                    var valid3 = _errs13 === errors;
                                                }
                                                else {
                                                    var valid3 = true;
                                                }
                                                if (valid3) {
                                                    if (data3.end !== undefined) {
                                                        let data8 = data3.end;
                                                        const _errs23 = errors;
                                                        const _errs24 = errors;
                                                        if (errors === _errs24) {
                                                            if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
                                                                let missing3;
                                                                if ((((data8.offset === undefined) && (missing3 = "offset")) || ((data8.line === undefined) && (missing3 = "line"))) || ((data8.column === undefined) && (missing3 = "column"))) {
                                                                    validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end", schemaPath: "#/$defs/position/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                                                    return false;
                                                                }
                                                                else {
                                                                    const _errs26 = errors;
                                                                    for (const key3 in data8) {
                                                                        if (!(((key3 === "offset") || (key3 === "line")) || (key3 === "column"))) {
                                                                            validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end", schemaPath: "#/$defs/position/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                                                            return false;
                                                                            break;
                                                                        }
                                                                    }
                                                                    if (_errs26 === errors) {
                                                                        if (data8.offset !== undefined) {
                                                                            let data9 = data8.offset;
                                                                            const _errs27 = errors;
                                                                            if (!(((typeof data9 == "number") && (!(data9 % 1) && !isNaN(data9))) && (isFinite(data9)))) {
                                                                                validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end/offset", schemaPath: "#/$defs/position/properties/offset/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                return false;
                                                                            }
                                                                            if (errors === _errs27) {
                                                                                if ((typeof data9 == "number") && (isFinite(data9))) {
                                                                                    if (data9 > 2100000 || isNaN(data9)) {
                                                                                        validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end/offset", schemaPath: "#/$defs/position/properties/offset/maximum", keyword: "maximum", params: { comparison: "<=", limit: 2100000 }, message: "must be <= 2100000" }];
                                                                                        return false;
                                                                                    }
                                                                                    else {
                                                                                        if (data9 < 0 || isNaN(data9)) {
                                                                                            validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end/offset", schemaPath: "#/$defs/position/properties/offset/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                            return false;
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                            var valid7 = _errs27 === errors;
                                                                        }
                                                                        else {
                                                                            var valid7 = true;
                                                                        }
                                                                        if (valid7) {
                                                                            if (data8.line !== undefined) {
                                                                                let data10 = data8.line;
                                                                                const _errs29 = errors;
                                                                                if (!(((typeof data10 == "number") && (!(data10 % 1) && !isNaN(data10))) && (isFinite(data10)))) {
                                                                                    validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end/line", schemaPath: "#/$defs/position/properties/line/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                    return false;
                                                                                }
                                                                                if (errors === _errs29) {
                                                                                    if ((typeof data10 == "number") && (isFinite(data10))) {
                                                                                        if (data10 > 1048577 || isNaN(data10)) {
                                                                                            validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end/line", schemaPath: "#/$defs/position/properties/line/maximum", keyword: "maximum", params: { comparison: "<=", limit: 1048577 }, message: "must be <= 1048577" }];
                                                                                            return false;
                                                                                        }
                                                                                        else {
                                                                                            if (data10 < 1 || isNaN(data10)) {
                                                                                                validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end/line", schemaPath: "#/$defs/position/properties/line/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                return false;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                                var valid7 = _errs29 === errors;
                                                                            }
                                                                            else {
                                                                                var valid7 = true;
                                                                            }
                                                                            if (valid7) {
                                                                                if (data8.column !== undefined) {
                                                                                    let data11 = data8.column;
                                                                                    const _errs31 = errors;
                                                                                    if (!(((typeof data11 == "number") && (!(data11 % 1) && !isNaN(data11))) && (isFinite(data11)))) {
                                                                                        validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end/column", schemaPath: "#/$defs/position/properties/column/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                        return false;
                                                                                    }
                                                                                    if (errors === _errs31) {
                                                                                        if ((typeof data11 == "number") && (isFinite(data11))) {
                                                                                            if (data11 > 2100000 || isNaN(data11)) {
                                                                                                validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end/column", schemaPath: "#/$defs/position/properties/column/maximum", keyword: "maximum", params: { comparison: "<=", limit: 2100000 }, message: "must be <= 2100000" }];
                                                                                                return false;
                                                                                            }
                                                                                            else {
                                                                                                if (data11 < 0 || isNaN(data11)) {
                                                                                                    validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end/column", schemaPath: "#/$defs/position/properties/column/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                    return false;
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    var valid7 = _errs31 === errors;
                                                                                }
                                                                                else {
                                                                                    var valid7 = true;
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            else {
                                                                validate22.errors = [{ instancePath: instancePath + "/sourceSpan/end", schemaPath: "#/$defs/position/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                return false;
                                                            }
                                                        }
                                                        var valid3 = _errs23 === errors;
                                                    }
                                                    else {
                                                        var valid3 = true;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    else {
                                        validate22.errors = [{ instancePath: instancePath + "/sourceSpan", schemaPath: "#/properties/sourceSpan/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                        return false;
                                    }
                                }
                                var valid0 = _errs10 === errors;
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
    else {
        validate22.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate22.errors = vErrors; return errors === 0; }
validate22.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
const schema42 = { "type": "object", "additionalProperties": false, "required": ["id", "lineIds", "containerId", "bindingScopeId", "dependencies", "fixed"], "properties": { "id": { "$ref": "#/$defs/id" }, "lineIds": { "type": "array", "minItems": 1, "maxItems": 500, "uniqueItems": true, "items": { "type": "string", "minLength": 1, "maxLength": 200 } }, "containerId": { "$ref": "#/$defs/nullableId" }, "bindingScopeId": { "$ref": "#/$defs/nullableId" }, "dependencies": { "type": "array", "maxItems": 500, "uniqueItems": true, "items": { "type": "string", "minLength": 1, "maxLength": 200 } }, "fixed": { "type": "boolean" } } };
const schema44 = { "anyOf": [{ "$ref": "#/$defs/id" }, { "type": "null" }] };
function validate25(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) { let vErrors = null; let errors = 0; const evaluated0 = validate25.evaluated; if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
} if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
} const _errs0 = errors; let valid0 = false; const _errs1 = errors; const _errs2 = errors; if (errors === _errs2) {
    if (typeof data === "string") {
        if (func2(data) > 200) {
            const err0 = { instancePath, schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
            if (vErrors === null) {
                vErrors = [err0];
            }
            else {
                vErrors.push(err0);
            }
            errors++;
        }
        else {
            if (func2(data) < 1) {
                const err1 = { instancePath, schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
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
        const err2 = { instancePath, schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
            vErrors = [err2];
        }
        else {
            vErrors.push(err2);
        }
        errors++;
    }
} var _valid0 = _errs1 === errors; valid0 = valid0 || _valid0; const _errs4 = errors; if (data !== null) {
    const err3 = { instancePath, schemaPath: "#/anyOf/1/type", keyword: "type", params: { type: "null" }, message: "must be null" };
    if (vErrors === null) {
        vErrors = [err3];
    }
    else {
        vErrors.push(err3);
    }
    errors++;
} var _valid0 = _errs4 === errors; valid0 = valid0 || _valid0; if (!valid0) {
    const err4 = { instancePath, schemaPath: "#/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
    if (vErrors === null) {
        vErrors = [err4];
    }
    else {
        vErrors.push(err4);
    }
    errors++;
    validate25.errors = vErrors;
    return false;
}
else {
    errors = _errs0;
    if (vErrors !== null) {
        if (_errs0) {
            vErrors.length = _errs0;
        }
        else {
            vErrors = null;
        }
    }
} validate25.errors = vErrors; return errors === 0; }
validate25.evaluated = { "dynamicProps": false, "dynamicItems": false };
function validate24(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) { let vErrors = null; let errors = 0; const evaluated0 = validate24.evaluated; if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
} if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if (((((((data.id === undefined) && (missing0 = "id")) || ((data.lineIds === undefined) && (missing0 = "lineIds"))) || ((data.containerId === undefined) && (missing0 = "containerId"))) || ((data.bindingScopeId === undefined) && (missing0 = "bindingScopeId"))) || ((data.dependencies === undefined) && (missing0 = "dependencies"))) || ((data.fixed === undefined) && (missing0 = "fixed"))) {
            validate24.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!((((((key0 === "id") || (key0 === "lineIds")) || (key0 === "containerId")) || (key0 === "bindingScopeId")) || (key0 === "dependencies")) || (key0 === "fixed"))) {
                    validate24.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.id !== undefined) {
                    let data0 = data.id;
                    const _errs2 = errors;
                    const _errs3 = errors;
                    if (errors === _errs3) {
                        if (typeof data0 === "string") {
                            if (func2(data0) > 200) {
                                validate24.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                return false;
                            }
                            else {
                                if (func2(data0) < 1) {
                                    validate24.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                }
                            }
                        }
                        else {
                            validate24.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                        }
                    }
                    var valid0 = _errs2 === errors;
                }
                else {
                    var valid0 = true;
                }
                if (valid0) {
                    if (data.lineIds !== undefined) {
                        let data1 = data.lineIds;
                        const _errs5 = errors;
                        if (errors === _errs5) {
                            if (Array.isArray(data1)) {
                                if (data1.length > 500) {
                                    validate24.errors = [{ instancePath: instancePath + "/lineIds", schemaPath: "#/properties/lineIds/maxItems", keyword: "maxItems", params: { limit: 500 }, message: "must NOT have more than 500 items" }];
                                    return false;
                                }
                                else {
                                    if (data1.length < 1) {
                                        validate24.errors = [{ instancePath: instancePath + "/lineIds", schemaPath: "#/properties/lineIds/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                        return false;
                                    }
                                    else {
                                        var valid2 = true;
                                        const len0 = data1.length;
                                        for (let i0 = 0; i0 < len0; i0++) {
                                            let data2 = data1[i0];
                                            const _errs7 = errors;
                                            if (errors === _errs7) {
                                                if (typeof data2 === "string") {
                                                    if (func2(data2) > 200) {
                                                        validate24.errors = [{ instancePath: instancePath + "/lineIds/" + i0, schemaPath: "#/properties/lineIds/items/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                        return false;
                                                    }
                                                    else {
                                                        if (func2(data2) < 1) {
                                                            validate24.errors = [{ instancePath: instancePath + "/lineIds/" + i0, schemaPath: "#/properties/lineIds/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                            return false;
                                                        }
                                                    }
                                                }
                                                else {
                                                    validate24.errors = [{ instancePath: instancePath + "/lineIds/" + i0, schemaPath: "#/properties/lineIds/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                    return false;
                                                }
                                            }
                                            var valid2 = _errs7 === errors;
                                            if (!valid2) {
                                                break;
                                            }
                                        }
                                        if (valid2) {
                                            let i1 = data1.length;
                                            let j0;
                                            if (i1 > 1) {
                                                const indices0 = {};
                                                for (; i1--;) {
                                                    let item0 = data1[i1];
                                                    if (typeof item0 !== "string") {
                                                        continue;
                                                    }
                                                    if (typeof indices0[item0] == "number") {
                                                        j0 = indices0[item0];
                                                        validate24.errors = [{ instancePath: instancePath + "/lineIds", schemaPath: "#/properties/lineIds/uniqueItems", keyword: "uniqueItems", params: { i: i1, j: j0 }, message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)" }];
                                                        return false;
                                                        break;
                                                    }
                                                    indices0[item0] = i1;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else {
                                validate24.errors = [{ instancePath: instancePath + "/lineIds", schemaPath: "#/properties/lineIds/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                return false;
                            }
                        }
                        var valid0 = _errs5 === errors;
                    }
                    else {
                        var valid0 = true;
                    }
                    if (valid0) {
                        if (data.containerId !== undefined) {
                            const _errs9 = errors;
                            if (!(validate25(data.containerId, { instancePath: instancePath + "/containerId", parentData: data, parentDataProperty: "containerId", rootData, dynamicAnchors }))) {
                                vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
                                errors = vErrors.length;
                            }
                            var valid0 = _errs9 === errors;
                        }
                        else {
                            var valid0 = true;
                        }
                        if (valid0) {
                            if (data.bindingScopeId !== undefined) {
                                const _errs10 = errors;
                                if (!(validate25(data.bindingScopeId, { instancePath: instancePath + "/bindingScopeId", parentData: data, parentDataProperty: "bindingScopeId", rootData, dynamicAnchors }))) {
                                    vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
                                    errors = vErrors.length;
                                }
                                var valid0 = _errs10 === errors;
                            }
                            else {
                                var valid0 = true;
                            }
                            if (valid0) {
                                if (data.dependencies !== undefined) {
                                    let data5 = data.dependencies;
                                    const _errs11 = errors;
                                    if (errors === _errs11) {
                                        if (Array.isArray(data5)) {
                                            if (data5.length > 500) {
                                                validate24.errors = [{ instancePath: instancePath + "/dependencies", schemaPath: "#/properties/dependencies/maxItems", keyword: "maxItems", params: { limit: 500 }, message: "must NOT have more than 500 items" }];
                                                return false;
                                            }
                                            else {
                                                var valid4 = true;
                                                const len1 = data5.length;
                                                for (let i2 = 0; i2 < len1; i2++) {
                                                    let data6 = data5[i2];
                                                    const _errs13 = errors;
                                                    if (errors === _errs13) {
                                                        if (typeof data6 === "string") {
                                                            if (func2(data6) > 200) {
                                                                validate24.errors = [{ instancePath: instancePath + "/dependencies/" + i2, schemaPath: "#/properties/dependencies/items/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                                return false;
                                                            }
                                                            else {
                                                                if (func2(data6) < 1) {
                                                                    validate24.errors = [{ instancePath: instancePath + "/dependencies/" + i2, schemaPath: "#/properties/dependencies/items/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                    return false;
                                                                }
                                                            }
                                                        }
                                                        else {
                                                            validate24.errors = [{ instancePath: instancePath + "/dependencies/" + i2, schemaPath: "#/properties/dependencies/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                            return false;
                                                        }
                                                    }
                                                    var valid4 = _errs13 === errors;
                                                    if (!valid4) {
                                                        break;
                                                    }
                                                }
                                                if (valid4) {
                                                    let i3 = data5.length;
                                                    let j1;
                                                    if (i3 > 1) {
                                                        const indices1 = {};
                                                        for (; i3--;) {
                                                            let item1 = data5[i3];
                                                            if (typeof item1 !== "string") {
                                                                continue;
                                                            }
                                                            if (typeof indices1[item1] == "number") {
                                                                j1 = indices1[item1];
                                                                validate24.errors = [{ instancePath: instancePath + "/dependencies", schemaPath: "#/properties/dependencies/uniqueItems", keyword: "uniqueItems", params: { i: i3, j: j1 }, message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)" }];
                                                                return false;
                                                                break;
                                                            }
                                                            indices1[item1] = i3;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        else {
                                            validate24.errors = [{ instancePath: instancePath + "/dependencies", schemaPath: "#/properties/dependencies/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                            return false;
                                        }
                                    }
                                    var valid0 = _errs11 === errors;
                                }
                                else {
                                    var valid0 = true;
                                }
                                if (valid0) {
                                    if (data.fixed !== undefined) {
                                        const _errs15 = errors;
                                        if (typeof data.fixed !== "boolean") {
                                            validate24.errors = [{ instancePath: instancePath + "/fixed", schemaPath: "#/properties/fixed/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                            return false;
                                        }
                                        var valid0 = _errs15 === errors;
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
    else {
        validate24.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate24.errors = vErrors; return errors === 0; }
validate24.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
const schema46 = { "type": "object", "additionalProperties": false, "required": ["id", "parentId", "kind"], "properties": { "id": { "$ref": "#/$defs/id" }, "parentId": { "$ref": "#/$defs/nullableId" }, "kind": { "$ref": "#/$defs/id" } } };
function validate29(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) { let vErrors = null; let errors = 0; const evaluated0 = validate29.evaluated; if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
} if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if ((((data.id === undefined) && (missing0 = "id")) || ((data.parentId === undefined) && (missing0 = "parentId"))) || ((data.kind === undefined) && (missing0 = "kind"))) {
            validate29.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!(((key0 === "id") || (key0 === "parentId")) || (key0 === "kind"))) {
                    validate29.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.id !== undefined) {
                    let data0 = data.id;
                    const _errs2 = errors;
                    const _errs3 = errors;
                    if (errors === _errs3) {
                        if (typeof data0 === "string") {
                            if (func2(data0) > 200) {
                                validate29.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                return false;
                            }
                            else {
                                if (func2(data0) < 1) {
                                    validate29.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                }
                            }
                        }
                        else {
                            validate29.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                        }
                    }
                    var valid0 = _errs2 === errors;
                }
                else {
                    var valid0 = true;
                }
                if (valid0) {
                    if (data.parentId !== undefined) {
                        const _errs5 = errors;
                        if (!(validate25(data.parentId, { instancePath: instancePath + "/parentId", parentData: data, parentDataProperty: "parentId", rootData, dynamicAnchors }))) {
                            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
                            errors = vErrors.length;
                        }
                        var valid0 = _errs5 === errors;
                    }
                    else {
                        var valid0 = true;
                    }
                    if (valid0) {
                        if (data.kind !== undefined) {
                            let data2 = data.kind;
                            const _errs6 = errors;
                            const _errs7 = errors;
                            if (errors === _errs7) {
                                if (typeof data2 === "string") {
                                    if (func2(data2) > 200) {
                                        validate29.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                        return false;
                                    }
                                    else {
                                        if (func2(data2) < 1) {
                                            validate29.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                            return false;
                                        }
                                    }
                                }
                                else {
                                    validate29.errors = [{ instancePath: instancePath + "/kind", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                }
                            }
                            var valid0 = _errs6 === errors;
                        }
                        else {
                            var valid0 = true;
                        }
                    }
                }
            }
        }
    }
    else {
        validate29.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate29.errors = vErrors; return errors === 0; }
validate29.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
const schema49 = { "type": "object", "additionalProperties": false, "required": ["containerId", "unitId", "phase", "action", "virtual"], "properties": { "containerId": { "$ref": "#/$defs/id" }, "unitId": { "$ref": "#/$defs/id" }, "phase": { "enum": ["before", "after"] }, "action": { "enum": ["open", "close"] }, "virtual": { "type": "boolean" } } };
function validate33(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) { let vErrors = null; let errors = 0; const evaluated0 = validate33.evaluated; if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
} if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if ((((((data.containerId === undefined) && (missing0 = "containerId")) || ((data.unitId === undefined) && (missing0 = "unitId"))) || ((data.phase === undefined) && (missing0 = "phase"))) || ((data.action === undefined) && (missing0 = "action"))) || ((data.virtual === undefined) && (missing0 = "virtual"))) {
            validate33.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!(((((key0 === "containerId") || (key0 === "unitId")) || (key0 === "phase")) || (key0 === "action")) || (key0 === "virtual"))) {
                    validate33.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.containerId !== undefined) {
                    let data0 = data.containerId;
                    const _errs2 = errors;
                    const _errs3 = errors;
                    if (errors === _errs3) {
                        if (typeof data0 === "string") {
                            if (func2(data0) > 200) {
                                validate33.errors = [{ instancePath: instancePath + "/containerId", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                return false;
                            }
                            else {
                                if (func2(data0) < 1) {
                                    validate33.errors = [{ instancePath: instancePath + "/containerId", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                }
                            }
                        }
                        else {
                            validate33.errors = [{ instancePath: instancePath + "/containerId", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                        }
                    }
                    var valid0 = _errs2 === errors;
                }
                else {
                    var valid0 = true;
                }
                if (valid0) {
                    if (data.unitId !== undefined) {
                        let data1 = data.unitId;
                        const _errs5 = errors;
                        const _errs6 = errors;
                        if (errors === _errs6) {
                            if (typeof data1 === "string") {
                                if (func2(data1) > 200) {
                                    validate33.errors = [{ instancePath: instancePath + "/unitId", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                    return false;
                                }
                                else {
                                    if (func2(data1) < 1) {
                                        validate33.errors = [{ instancePath: instancePath + "/unitId", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                    }
                                }
                            }
                            else {
                                validate33.errors = [{ instancePath: instancePath + "/unitId", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                            }
                        }
                        var valid0 = _errs5 === errors;
                    }
                    else {
                        var valid0 = true;
                    }
                    if (valid0) {
                        if (data.phase !== undefined) {
                            let data2 = data.phase;
                            const _errs8 = errors;
                            if (!((data2 === "before") || (data2 === "after"))) {
                                validate33.errors = [{ instancePath: instancePath + "/phase", schemaPath: "#/properties/phase/enum", keyword: "enum", params: { allowedValues: schema49.properties.phase.enum }, message: "must be equal to one of the allowed values" }];
                                return false;
                            }
                            var valid0 = _errs8 === errors;
                        }
                        else {
                            var valid0 = true;
                        }
                        if (valid0) {
                            if (data.action !== undefined) {
                                let data3 = data.action;
                                const _errs9 = errors;
                                if (!((data3 === "open") || (data3 === "close"))) {
                                    validate33.errors = [{ instancePath: instancePath + "/action", schemaPath: "#/properties/action/enum", keyword: "enum", params: { allowedValues: schema49.properties.action.enum }, message: "must be equal to one of the allowed values" }];
                                    return false;
                                }
                                var valid0 = _errs9 === errors;
                            }
                            else {
                                var valid0 = true;
                            }
                            if (valid0) {
                                if (data.virtual !== undefined) {
                                    const _errs10 = errors;
                                    if (typeof data.virtual !== "boolean") {
                                        validate33.errors = [{ instancePath: instancePath + "/virtual", schemaPath: "#/properties/virtual/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" }];
                                        return false;
                                    }
                                    var valid0 = _errs10 === errors;
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
    else {
        validate33.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate33.errors = vErrors; return errors === 0; }
validate33.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
const schema52 = { "type": "object", "additionalProperties": false, "required": ["before", "after"], "properties": { "before": { "$ref": "#/$defs/id" }, "after": { "$ref": "#/$defs/id" } } };
function validate35(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) { let vErrors = null; let errors = 0; const evaluated0 = validate35.evaluated; if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
} if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if (((data.before === undefined) && (missing0 = "before")) || ((data.after === undefined) && (missing0 = "after"))) {
            validate35.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!((key0 === "before") || (key0 === "after"))) {
                    validate35.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.before !== undefined) {
                    let data0 = data.before;
                    const _errs2 = errors;
                    const _errs3 = errors;
                    if (errors === _errs3) {
                        if (typeof data0 === "string") {
                            if (func2(data0) > 200) {
                                validate35.errors = [{ instancePath: instancePath + "/before", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                return false;
                            }
                            else {
                                if (func2(data0) < 1) {
                                    validate35.errors = [{ instancePath: instancePath + "/before", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                    return false;
                                }
                            }
                        }
                        else {
                            validate35.errors = [{ instancePath: instancePath + "/before", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                            return false;
                        }
                    }
                    var valid0 = _errs2 === errors;
                }
                else {
                    var valid0 = true;
                }
                if (valid0) {
                    if (data.after !== undefined) {
                        let data1 = data.after;
                        const _errs5 = errors;
                        const _errs6 = errors;
                        if (errors === _errs6) {
                            if (typeof data1 === "string") {
                                if (func2(data1) > 200) {
                                    validate35.errors = [{ instancePath: instancePath + "/after", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                    return false;
                                }
                                else {
                                    if (func2(data1) < 1) {
                                        validate35.errors = [{ instancePath: instancePath + "/after", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                    }
                                }
                            }
                            else {
                                validate35.errors = [{ instancePath: instancePath + "/after", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                            }
                        }
                        var valid0 = _errs5 === errors;
                    }
                    else {
                        var valid0 = true;
                    }
                }
            }
        }
    }
    else {
        validate35.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate35.errors = vErrors; return errors === 0; }
validate35.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate21(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) { /*# sourceURL="https://philofobreal.github.io/developer-exercise/language-ir-v1.schema.json" */ ; let vErrors = null; let errors = 0; const evaluated0 = validate21.evaluated; if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
} if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if (((((((((((((data.irVersion === undefined) && (missing0 = "irVersion")) || ((data.language === undefined) && (missing0 = "language"))) || ((data.source === undefined) && (missing0 = "source"))) || ((data.lines === undefined) && (missing0 = "lines"))) || ((data.units === undefined) && (missing0 = "units"))) || ((data.containers === undefined) && (missing0 = "containers"))) || ((data.bindingScopes === undefined) && (missing0 = "bindingScopes"))) || ((data.boundaries === undefined) && (missing0 = "boundaries"))) || ((data.edges === undefined) && (missing0 = "edges"))) || ((data.profiles === undefined) && (missing0 = "profiles"))) || ((data.indentPolicy === undefined) && (missing0 = "indentPolicy"))) || ((data.analysis === undefined) && (missing0 = "analysis"))) {
            validate21.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!(func1.call(schema36.properties, key0))) {
                    validate21.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.irVersion !== undefined) {
                    const _errs2 = errors;
                    if (1 !== data.irVersion) {
                        validate21.errors = [{ instancePath: instancePath + "/irVersion", schemaPath: "#/properties/irVersion/const", keyword: "const", params: { allowedValue: 1 }, message: "must be equal to constant" }];
                        return false;
                    }
                    var valid0 = _errs2 === errors;
                }
                else {
                    var valid0 = true;
                }
                if (valid0) {
                    if (data.language !== undefined) {
                        let data1 = data.language;
                        const _errs3 = errors;
                        const _errs4 = errors;
                        if (errors === _errs4) {
                            if (typeof data1 === "string") {
                                if (func2(data1) > 200) {
                                    validate21.errors = [{ instancePath: instancePath + "/language", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                    return false;
                                }
                                else {
                                    if (func2(data1) < 1) {
                                        validate21.errors = [{ instancePath: instancePath + "/language", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                    }
                                }
                            }
                            else {
                                validate21.errors = [{ instancePath: instancePath + "/language", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                return false;
                            }
                        }
                        var valid0 = _errs3 === errors;
                    }
                    else {
                        var valid0 = true;
                    }
                    if (valid0) {
                        if (data.source !== undefined) {
                            let data2 = data.source;
                            const _errs6 = errors;
                            const _errs8 = errors;
                            const _errs9 = errors;
                            if (typeof data2 === "string") {
                                if (!pattern5.test(data2)) {
                                    const err0 = {};
                                    if (vErrors === null) {
                                        vErrors = [err0];
                                    }
                                    else {
                                        vErrors.push(err0);
                                    }
                                    errors++;
                                }
                            }
                            var valid2 = _errs9 === errors;
                            if (valid2) {
                                validate21.errors = [{ instancePath: instancePath + "/source", schemaPath: "#/properties/source/not", keyword: "not", params: {}, message: "must NOT be valid" }];
                                return false;
                            }
                            else {
                                errors = _errs8;
                                if (vErrors !== null) {
                                    if (_errs8) {
                                        vErrors.length = _errs8;
                                    }
                                    else {
                                        vErrors = null;
                                    }
                                }
                            }
                            if (errors === _errs6) {
                                if (typeof data2 === "string") {
                                    if (func2(data2) > 1048576) {
                                        validate21.errors = [{ instancePath: instancePath + "/source", schemaPath: "#/properties/source/maxLength", keyword: "maxLength", params: { limit: 1048576 }, message: "must NOT have more than 1048576 characters" }];
                                        return false;
                                    }
                                }
                                else {
                                    validate21.errors = [{ instancePath: instancePath + "/source", schemaPath: "#/properties/source/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                }
                            }
                            var valid0 = _errs6 === errors;
                        }
                        else {
                            var valid0 = true;
                        }
                        if (valid0) {
                            if (data.lines !== undefined) {
                                let data3 = data.lines;
                                const _errs10 = errors;
                                if (errors === _errs10) {
                                    if (Array.isArray(data3)) {
                                        if (data3.length > 500) {
                                            validate21.errors = [{ instancePath: instancePath + "/lines", schemaPath: "#/properties/lines/maxItems", keyword: "maxItems", params: { limit: 500 }, message: "must NOT have more than 500 items" }];
                                            return false;
                                        }
                                        else {
                                            if (data3.length < 1) {
                                                validate21.errors = [{ instancePath: instancePath + "/lines", schemaPath: "#/properties/lines/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                return false;
                                            }
                                            else {
                                                var valid3 = true;
                                                const len0 = data3.length;
                                                for (let i0 = 0; i0 < len0; i0++) {
                                                    const _errs12 = errors;
                                                    if (!(validate22(data3[i0], { instancePath: instancePath + "/lines/" + i0, parentData: data3, parentDataProperty: i0, rootData, dynamicAnchors }))) {
                                                        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
                                                        errors = vErrors.length;
                                                    }
                                                    var valid3 = _errs12 === errors;
                                                    if (!valid3) {
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    else {
                                        validate21.errors = [{ instancePath: instancePath + "/lines", schemaPath: "#/properties/lines/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                        return false;
                                    }
                                }
                                var valid0 = _errs10 === errors;
                            }
                            else {
                                var valid0 = true;
                            }
                            if (valid0) {
                                if (data.units !== undefined) {
                                    let data5 = data.units;
                                    const _errs13 = errors;
                                    if (errors === _errs13) {
                                        if (Array.isArray(data5)) {
                                            if (data5.length > 500) {
                                                validate21.errors = [{ instancePath: instancePath + "/units", schemaPath: "#/properties/units/maxItems", keyword: "maxItems", params: { limit: 500 }, message: "must NOT have more than 500 items" }];
                                                return false;
                                            }
                                            else {
                                                if (data5.length < 1) {
                                                    validate21.errors = [{ instancePath: instancePath + "/units", schemaPath: "#/properties/units/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" }];
                                                    return false;
                                                }
                                                else {
                                                    var valid4 = true;
                                                    const len1 = data5.length;
                                                    for (let i1 = 0; i1 < len1; i1++) {
                                                        const _errs15 = errors;
                                                        if (!(validate24(data5[i1], { instancePath: instancePath + "/units/" + i1, parentData: data5, parentDataProperty: i1, rootData, dynamicAnchors }))) {
                                                            vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
                                                            errors = vErrors.length;
                                                        }
                                                        var valid4 = _errs15 === errors;
                                                        if (!valid4) {
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        else {
                                            validate21.errors = [{ instancePath: instancePath + "/units", schemaPath: "#/properties/units/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                            return false;
                                        }
                                    }
                                    var valid0 = _errs13 === errors;
                                }
                                else {
                                    var valid0 = true;
                                }
                                if (valid0) {
                                    if (data.containers !== undefined) {
                                        let data7 = data.containers;
                                        const _errs16 = errors;
                                        if (errors === _errs16) {
                                            if (Array.isArray(data7)) {
                                                if (data7.length > 250) {
                                                    validate21.errors = [{ instancePath: instancePath + "/containers", schemaPath: "#/properties/containers/maxItems", keyword: "maxItems", params: { limit: 250 }, message: "must NOT have more than 250 items" }];
                                                    return false;
                                                }
                                                else {
                                                    var valid5 = true;
                                                    const len2 = data7.length;
                                                    for (let i2 = 0; i2 < len2; i2++) {
                                                        const _errs18 = errors;
                                                        if (!(validate29(data7[i2], { instancePath: instancePath + "/containers/" + i2, parentData: data7, parentDataProperty: i2, rootData, dynamicAnchors }))) {
                                                            vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
                                                            errors = vErrors.length;
                                                        }
                                                        var valid5 = _errs18 === errors;
                                                        if (!valid5) {
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                            else {
                                                validate21.errors = [{ instancePath: instancePath + "/containers", schemaPath: "#/properties/containers/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                return false;
                                            }
                                        }
                                        var valid0 = _errs16 === errors;
                                    }
                                    else {
                                        var valid0 = true;
                                    }
                                    if (valid0) {
                                        if (data.bindingScopes !== undefined) {
                                            let data9 = data.bindingScopes;
                                            const _errs19 = errors;
                                            if (errors === _errs19) {
                                                if (Array.isArray(data9)) {
                                                    if (data9.length > 500) {
                                                        validate21.errors = [{ instancePath: instancePath + "/bindingScopes", schemaPath: "#/properties/bindingScopes/maxItems", keyword: "maxItems", params: { limit: 500 }, message: "must NOT have more than 500 items" }];
                                                        return false;
                                                    }
                                                    else {
                                                        var valid6 = true;
                                                        const len3 = data9.length;
                                                        for (let i3 = 0; i3 < len3; i3++) {
                                                            const _errs21 = errors;
                                                            if (!(validate29(data9[i3], { instancePath: instancePath + "/bindingScopes/" + i3, parentData: data9, parentDataProperty: i3, rootData, dynamicAnchors }))) {
                                                                vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
                                                                errors = vErrors.length;
                                                            }
                                                            var valid6 = _errs21 === errors;
                                                            if (!valid6) {
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                else {
                                                    validate21.errors = [{ instancePath: instancePath + "/bindingScopes", schemaPath: "#/properties/bindingScopes/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                    return false;
                                                }
                                            }
                                            var valid0 = _errs19 === errors;
                                        }
                                        else {
                                            var valid0 = true;
                                        }
                                        if (valid0) {
                                            if (data.boundaries !== undefined) {
                                                let data11 = data.boundaries;
                                                const _errs22 = errors;
                                                if (errors === _errs22) {
                                                    if (Array.isArray(data11)) {
                                                        if (data11.length > 500) {
                                                            validate21.errors = [{ instancePath: instancePath + "/boundaries", schemaPath: "#/properties/boundaries/maxItems", keyword: "maxItems", params: { limit: 500 }, message: "must NOT have more than 500 items" }];
                                                            return false;
                                                        }
                                                        else {
                                                            var valid7 = true;
                                                            const len4 = data11.length;
                                                            for (let i4 = 0; i4 < len4; i4++) {
                                                                const _errs24 = errors;
                                                                if (!(validate33(data11[i4], { instancePath: instancePath + "/boundaries/" + i4, parentData: data11, parentDataProperty: i4, rootData, dynamicAnchors }))) {
                                                                    vErrors = vErrors === null ? validate33.errors : vErrors.concat(validate33.errors);
                                                                    errors = vErrors.length;
                                                                }
                                                                var valid7 = _errs24 === errors;
                                                                if (!valid7) {
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                    else {
                                                        validate21.errors = [{ instancePath: instancePath + "/boundaries", schemaPath: "#/properties/boundaries/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                        return false;
                                                    }
                                                }
                                                var valid0 = _errs22 === errors;
                                            }
                                            else {
                                                var valid0 = true;
                                            }
                                            if (valid0) {
                                                if (data.edges !== undefined) {
                                                    let data13 = data.edges;
                                                    const _errs25 = errors;
                                                    if (errors === _errs25) {
                                                        if (Array.isArray(data13)) {
                                                            if (data13.length > 5000) {
                                                                validate21.errors = [{ instancePath: instancePath + "/edges", schemaPath: "#/properties/edges/maxItems", keyword: "maxItems", params: { limit: 5000 }, message: "must NOT have more than 5000 items" }];
                                                                return false;
                                                            }
                                                            else {
                                                                var valid8 = true;
                                                                const len5 = data13.length;
                                                                for (let i5 = 0; i5 < len5; i5++) {
                                                                    const _errs27 = errors;
                                                                    if (!(validate35(data13[i5], { instancePath: instancePath + "/edges/" + i5, parentData: data13, parentDataProperty: i5, rootData, dynamicAnchors }))) {
                                                                        vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
                                                                        errors = vErrors.length;
                                                                    }
                                                                    var valid8 = _errs27 === errors;
                                                                    if (!valid8) {
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        else {
                                                            validate21.errors = [{ instancePath: instancePath + "/edges", schemaPath: "#/properties/edges/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                            return false;
                                                        }
                                                    }
                                                    var valid0 = _errs25 === errors;
                                                }
                                                else {
                                                    var valid0 = true;
                                                }
                                                if (valid0) {
                                                    if (data.profiles !== undefined) {
                                                        let data15 = data.profiles;
                                                        const _errs28 = errors;
                                                        if (errors === _errs28) {
                                                            if (Array.isArray(data15)) {
                                                                if (data15.length > 32) {
                                                                    validate21.errors = [{ instancePath: instancePath + "/profiles", schemaPath: "#/properties/profiles/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" }];
                                                                    return false;
                                                                }
                                                                else {
                                                                    var valid9 = true;
                                                                    const len6 = data15.length;
                                                                    for (let i6 = 0; i6 < len6; i6++) {
                                                                        let data16 = data15[i6];
                                                                        const _errs30 = errors;
                                                                        if (errors === _errs30) {
                                                                            if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
                                                                                let missing1;
                                                                                if (((data16.id === undefined) && (missing1 = "id")) || ((data16.edges === undefined) && (missing1 = "edges"))) {
                                                                                    validate21.errors = [{ instancePath: instancePath + "/profiles/" + i6, schemaPath: "#/properties/profiles/items/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" }];
                                                                                    return false;
                                                                                }
                                                                                else {
                                                                                    const _errs32 = errors;
                                                                                    for (const key1 in data16) {
                                                                                        if (!((key1 === "id") || (key1 === "edges"))) {
                                                                                            validate21.errors = [{ instancePath: instancePath + "/profiles/" + i6, schemaPath: "#/properties/profiles/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                                                                            return false;
                                                                                            break;
                                                                                        }
                                                                                    }
                                                                                    if (_errs32 === errors) {
                                                                                        if (data16.id !== undefined) {
                                                                                            let data17 = data16.id;
                                                                                            const _errs33 = errors;
                                                                                            const _errs34 = errors;
                                                                                            if (errors === _errs34) {
                                                                                                if (typeof data17 === "string") {
                                                                                                    if (func2(data17) > 200) {
                                                                                                        validate21.errors = [{ instancePath: instancePath + "/profiles/" + i6 + "/id", schemaPath: "#/$defs/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                    else {
                                                                                                        if (func2(data17) < 1) {
                                                                                                            validate21.errors = [{ instancePath: instancePath + "/profiles/" + i6 + "/id", schemaPath: "#/$defs/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                                                                                            return false;
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                                else {
                                                                                                    validate21.errors = [{ instancePath: instancePath + "/profiles/" + i6 + "/id", schemaPath: "#/$defs/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                    return false;
                                                                                                }
                                                                                            }
                                                                                            var valid10 = _errs33 === errors;
                                                                                        }
                                                                                        else {
                                                                                            var valid10 = true;
                                                                                        }
                                                                                        if (valid10) {
                                                                                            if (data16.edges !== undefined) {
                                                                                                let data18 = data16.edges;
                                                                                                const _errs36 = errors;
                                                                                                if (errors === _errs36) {
                                                                                                    if (Array.isArray(data18)) {
                                                                                                        if (data18.length > 5000) {
                                                                                                            validate21.errors = [{ instancePath: instancePath + "/profiles/" + i6 + "/edges", schemaPath: "#/properties/profiles/items/properties/edges/maxItems", keyword: "maxItems", params: { limit: 5000 }, message: "must NOT have more than 5000 items" }];
                                                                                                            return false;
                                                                                                        }
                                                                                                        else {
                                                                                                            var valid12 = true;
                                                                                                            const len7 = data18.length;
                                                                                                            for (let i7 = 0; i7 < len7; i7++) {
                                                                                                                const _errs38 = errors;
                                                                                                                if (!(validate35(data18[i7], { instancePath: instancePath + "/profiles/" + i6 + "/edges/" + i7, parentData: data18, parentDataProperty: i7, rootData, dynamicAnchors }))) {
                                                                                                                    vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
                                                                                                                    errors = vErrors.length;
                                                                                                                }
                                                                                                                var valid12 = _errs38 === errors;
                                                                                                                if (!valid12) {
                                                                                                                    break;
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                    else {
                                                                                                        validate21.errors = [{ instancePath: instancePath + "/profiles/" + i6 + "/edges", schemaPath: "#/properties/profiles/items/properties/edges/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                }
                                                                                                var valid10 = _errs36 === errors;
                                                                                            }
                                                                                            else {
                                                                                                var valid10 = true;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                            else {
                                                                                validate21.errors = [{ instancePath: instancePath + "/profiles/" + i6, schemaPath: "#/properties/profiles/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                return false;
                                                                            }
                                                                        }
                                                                        var valid9 = _errs30 === errors;
                                                                        if (!valid9) {
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            else {
                                                                validate21.errors = [{ instancePath: instancePath + "/profiles", schemaPath: "#/properties/profiles/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                                return false;
                                                            }
                                                        }
                                                        var valid0 = _errs28 === errors;
                                                    }
                                                    else {
                                                        var valid0 = true;
                                                    }
                                                    if (valid0) {
                                                        if (data.indentPolicy !== undefined) {
                                                            let data20 = data.indentPolicy;
                                                            const _errs39 = errors;
                                                            const _errs41 = errors;
                                                            let valid13 = true;
                                                            const _errs42 = errors;
                                                            if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
                                                                if (data20.mode !== undefined) {
                                                                    if ("semantic" !== data20.mode) {
                                                                        const err1 = {};
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
                                                            var _valid0 = _errs42 === errors;
                                                            errors = _errs41;
                                                            if (vErrors !== null) {
                                                                if (_errs41) {
                                                                    vErrors.length = _errs41;
                                                                }
                                                                else {
                                                                    vErrors = null;
                                                                }
                                                            }
                                                            if (_valid0) {
                                                                const _errs44 = errors;
                                                                if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
                                                                    if (data20.display !== undefined) {
                                                                        if ("preserve" !== data20.display) {
                                                                            validate21.errors = [{ instancePath: instancePath + "/indentPolicy/display", schemaPath: "#/properties/indentPolicy/then/properties/display/const", keyword: "const", params: { allowedValue: "preserve" }, message: "must be equal to constant" }];
                                                                            return false;
                                                                        }
                                                                    }
                                                                }
                                                                var _valid0 = _errs44 === errors;
                                                                valid13 = _valid0;
                                                                if (valid13) {
                                                                    var props0 = {};
                                                                    props0.display = true;
                                                                    props0.mode = true;
                                                                }
                                                            }
                                                            if (!valid13) {
                                                                const err2 = { instancePath: instancePath + "/indentPolicy", schemaPath: "#/properties/indentPolicy/if", keyword: "if", params: { failingKeyword: "then" }, message: "must match \"then\" schema" };
                                                                if (vErrors === null) {
                                                                    vErrors = [err2];
                                                                }
                                                                else {
                                                                    vErrors.push(err2);
                                                                }
                                                                errors++;
                                                                validate21.errors = vErrors;
                                                                return false;
                                                            }
                                                            if (errors === _errs39) {
                                                                if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
                                                                    let missing2;
                                                                    if ((((data20.mode === undefined) && (missing2 = "mode")) || ((data20.tabWidth === undefined) && (missing2 = "tabWidth"))) || ((data20.display === undefined) && (missing2 = "display"))) {
                                                                        validate21.errors = [{ instancePath: instancePath + "/indentPolicy", schemaPath: "#/properties/indentPolicy/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" }];
                                                                        return false;
                                                                    }
                                                                    else {
                                                                        const _errs46 = errors;
                                                                        for (const key2 in data20) {
                                                                            if (!(((key2 === "mode") || (key2 === "tabWidth")) || (key2 === "display"))) {
                                                                                validate21.errors = [{ instancePath: instancePath + "/indentPolicy", schemaPath: "#/properties/indentPolicy/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                                                                return false;
                                                                                break;
                                                                            }
                                                                        }
                                                                        if (_errs46 === errors) {
                                                                            if (data20.mode !== undefined) {
                                                                                let data23 = data20.mode;
                                                                                const _errs47 = errors;
                                                                                if (!((data23 === "presentation") || (data23 === "semantic"))) {
                                                                                    validate21.errors = [{ instancePath: instancePath + "/indentPolicy/mode", schemaPath: "#/properties/indentPolicy/properties/mode/enum", keyword: "enum", params: { allowedValues: schema36.properties.indentPolicy.properties.mode.enum }, message: "must be equal to one of the allowed values" }];
                                                                                    return false;
                                                                                }
                                                                                var valid16 = _errs47 === errors;
                                                                            }
                                                                            else {
                                                                                var valid16 = true;
                                                                            }
                                                                            if (valid16) {
                                                                                if (data20.tabWidth !== undefined) {
                                                                                    let data24 = data20.tabWidth;
                                                                                    const _errs48 = errors;
                                                                                    if (!(((typeof data24 == "number") && (!(data24 % 1) && !isNaN(data24))) && (isFinite(data24)))) {
                                                                                        validate21.errors = [{ instancePath: instancePath + "/indentPolicy/tabWidth", schemaPath: "#/properties/indentPolicy/properties/tabWidth/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                        return false;
                                                                                    }
                                                                                    if (errors === _errs48) {
                                                                                        if ((typeof data24 == "number") && (isFinite(data24))) {
                                                                                            if (data24 > 16 || isNaN(data24)) {
                                                                                                validate21.errors = [{ instancePath: instancePath + "/indentPolicy/tabWidth", schemaPath: "#/properties/indentPolicy/properties/tabWidth/maximum", keyword: "maximum", params: { comparison: "<=", limit: 16 }, message: "must be <= 16" }];
                                                                                                return false;
                                                                                            }
                                                                                            else {
                                                                                                if (data24 < 1 || isNaN(data24)) {
                                                                                                    validate21.errors = [{ instancePath: instancePath + "/indentPolicy/tabWidth", schemaPath: "#/properties/indentPolicy/properties/tabWidth/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                    return false;
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    var valid16 = _errs48 === errors;
                                                                                }
                                                                                else {
                                                                                    var valid16 = true;
                                                                                }
                                                                                if (valid16) {
                                                                                    if (data20.display !== undefined) {
                                                                                        let data25 = data20.display;
                                                                                        const _errs50 = errors;
                                                                                        if (!((data25 === "adapter") || (data25 === "preserve"))) {
                                                                                            validate21.errors = [{ instancePath: instancePath + "/indentPolicy/display", schemaPath: "#/properties/indentPolicy/properties/display/enum", keyword: "enum", params: { allowedValues: schema36.properties.indentPolicy.properties.display.enum }, message: "must be equal to one of the allowed values" }];
                                                                                            return false;
                                                                                        }
                                                                                        var valid16 = _errs50 === errors;
                                                                                    }
                                                                                    else {
                                                                                        var valid16 = true;
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                else {
                                                                    validate21.errors = [{ instancePath: instancePath + "/indentPolicy", schemaPath: "#/properties/indentPolicy/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                    return false;
                                                                }
                                                            }
                                                            var valid0 = _errs39 === errors;
                                                        }
                                                        else {
                                                            var valid0 = true;
                                                        }
                                                        if (valid0) {
                                                            if (data.analysis !== undefined) {
                                                                let data26 = data.analysis;
                                                                const _errs51 = errors;
                                                                if (errors === _errs51) {
                                                                    if (data26 && typeof data26 == "object" && !Array.isArray(data26)) {
                                                                        let missing3;
                                                                        if ((((data26.strategy === undefined) && (missing3 = "strategy")) || ((data26.sourceOrigin === undefined) && (missing3 = "sourceOrigin"))) || ((data26.semanticEquivalenceProven === undefined) && (missing3 = "semanticEquivalenceProven"))) {
                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis", schemaPath: "#/properties/analysis/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" }];
                                                                            return false;
                                                                        }
                                                                        else {
                                                                            const _errs53 = errors;
                                                                            for (const key3 in data26) {
                                                                                if (!((((key3 === "strategy") || (key3 === "sourceOrigin")) || (key3 === "semanticEquivalenceProven")) || (key3 === "legacyAuthoring"))) {
                                                                                    validate21.errors = [{ instancePath: instancePath + "/analysis", schemaPath: "#/properties/analysis/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                                                                    return false;
                                                                                    break;
                                                                                }
                                                                            }
                                                                            if (_errs53 === errors) {
                                                                                if (data26.strategy !== undefined) {
                                                                                    let data27 = data26.strategy;
                                                                                    const _errs54 = errors;
                                                                                    if (!((data27 === "legacy-v2-projection") || (data27 === "native"))) {
                                                                                        validate21.errors = [{ instancePath: instancePath + "/analysis/strategy", schemaPath: "#/properties/analysis/properties/strategy/enum", keyword: "enum", params: { allowedValues: schema36.properties.analysis.properties.strategy.enum }, message: "must be equal to one of the allowed values" }];
                                                                                        return false;
                                                                                    }
                                                                                    var valid17 = _errs54 === errors;
                                                                                }
                                                                                else {
                                                                                    var valid17 = true;
                                                                                }
                                                                                if (valid17) {
                                                                                    if (data26.sourceOrigin !== undefined) {
                                                                                        let data28 = data26.sourceOrigin;
                                                                                        const _errs55 = errors;
                                                                                        if (!((data28 === "original") || (data28 === "reconstructed-v2"))) {
                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/sourceOrigin", schemaPath: "#/properties/analysis/properties/sourceOrigin/enum", keyword: "enum", params: { allowedValues: schema36.properties.analysis.properties.sourceOrigin.enum }, message: "must be equal to one of the allowed values" }];
                                                                                            return false;
                                                                                        }
                                                                                        var valid17 = _errs55 === errors;
                                                                                    }
                                                                                    else {
                                                                                        var valid17 = true;
                                                                                    }
                                                                                    if (valid17) {
                                                                                        if (data26.semanticEquivalenceProven !== undefined) {
                                                                                            const _errs56 = errors;
                                                                                            if (false !== data26.semanticEquivalenceProven) {
                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/semanticEquivalenceProven", schemaPath: "#/properties/analysis/properties/semanticEquivalenceProven/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" }];
                                                                                                return false;
                                                                                            }
                                                                                            var valid17 = _errs56 === errors;
                                                                                        }
                                                                                        else {
                                                                                            var valid17 = true;
                                                                                        }
                                                                                        if (valid17) {
                                                                                            if (data26.legacyAuthoring !== undefined) {
                                                                                                let data30 = data26.legacyAuthoring;
                                                                                                const _errs57 = errors;
                                                                                                const _errs58 = errors;
                                                                                                if (errors === _errs58) {
                                                                                                    if (data30 && typeof data30 == "object" && !Array.isArray(data30)) {
                                                                                                        const _errs60 = errors;
                                                                                                        for (const key4 in data30) {
                                                                                                            if (!(((((((key4 === "strategy") || (key4 === "reason")) || (key4 === "note")) || (key4 === "omittedBlocks")) || (key4 === "semanticEquivalenceProven")) || (key4 === "dependencyHints")) || (key4 === "dependencyPolicy"))) {
                                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" }];
                                                                                                                return false;
                                                                                                                break;
                                                                                                            }
                                                                                                        }
                                                                                                        if (_errs60 === errors) {
                                                                                                            if (data30.strategy !== undefined) {
                                                                                                                let data31 = data30.strategy;
                                                                                                                const _errs61 = errors;
                                                                                                                if (errors === _errs61) {
                                                                                                                    if (typeof data31 === "string") {
                                                                                                                        if (func2(data31) > 100) {
                                                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/strategy", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/strategy/maxLength", keyword: "maxLength", params: { limit: 100 }, message: "must NOT have more than 100 characters" }];
                                                                                                                            return false;
                                                                                                                        }
                                                                                                                    }
                                                                                                                    else {
                                                                                                                        validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/strategy", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/strategy/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                                        return false;
                                                                                                                    }
                                                                                                                }
                                                                                                                var valid19 = _errs61 === errors;
                                                                                                            }
                                                                                                            else {
                                                                                                                var valid19 = true;
                                                                                                            }
                                                                                                            if (valid19) {
                                                                                                                if (data30.reason !== undefined) {
                                                                                                                    let data32 = data30.reason;
                                                                                                                    const _errs63 = errors;
                                                                                                                    if (errors === _errs63) {
                                                                                                                        if (typeof data32 === "string") {
                                                                                                                            if (func2(data32) > 500) {
                                                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/reason", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/reason/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" }];
                                                                                                                                return false;
                                                                                                                            }
                                                                                                                        }
                                                                                                                        else {
                                                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/reason", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/reason/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                                            return false;
                                                                                                                        }
                                                                                                                    }
                                                                                                                    var valid19 = _errs63 === errors;
                                                                                                                }
                                                                                                                else {
                                                                                                                    var valid19 = true;
                                                                                                                }
                                                                                                                if (valid19) {
                                                                                                                    if (data30.note !== undefined) {
                                                                                                                        let data33 = data30.note;
                                                                                                                        const _errs65 = errors;
                                                                                                                        if (errors === _errs65) {
                                                                                                                            if (typeof data33 === "string") {
                                                                                                                                if (func2(data33) > 1000) {
                                                                                                                                    validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/note", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/note/maxLength", keyword: "maxLength", params: { limit: 1000 }, message: "must NOT have more than 1000 characters" }];
                                                                                                                                    return false;
                                                                                                                                }
                                                                                                                            }
                                                                                                                            else {
                                                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/note", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/note/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                                                return false;
                                                                                                                            }
                                                                                                                        }
                                                                                                                        var valid19 = _errs65 === errors;
                                                                                                                    }
                                                                                                                    else {
                                                                                                                        var valid19 = true;
                                                                                                                    }
                                                                                                                    if (valid19) {
                                                                                                                        if (data30.omittedBlocks !== undefined) {
                                                                                                                            let data34 = data30.omittedBlocks;
                                                                                                                            const _errs67 = errors;
                                                                                                                            if (!(((typeof data34 == "number") && (!(data34 % 1) && !isNaN(data34))) && (isFinite(data34)))) {
                                                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/omittedBlocks", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/omittedBlocks/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                                                return false;
                                                                                                                            }
                                                                                                                            if (errors === _errs67) {
                                                                                                                                if ((typeof data34 == "number") && (isFinite(data34))) {
                                                                                                                                    if (data34 > 500 || isNaN(data34)) {
                                                                                                                                        validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/omittedBlocks", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/omittedBlocks/maximum", keyword: "maximum", params: { comparison: "<=", limit: 500 }, message: "must be <= 500" }];
                                                                                                                                        return false;
                                                                                                                                    }
                                                                                                                                    else {
                                                                                                                                        if (data34 < 0 || isNaN(data34)) {
                                                                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/omittedBlocks", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/omittedBlocks/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" }];
                                                                                                                                            return false;
                                                                                                                                        }
                                                                                                                                    }
                                                                                                                                }
                                                                                                                            }
                                                                                                                            var valid19 = _errs67 === errors;
                                                                                                                        }
                                                                                                                        else {
                                                                                                                            var valid19 = true;
                                                                                                                        }
                                                                                                                        if (valid19) {
                                                                                                                            if (data30.semanticEquivalenceProven !== undefined) {
                                                                                                                                const _errs69 = errors;
                                                                                                                                if (false !== data30.semanticEquivalenceProven) {
                                                                                                                                    validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/semanticEquivalenceProven", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/semanticEquivalenceProven/const", keyword: "const", params: { allowedValue: false }, message: "must be equal to constant" }];
                                                                                                                                    return false;
                                                                                                                                }
                                                                                                                                var valid19 = _errs69 === errors;
                                                                                                                            }
                                                                                                                            else {
                                                                                                                                var valid19 = true;
                                                                                                                            }
                                                                                                                            if (valid19) {
                                                                                                                                if (data30.dependencyHints !== undefined) {
                                                                                                                                    let data36 = data30.dependencyHints;
                                                                                                                                    const _errs70 = errors;
                                                                                                                                    if (errors === _errs70) {
                                                                                                                                        if (Array.isArray(data36)) {
                                                                                                                                            if (data36.length > 200) {
                                                                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/maxItems", keyword: "maxItems", params: { limit: 200 }, message: "must NOT have more than 200 items" }];
                                                                                                                                                return false;
                                                                                                                                            }
                                                                                                                                            else {
                                                                                                                                                var valid20 = true;
                                                                                                                                                const len8 = data36.length;
                                                                                                                                                for (let i8 = 0; i8 < len8; i8++) {
                                                                                                                                                    let data37 = data36[i8];
                                                                                                                                                    const _errs72 = errors;
                                                                                                                                                    if (errors === _errs72) {
                                                                                                                                                        if (data37 && typeof data37 == "object" && !Array.isArray(data37)) {
                                                                                                                                                            let missing4;
                                                                                                                                                            if ((((data37.name === undefined) && (missing4 = "name")) || ((data37.declarationLine === undefined) && (missing4 = "declarationLine"))) || ((data37.usageLine === undefined) && (missing4 = "usageLine"))) {
                                                                                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8, schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" }];
                                                                                                                                                                return false;
                                                                                                                                                            }
                                                                                                                                                            else {
                                                                                                                                                                const _errs74 = errors;
                                                                                                                                                                for (const key5 in data37) {
                                                                                                                                                                    if (!(((key5 === "name") || (key5 === "declarationLine")) || (key5 === "usageLine"))) {
                                                                                                                                                                        validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8, schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key5 }, message: "must NOT have additional properties" }];
                                                                                                                                                                        return false;
                                                                                                                                                                        break;
                                                                                                                                                                    }
                                                                                                                                                                }
                                                                                                                                                                if (_errs74 === errors) {
                                                                                                                                                                    if (data37.name !== undefined) {
                                                                                                                                                                        let data38 = data37.name;
                                                                                                                                                                        const _errs75 = errors;
                                                                                                                                                                        if (errors === _errs75) {
                                                                                                                                                                            if (typeof data38 === "string") {
                                                                                                                                                                                if (func2(data38) > 2048) {
                                                                                                                                                                                    validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8 + "/name", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/properties/name/maxLength", keyword: "maxLength", params: { limit: 2048 }, message: "must NOT have more than 2048 characters" }];
                                                                                                                                                                                    return false;
                                                                                                                                                                                }
                                                                                                                                                                            }
                                                                                                                                                                            else {
                                                                                                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8 + "/name", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/properties/name/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                                                                                                return false;
                                                                                                                                                                            }
                                                                                                                                                                        }
                                                                                                                                                                        var valid21 = _errs75 === errors;
                                                                                                                                                                    }
                                                                                                                                                                    else {
                                                                                                                                                                        var valid21 = true;
                                                                                                                                                                    }
                                                                                                                                                                    if (valid21) {
                                                                                                                                                                        if (data37.declarationLine !== undefined) {
                                                                                                                                                                            let data39 = data37.declarationLine;
                                                                                                                                                                            const _errs77 = errors;
                                                                                                                                                                            if (!(((typeof data39 == "number") && (!(data39 % 1) && !isNaN(data39))) && (isFinite(data39)))) {
                                                                                                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8 + "/declarationLine", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/properties/declarationLine/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                                                                                                return false;
                                                                                                                                                                            }
                                                                                                                                                                            if (errors === _errs77) {
                                                                                                                                                                                if ((typeof data39 == "number") && (isFinite(data39))) {
                                                                                                                                                                                    if (data39 > 50000 || isNaN(data39)) {
                                                                                                                                                                                        validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8 + "/declarationLine", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/properties/declarationLine/maximum", keyword: "maximum", params: { comparison: "<=", limit: 50000 }, message: "must be <= 50000" }];
                                                                                                                                                                                        return false;
                                                                                                                                                                                    }
                                                                                                                                                                                    else {
                                                                                                                                                                                        if (data39 < 1 || isNaN(data39)) {
                                                                                                                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8 + "/declarationLine", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/properties/declarationLine/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                                                                                            return false;
                                                                                                                                                                                        }
                                                                                                                                                                                    }
                                                                                                                                                                                }
                                                                                                                                                                            }
                                                                                                                                                                            var valid21 = _errs77 === errors;
                                                                                                                                                                        }
                                                                                                                                                                        else {
                                                                                                                                                                            var valid21 = true;
                                                                                                                                                                        }
                                                                                                                                                                        if (valid21) {
                                                                                                                                                                            if (data37.usageLine !== undefined) {
                                                                                                                                                                                let data40 = data37.usageLine;
                                                                                                                                                                                const _errs79 = errors;
                                                                                                                                                                                if (!(((typeof data40 == "number") && (!(data40 % 1) && !isNaN(data40))) && (isFinite(data40)))) {
                                                                                                                                                                                    validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8 + "/usageLine", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/properties/usageLine/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                                                                                                                                                                    return false;
                                                                                                                                                                                }
                                                                                                                                                                                if (errors === _errs79) {
                                                                                                                                                                                    if ((typeof data40 == "number") && (isFinite(data40))) {
                                                                                                                                                                                        if (data40 > 50000 || isNaN(data40)) {
                                                                                                                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8 + "/usageLine", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/properties/usageLine/maximum", keyword: "maximum", params: { comparison: "<=", limit: 50000 }, message: "must be <= 50000" }];
                                                                                                                                                                                            return false;
                                                                                                                                                                                        }
                                                                                                                                                                                        else {
                                                                                                                                                                                            if (data40 < 1 || isNaN(data40)) {
                                                                                                                                                                                                validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8 + "/usageLine", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/properties/usageLine/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
                                                                                                                                                                                                return false;
                                                                                                                                                                                            }
                                                                                                                                                                                        }
                                                                                                                                                                                    }
                                                                                                                                                                                }
                                                                                                                                                                                var valid21 = _errs79 === errors;
                                                                                                                                                                            }
                                                                                                                                                                            else {
                                                                                                                                                                                var valid21 = true;
                                                                                                                                                                            }
                                                                                                                                                                        }
                                                                                                                                                                    }
                                                                                                                                                                }
                                                                                                                                                            }
                                                                                                                                                        }
                                                                                                                                                        else {
                                                                                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints/" + i8, schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/items/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                                                                                            return false;
                                                                                                                                                        }
                                                                                                                                                    }
                                                                                                                                                    var valid20 = _errs72 === errors;
                                                                                                                                                    if (!valid20) {
                                                                                                                                                        break;
                                                                                                                                                    }
                                                                                                                                                }
                                                                                                                                            }
                                                                                                                                        }
                                                                                                                                        else {
                                                                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyHints", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyHints/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                                                                                                                                            return false;
                                                                                                                                        }
                                                                                                                                    }
                                                                                                                                    var valid19 = _errs70 === errors;
                                                                                                                                }
                                                                                                                                else {
                                                                                                                                    var valid19 = true;
                                                                                                                                }
                                                                                                                                if (valid19) {
                                                                                                                                    if (data30.dependencyPolicy !== undefined) {
                                                                                                                                        let data41 = data30.dependencyPolicy;
                                                                                                                                        const _errs81 = errors;
                                                                                                                                        if (typeof data41 !== "string") {
                                                                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyPolicy", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyPolicy/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                                                                                                                            return false;
                                                                                                                                        }
                                                                                                                                        if (!(((((((data41 === "primitive-const-islands-v1") || (data41 === "scoped-primitive-dag-v2")) || (data41 === "scoped-type-members-v3")) || (data41 === "scoped-effect-analysis-v4")) || (data41 === "scoped-effect-analysis-v5")) || (data41 === "scoped-effect-analysis-v6")) || (data41 === "scoped-effect-analysis-v7"))) {
                                                                                                                                            validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring/dependencyPolicy", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/properties/dependencyPolicy/enum", keyword: "enum", params: { allowedValues: schema56.properties.dependencyPolicy.enum }, message: "must be equal to one of the allowed values" }];
                                                                                                                                            return false;
                                                                                                                                        }
                                                                                                                                        var valid19 = _errs81 === errors;
                                                                                                                                    }
                                                                                                                                    else {
                                                                                                                                        var valid19 = true;
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
                                                                                                        validate21.errors = [{ instancePath: instancePath + "/analysis/legacyAuthoring", schemaPath: "https://philofobreal.github.io/developer-exercise/schema.json#/properties/authoring/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                                                        return false;
                                                                                                    }
                                                                                                }
                                                                                                var valid17 = _errs57 === errors;
                                                                                            }
                                                                                            else {
                                                                                                var valid17 = true;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                    else {
                                                                        validate21.errors = [{ instancePath: instancePath + "/analysis", schemaPath: "#/properties/analysis/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                                                                        return false;
                                                                    }
                                                                }
                                                                var valid0 = _errs51 === errors;
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
    }
    else {
        validate21.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate21.errors = vErrors; return errors === 0; }
validate21.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
export const validateV3 = validate38;
const schema57 = { "$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "https://philofobreal.github.io/developer-exercise/codeline-v3.schema.json", "title": "CodeLine Exercise v3", "type": "object", "additionalProperties": false, "required": ["schemaVersion", "id", "revision", "title", "description", "ir"], "properties": { "schemaVersion": { "const": 3 }, "id": { "type": "string", "minLength": 1, "maxLength": 200 }, "revision": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "title": { "type": "string", "maxLength": 140 }, "description": { "type": "string", "maxLength": 500 }, "ir": { "$ref": "https://philofobreal.github.io/developer-exercise/language-ir-v1.schema.json" } } };
function validate38(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) { /*# sourceURL="https://philofobreal.github.io/developer-exercise/codeline-v3.schema.json" */ ; let vErrors = null; let errors = 0; const evaluated0 = validate38.evaluated; if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
} if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if (((((((data.schemaVersion === undefined) && (missing0 = "schemaVersion")) || ((data.id === undefined) && (missing0 = "id"))) || ((data.revision === undefined) && (missing0 = "revision"))) || ((data.title === undefined) && (missing0 = "title"))) || ((data.description === undefined) && (missing0 = "description"))) || ((data.ir === undefined) && (missing0 = "ir"))) {
            validate38.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!((((((key0 === "schemaVersion") || (key0 === "id")) || (key0 === "revision")) || (key0 === "title")) || (key0 === "description")) || (key0 === "ir"))) {
                    validate38.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.schemaVersion !== undefined) {
                    const _errs2 = errors;
                    if (3 !== data.schemaVersion) {
                        validate38.errors = [{ instancePath: instancePath + "/schemaVersion", schemaPath: "#/properties/schemaVersion/const", keyword: "const", params: { allowedValue: 3 }, message: "must be equal to constant" }];
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
                                    validate38.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" }];
                                    return false;
                                }
                                else {
                                    if (func2(data1) < 1) {
                                        validate38.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" }];
                                        return false;
                                    }
                                }
                            }
                            else {
                                validate38.errors = [{ instancePath: instancePath + "/id", schemaPath: "#/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
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
                                validate38.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/type", keyword: "type", params: { type: "integer" }, message: "must be integer" }];
                                return false;
                            }
                            if (errors === _errs5) {
                                if ((typeof data2 == "number") && (isFinite(data2))) {
                                    if (data2 > 9007199254740991 || isNaN(data2)) {
                                        validate38.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/maximum", keyword: "maximum", params: { comparison: "<=", limit: 9007199254740991 }, message: "must be <= 9007199254740991" }];
                                        return false;
                                    }
                                    else {
                                        if (data2 < 1 || isNaN(data2)) {
                                            validate38.errors = [{ instancePath: instancePath + "/revision", schemaPath: "#/properties/revision/minimum", keyword: "minimum", params: { comparison: ">=", limit: 1 }, message: "must be >= 1" }];
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
                            if (data.title !== undefined) {
                                let data3 = data.title;
                                const _errs7 = errors;
                                if (errors === _errs7) {
                                    if (typeof data3 === "string") {
                                        if (func2(data3) > 140) {
                                            validate38.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/maxLength", keyword: "maxLength", params: { limit: 140 }, message: "must NOT have more than 140 characters" }];
                                            return false;
                                        }
                                    }
                                    else {
                                        validate38.errors = [{ instancePath: instancePath + "/title", schemaPath: "#/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                        return false;
                                    }
                                }
                                var valid0 = _errs7 === errors;
                            }
                            else {
                                var valid0 = true;
                            }
                            if (valid0) {
                                if (data.description !== undefined) {
                                    let data4 = data.description;
                                    const _errs9 = errors;
                                    if (errors === _errs9) {
                                        if (typeof data4 === "string") {
                                            if (func2(data4) > 500) {
                                                validate38.errors = [{ instancePath: instancePath + "/description", schemaPath: "#/properties/description/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" }];
                                                return false;
                                            }
                                        }
                                        else {
                                            validate38.errors = [{ instancePath: instancePath + "/description", schemaPath: "#/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                            return false;
                                        }
                                    }
                                    var valid0 = _errs9 === errors;
                                }
                                else {
                                    var valid0 = true;
                                }
                                if (valid0) {
                                    if (data.ir !== undefined) {
                                        const _errs11 = errors;
                                        if (!(validate21(data.ir, { instancePath: instancePath + "/ir", parentData: data, parentDataProperty: "ir", rootData, dynamicAnchors }))) {
                                            vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
                                            errors = vErrors.length;
                                        }
                                        var valid0 = _errs11 === errors;
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
    else {
        validate38.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate38.errors = vErrors; return errors === 0; }
validate38.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
export default validateV2;
//# sourceMappingURL=schema-check.js.map
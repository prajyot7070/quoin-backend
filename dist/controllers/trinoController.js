"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeQuery = exports.createConnection = exports.createProject = exports.testConnection = void 0;
const trinoService_1 = __importDefault(require("../services/trinoService"));
const testConnection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { server, catalog, schema } = req.body;
    try {
        const result = yield trinoService_1.default.testConnection({
            server,
            catalog,
            schema,
        });
        if (result.success) {
            res.status(200).json({ message: "Connection successful", result: result.result });
        }
        else {
            res.status(500).json({ message: "Connection failed", error: result.error });
        }
    }
    catch (error) {
        res.status(500).json({ message: "An unexpected error occurred", error: error.message });
    }
});
exports.testConnection = testConnection;
const createProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, description, userId } = req.body;
    try {
        const result = yield trinoService_1.default.createProject({
            name,
            description,
            userId
        });
        if (result.success) {
            res.status(201).json({ message: "Project created successfully", project: result.project });
        }
        else {
            res.status(500).json({ message: "Failed to create project", error: result.error });
        }
    }
    catch (error) {
        res.status(500).json({ message: "An unexpected error occurred", error: error.message });
    }
});
exports.createProject = createProject;
const createConnection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, server, catalog, schema, projectId } = req.body;
    try {
        const result = yield trinoService_1.default.createConnection({
            name,
            server,
            catalog,
            schema,
            projectId
        });
        if (result.success) {
            res.status(201).json({ message: "Connection created successfully", connection: result.connection });
        }
        else {
            res.status(500).json({ message: "Failed to create connection", error: result.error });
        }
    }
    catch (error) {
        res.status(500).json({ message: "An unexpected error occurred", error: error.message });
    }
});
exports.createConnection = createConnection;
const executeQuery = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    const { connectionId, query } = req.body;
    try {
        const result = yield trinoService_1.default.executeQuery(connectionId, query);
        const rows = [];
        try {
            for (var _d = true, _e = __asyncValues(result.result), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                _c = _f.value;
                _d = false;
                const row = _c;
                rows.push(row);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (result.success) {
            res.status(200).json({ message: "Query executed successfully", result: result, data: rows });
        }
        else {
            res.status(500).json({ message: "Failed to execute query", error: result });
        }
    }
    catch (error) {
        res.status(500).json({ message: "An unexpected error occurred", error: error.message });
    }
});
exports.executeQuery = executeQuery;

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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrinoClient = void 0;
const trino_client_1 = require("trino-client");
const createTrinoClient = (config) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const trinoClient = trino_client_1.Trino.create({
            server: config.server,
            catalog: config.catalog,
            schema: config.schema,
            source: config.source,
            auth: config.auth,
            extraCredential: config.extraCredential,
            extraHeaders: config.extraHeaders,
            session: config.session,
            ssl: config.ssl
        });
        if (!trinoClient) {
            console.error("Error while creating TrinoClient: null trinoClient");
            throw new Error("Failed to create Trino client");
        }
        return trinoClient;
    }
    catch (error) {
        console.error("Failed to connect to Trino", error);
        throw error;
    }
});
exports.createTrinoClient = createTrinoClient;

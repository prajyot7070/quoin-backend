"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//import Redis from 'ioredis';
const redis_1 = require("@upstash/redis");
const redisClient = new redis_1.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
exports.default = redisClient;

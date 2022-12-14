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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restEndpointMethods = exports.Octokit = exports.GitHub = exports.Context = exports.getOctokit = exports.core = void 0;
const gh_core = require("@actions/core");
const github_1 = require("@actions/github");
const context_1 = require("@actions/github/lib/context");
const utils_1 = require("@actions/github/lib/utils");
const core_1 = require("@octokit/core");
const plugin_rest_endpoint_methods_1 = require("@octokit/plugin-rest-endpoint-methods");
const DEBUGGING = !!process.env.DEBUG;
let EXPORT;
if (DEBUGGING) {
    const db_core = {
        getInput(name, options) {
            const input = process.argv.findIndex((arg) => arg === '--' + name);
            if (input === -1) {
                if (options === null || options === void 0 ? void 0 : options.required)
                    console.warn(name + ' is required');
                return '';
            }
            return process.argv[input + 1].trim();
        },
        info: gh_core.info,
        error: gh_core.error,
        warning: gh_core.warning,
        startGroup: gh_core.startGroup,
        endGroup: gh_core.endGroup,
        isDebug: () => DEBUGGING,
        setFailed: console.error,
    };
    const db_rest = {
        pulls: {
            listCommits() {
                return __awaiter(this, void 0, void 0, function* () {
                    return { data: [{ sha: '0000000000' }] };
                });
            },
            listReviewComments() {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        data: [{
                                user: { type: 'Bot' },
                                body: '<!-- one-review-bot comment -->',
                                pull_request_url: 'https://github.com/user/repo/pull/1',
                            }],
                    };
                });
            },
        },
        repos: {
            getCommit() {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        data: {
                            files: [{ filename: 'test1.cpp' }, { filename: 'test1.hpp' }, { filename: 'test2.cpp' }, { filename: 'test2.hpp' }],
                        }
                    };
                });
            },
        },
        issues: {
            createComment(obj) {
                return __awaiter(this, void 0, void 0, function* () {
                    const { body } = obj, rest = __rest(obj, ["body"]);
                    console.log('issue.createComment', rest, 'body:', body === null || body === void 0 ? void 0 : body.split('\n').slice(0, 3).join('\n'));
                });
            },
        },
    };
    class db_Context {
        constructor() {
            this.payload = { pull_request: { number: 1 } };
            this.repo = { owner: 'user', repo: 'repo' };
            this.issue = { owner: 'user', repo: 'repo', number: 1 };
        }
    }
    ;
    const db_getOctokit = () => ({ rest: db_rest });
    const db_restEndpointMethods = () => ({ rest: db_rest });
    EXPORT = {
        core: db_core,
        getOctokit: db_getOctokit,
        Context: db_Context,
        GitHub: utils_1.GitHub,
        Octokit: core_1.Octokit,
        restEndpointMethods: db_restEndpointMethods,
    };
}
else {
    EXPORT = {
        core: gh_core,
        getOctokit: github_1.getOctokit,
        Context: context_1.Context,
        GitHub: utils_1.GitHub,
        Octokit: core_1.Octokit,
        restEndpointMethods: plugin_rest_endpoint_methods_1.restEndpointMethods,
    };
}
const { core, getOctokit, Context, GitHub, Octokit, restEndpointMethods, } = EXPORT;
exports.core = core;
exports.getOctokit = getOctokit;
exports.Context = Context;
exports.GitHub = GitHub;
exports.Octokit = Octokit;
exports.restEndpointMethods = restEndpointMethods;
//# sourceMappingURL=github.js.map
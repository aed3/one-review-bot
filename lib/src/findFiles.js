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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatherFiles = void 0;
const cspell_glob_1 = require("cspell-glob");
const fs_1 = require("fs");
const path_1 = require("path");
const github_1 = require("./github");
const log_1 = require("./log");
function isString(s) {
    return typeof s === 'string';
}
function fetchFilesForCommitsX(githubContext, octokit, commitIds) {
    return __asyncGenerator(this, arguments, function* fetchFilesForCommitsX_1() {
        const { owner, repo } = githubContext.repo;
        const { rest } = (0, github_1.restEndpointMethods)(octokit);
        for (const ref of commitIds) {
            const commit = yield __await(rest.repos.getCommit({ owner, repo, ref }));
            const files = commit.data.files;
            if (!files)
                continue;
            for (const f of files) {
                if (f.filename) {
                    yield yield __await(f.filename);
                }
            }
        }
    });
}
function fetchFilesForCommits(githubContext, octokit, commitIds) {
    var _a, e_1, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const files = new Set();
        try {
            for (var _d = true, _e = __asyncValues(fetchFilesForCommitsX(githubContext, octokit, commitIds)), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
                _c = _f.value;
                _d = false;
                try {
                    const file = _c;
                    files.add(file);
                }
                finally {
                    _d = true;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return files;
    });
}
function getPullRequestFiles(githubContext, octokit) {
    return __awaiter(this, void 0, void 0, function* () {
        const { owner, repo, number: pull_number } = githubContext.issue;
        const { rest } = (0, github_1.restEndpointMethods)(octokit);
        const commits = yield rest.pulls.listCommits({ owner, repo, pull_number });
        return fetchFilesForCommits(githubContext, octokit, commits.data.map((c) => c.sha).filter(isString));
    });
}
function filterFiles(globPattern, files) {
    const matcher = new cspell_glob_1.GlobMatcher(globPattern, { dot: true });
    const kept = [];
    const filtered = [];
    for (const file of files) {
        (matcher.match(file) ? kept : filtered).push(file);
    }
    (0, log_1.verbose)('Files filtered out:\n\t' + filtered.join('\n\t'));
    return kept;
}
function* walkDirSync(dir) {
    (0, log_1.verbose)('Searching', dir);
    const files = (0, fs_1.readdirSync)(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            yield* walkDirSync((0, path_1.join)(dir, file.name));
        }
        else {
            yield (0, path_1.join)(dir, file.name);
        }
    }
}
function gatherFiles(githubContext, octokit, params) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const files = [];
        const globPattern = params.files_config ? (0, fs_1.readFileSync)(params.files_config, 'utf8') : '';
        (0, log_1.verbose)('globPattern:\n\t' + globPattern.replace(/\n/g, '\n\t'));
        if (params.incremental_files_only) {
            const prNumber = (_a = githubContext.payload.pull_request) === null || _a === void 0 ? void 0 : _a.number;
            if (prNumber) {
                (0, log_1.info)('Running on files change in PR#', prNumber.toString());
                const eventFiles = yield getPullRequestFiles(githubContext, octokit);
                files.push(...eventFiles);
            }
        }
        if (!files.length) {
            files.push(...walkDirSync('.'));
        }
        return filterFiles(globPattern, files);
    });
}
exports.gatherFiles = gatherFiles;
//# sourceMappingURL=findFiles.js.map
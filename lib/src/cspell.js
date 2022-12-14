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
exports.action = void 0;
const cspell_1 = require("cspell");
const fs_1 = require("fs");
const path_1 = require("path");
const vscode_uri_1 = require("vscode-uri");
const github_1 = require("./github");
const log_1 = require("./log");
class CSpellReporterForGithubAction {
    constructor(verbose) {
        this.verbose = verbose;
        this.issues = { spelling: {} };
        this.cspellIssues = [];
        this.issueCounts = new Map();
        this.root = process.cwd();
        this.reporter = {
            debug: (...args) => this._debug(...args),
            error: (...args) => this._error(...args),
            info: (...args) => this._info(...args),
            issue: (...args) => this._issue(...args),
            progress: (...args) => this._progress(...args),
            result: () => this._result(),
        };
    }
    _issue(issue) {
        const { cspellIssues, issueCounts } = this;
        const uri = issue.uri;
        uri && issueCounts.set(uri, (issueCounts.get(uri) || 0) + 1);
        cspellIssues.push(issue);
    }
    _info(message, _msgType) {
        (0, log_1.verbose)(message);
    }
    _debug(message) {
        (0, log_1.debug)(message);
    }
    _progress(progress) {
        if (progress.type !== 'ProgressFileComplete')
            return;
        if (this.verbose) {
            const issueCount = this.issueCounts.get(progress.filename) || 0;
            const { fileNum, fileCount, filename, elapsedTimeMs } = progress;
            const issues = issueCount ? ` issues: ${issueCount}` : '';
            const timeMsg = elapsedTimeMs ? `(${elapsedTimeMs.toFixed(2)}ms)` : '-';
            (0, log_1.verbose)(`${fileNum}/${fileCount} ${filename}${issues} ${timeMsg}`);
        }
        else {
            (0, log_1.info)('\t', (0, path_1.relative)(this.root, progress.filename));
        }
    }
    _error(message, error) {
        github_1.core.error(`${message}
        name: ${error.name}
        msg: ${error.message}
        stack: ${error.stack}`);
    }
    _result() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const item of this.cspellIssues) {
                const { suggestions, text: word } = item;
                const file = (0, path_1.relative)(this.root, vscode_uri_1.URI.parse(item.uri || '').fsPath);
                const id = word.toLowerCase();
                this.issues.spelling[file] = this.issues.spelling[file] || {};
                this.issues.spelling[file][id] = this.issues.spelling[file][id] || { word, suggestions, instances: [] };
                this.issues.spelling[file][id].instances.push({
                    line: item.row,
                    col: item.col,
                    replacement: [item.line.text, '^'.padEnd(item.length, '~').padStart(item.col + item.length - 1)].join('\n'),
                });
            }
        });
    }
}
function action(params, files) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (!files.length) {
            return {};
        }
        github_1.core.startGroup('Running cspell');
        const collector = new CSpellReporterForGithubAction(params.verbose);
        const options = {
            root: process.cwd(),
            config: params.cspell_config || undefined,
            showSuggestions: true,
            silent: true,
        };
        (0, log_1.verbose)('CSpellApplicationOptions:', JSON.stringify(options));
        const configFileEdit = {};
        let originalConfigFile = '';
        const addParamsToConfig = !!(((_a = params.provided) === null || _a === void 0 ? void 0 : _a.max_duplicate_problems) && options.config);
        if (addParamsToConfig) {
            originalConfigFile = (0, fs_1.readFileSync)(options.config, 'utf8');
            Object.assign(configFileEdit, JSON.parse(originalConfigFile), { maxDuplicateProblems: params.max_duplicate_problems });
            (0, fs_1.writeFileSync)(options.config, JSON.stringify(configFileEdit));
        }
        try {
            yield (0, cspell_1.lint)(files, options, collector.reporter);
        }
        catch (e) {
            github_1.core.error(e);
        }
        if (addParamsToConfig) {
            (0, fs_1.writeFileSync)(options.config, originalConfigFile);
        }
        (0, log_1.info)('cspell Complete');
        github_1.core.endGroup();
        return collector.issues;
    });
}
exports.action = action;
//# sourceMappingURL=cspell.js.map
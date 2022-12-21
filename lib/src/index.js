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
exports.run = void 0;
const child_process_1 = require("child_process");
(0, child_process_1.execSync)('npm i');
const actionParams_1 = require("./actionParams");
const clang_1 = require("./clang");
const cspell_1 = require("./cspell");
const findFiles_1 = require("./findFiles");
const github_1 = require("./github");
const log_1 = require("./log");
const post_1 = require("./post");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const initialCwd = process.cwd();
        try {
            (0, log_1.info)('🤖 One Review Bot');
            const githubContext = new github_1.Context();
            const params = (0, actionParams_1.getActionParams)();
            const octokit = (0, github_1.getOctokit)(params.github_token);
            (0, log_1.setVerbose)(params);
            (0, log_1.verbose)('Parameters:', JSON.stringify(params, null, 2));
            process.chdir(params.root || '.');
            (0, log_1.verbose)('Changed directory from', initialCwd, 'to', process.cwd());
            const files = yield (0, findFiles_1.gatherFiles)(githubContext, octokit, params);
            (0, log_1.info)('Checking files:\n\t' + files.slice().sort().join('\n\t'));
            const issues = {};
            const spellIssues = yield (0, cspell_1.action)(params, files);
            const clangIssues = (0, clang_1.action)(params, files);
            Object.assign(issues, spellIssues);
            Object.assign(issues, clangIssues);
            const allAnnotations = yield (0, post_1.postComments)(issues, githubContext, octokit);
            const annotationsList = Object.values(allAnnotations).flat();
            const totalIssues = annotationsList.length;
            (0, log_1.makeAnnotations)(annotationsList);
            if (totalIssues) {
                (0, log_1.info)('Found', (0, post_1.pluralize)('cspell issue', allAnnotations.spellAnnotations.length));
                (0, log_1.info)('Found', (0, post_1.pluralize)('clang-format issue', allAnnotations.formatAnnotations.length));
                (0, log_1.info)('Found', (0, post_1.pluralize)('clang-tidy issue', allAnnotations.tidyAnnotations.length));
                github_1.core.setFailed(`Found ${(0, post_1.pluralize)('total issue', totalIssues)}`);
            }
            else {
                (0, log_1.info)('No Issues Found!');
            }
            (0, log_1.info)('Done.');
        }
        catch (error) {
            console.error(error);
            github_1.core.setFailed(error.message);
        }
    });
}
exports.run = run;
run();
//# sourceMappingURL=index.js.map